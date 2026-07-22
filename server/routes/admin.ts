import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { User, SessionData } from '../types'
import { createSnapshot, serializeDataset, restoreDataset, insertRows, type DatasetV1 } from '../snapshot-data'
import { getSetting, setSetting, SETTING_TALKOO_PASSWORD, SETTING_FAQ_MARKDOWN } from '../settings'

export const adminRoutes = new Hono<AuthEnv>()

// T267/V188: talkoolaisten yleissalasanan hallinta. Admin-only → palauttaa salasanan
// näkyviin ("mikäs se salasana oli", käyttäjäpäätös 2026-07-22 — plaintext, jaettu salasana).
adminRoutes.get('/settings', requireAuth(), requireRole('admin'), (c) => {
  const db: Database = c.get('db')
  const pw = getSetting(db, SETTING_TALKOO_PASSWORD)
  return c.json({ talkooPassword: pw ?? '', talkooPasswordSet: pw !== null && pw !== '' })
})

adminRoutes.put('/settings/talkoo-password', requireAuth(), requireRole('admin'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ password?: string }>().catch(() => ({}) as { password?: string })
  const password = body.password?.trim()
  if (!password || password.length < 4) return c.json({ error: 'invalid_password' }, 400)
  setSetting(db, SETTING_TALKOO_PASSWORD, password)
  return c.json({ ok: true })
})

// T269/V190: FAQ-markdownin tallennus (admin). Luku: GET /api/faq (faq.ts, ∀ autentikoitu).
adminRoutes.put('/faq', requireAuth(), requireRole('admin'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ markdown?: string }>().catch(() => ({}) as { markdown?: string })
  const markdown = typeof body.markdown === 'string' ? body.markdown : ''
  setSetting(db, SETTING_FAQ_MARKDOWN, markdown)
  return c.json({ ok: true })
})

adminRoutes.get('/users', requireAuth(), requireRole('admin'), (c) => {
  const db: Database = c.get('db')
  const users = db
    .query<Pick<User, 'id' | 'username' | 'role' | 'display_name' | 'created_at' | 'is_active' | 'invite_token'>, []>(
      'SELECT id, username, role, display_name, created_at, is_active, invite_token FROM users ORDER BY created_at ASC',
    )
    .all()
  return c.json(users)
})

adminRoutes.patch('/users/:id', requireAuth(), requireRole('admin'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json<{ is_active?: number }>().catch(() => ({}) as { is_active?: number })
  if (body.is_active !== 0 && body.is_active !== 1) {
    return c.json({ error: 'invalid_is_active' }, 400)
  }
  const result = db.run('UPDATE users SET is_active = ? WHERE id = ?', [body.is_active, id])
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

adminRoutes.post('/users/:id/reset-password', requireAuth(), requireRole('admin'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const token = randomUUID()
  const result = db.run('UPDATE users SET invite_token = ? WHERE id = ?', [token, id])
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ inviteUrl: `/auth/invite/${token}` })
})

adminRoutes.post('/invites', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const token = randomUUID()
  db.run(
    'INSERT INTO users (id, username, password_hash, role, invite_token, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), `invite-${token.slice(0, 8)}`, '', 'järjestäjä', token, new Date().toISOString()],
  )
  return c.json({ token }, 201)
})

adminRoutes.post('/codes', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<
    Array<{ code: string; display_name: string; segment_id?: string }> | { code: string; display_name: string; segment_id?: string }
  >()
  const items = Array.isArray(body) ? body : [body]
  const now = new Date().toISOString()
  for (const item of items) {
    db.run('INSERT OR IGNORE INTO talkoolainen_codes (code, display_name, segment_id, created_at) VALUES (?, ?, ?, ?)', [
      item.code.toUpperCase(),
      item.display_name,
      item.segment_id ?? null,
      now,
    ])
  }
  return c.json({ created: items.length }, 201)
})

adminRoutes.get('/codes', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const codes = db.query('SELECT * FROM talkoolainen_codes ORDER BY created_at ASC').all()
  return c.json(codes)
})

adminRoutes.delete('/codes/:code', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const code = c.req.param('code').toUpperCase()
  db.run('DELETE FROM talkoolainen_codes WHERE code = ?', [code])
  return c.json({ ok: true })
})

// ── Snapshot helpers ────────────────────────────────────────────────────────
// createSnapshot/restoreDataset/insertRows: ks. ../snapshot-data.ts (V100, jaettu)

interface SnapshotRow {
  id: string
  label: string
  markers_json: string
  dataset_json: string | null
  created_at: string
  created_by: string
  trigger: string
}

// GET /api/admin/snapshots — max 20, newest first (no markers_json, too large)
adminRoutes.get('/snapshots', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const snapshots = db
    .query<Omit<SnapshotRow, 'markers_json'>, []>(
      'SELECT id, label, created_at, created_by, trigger FROM snapshots ORDER BY rowid DESC LIMIT 20',
    )
    .all()
  return c.json(snapshots)
})

// POST /api/admin/snapshots — manual snapshot
adminRoutes.post('/snapshots', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<{ label?: string }>().catch(() => ({}))
  const label = body.label?.trim() || `Manuaalinen ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  const createdBy = session.display_name ?? session.role
  createSnapshot(db, label, createdBy, 'manual')
  const snap = db.query<Omit<SnapshotRow, 'markers_json'>, []>(
    'SELECT id, label, created_at, created_by, trigger FROM snapshots ORDER BY created_at DESC LIMIT 1',
  ).get()
  return c.json(snap, 201)
})

// POST /api/admin/snapshots/:id/restore — V24: atomic restore
adminRoutes.post('/snapshots/:id/restore', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const id = c.req.param('id')

  const snap = db.query<SnapshotRow, [string]>('SELECT * FROM snapshots WHERE id = ?').get(id)
  if (!snap) return c.json({ error: 'not_found' }, 404)

  // V100: dataset_json → koko dataset; legacy markers-only → vain markers (ei tyhjennä segments/areas)
  let dataset: DatasetV1 | null = null
  let legacyMarkers: Record<string, unknown>[] | null = null
  try {
    if (snap.dataset_json) {
      dataset = JSON.parse(snap.dataset_json) as DatasetV1
    } else {
      legacyMarkers = JSON.parse(snap.markers_json) as Record<string, unknown>[]
    }
  } catch {
    return c.json({ error: 'corrupt_snapshot' }, 500)
  }

  // V24/V100: atomic — all or nothing
  db.transaction(() => {
    if (dataset) {
      restoreDataset(db, dataset)
    } else {
      db.run('DELETE FROM markers')
      insertRows(db, 'markers', legacyMarkers!)
    }
    const createdBy = session.display_name ?? session.role
    createSnapshot(db, `Palautus: ${snap.label}`, createdBy, 'restore')
  })()

  return c.json({ ok: true })
})

// ── V102/T164: lataa/palauta koko dataset tiedostona (off-site-turva) ─────────

// GET /api/admin/backup — lataa koko dataset (V100-blob) tiedostona
adminRoutes.get('/backup', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const data = serializeDataset(db)
  const filename = `karttamaster-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// POST /api/admin/backup/restore — palauta koko dataset ladatusta tiedostosta
adminRoutes.post('/backup/restore', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const data = await c.req.json<DatasetV1>().catch(() => null)
  // Validoi V100-formaatti ennen mitään kirjoitusta (ei osittaista restorea)
  if (
    !data || data.version !== 1 ||
    !Array.isArray(data.markers) || !Array.isArray(data.segments) ||
    !Array.isArray(data.areas) || !Array.isArray(data.areaFeatures)
  ) {
    return c.json({ error: 'invalid_backup' }, 400)
  }
  // V24/V100: atominen — kaikki tai ei mitään
  db.transaction(() => {
    restoreDataset(db, data)
    const createdBy = session.display_name ?? session.role
    createSnapshot(db, `Palautus tiedostosta ${new Date().toISOString().slice(0, 10)}`, createdBy, 'restore')
  })()
  return c.json({ ok: true })
})

