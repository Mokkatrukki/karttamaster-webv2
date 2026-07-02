import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { User, SessionData } from '../types'

export const adminRoutes = new Hono<AuthEnv>()

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

interface MarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  distance_from_start: number
  route_ids: string
  status: string
  location_note: string | null
  updated_at: string
  updated_by: string | null
}

interface SnapshotRow {
  id: string
  label: string
  markers_json: string
  created_at: string
  created_by: string
  trigger: string
}

function createSnapshot(db: Database, label: string, createdBy: string, trigger: string): void {
  const markers = db.query<MarkerRow, []>('SELECT * FROM markers').all()
  db.run(
    'INSERT INTO snapshots (id, label, markers_json, created_at, created_by, trigger) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), label, JSON.stringify(markers), new Date().toISOString(), createdBy, trigger],
  )
  // Prune: keep max 20 by insertion order (rowid is monotone, avoids timestamp ties)
  db.run(`
    DELETE FROM snapshots WHERE rowid NOT IN (
      SELECT rowid FROM snapshots ORDER BY rowid DESC LIMIT 20
    )
  `)
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

  let markers: MarkerRow[]
  try {
    markers = JSON.parse(snap.markers_json) as MarkerRow[]
  } catch {
    return c.json({ error: 'corrupt_snapshot' }, 500)
  }

  // V24: atomic — all or nothing
  db.transaction(() => {
    db.run('DELETE FROM markers')
    for (const m of markers) {
      db.run(
        'INSERT INTO markers (id, type, lat, lon, bearing, distance_from_start, route_ids, status, location_note, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [m.id, m.type, m.lat, m.lon, m.bearing, m.distance_from_start, m.route_ids, m.status, m.location_note ?? null, m.updated_at, m.updated_by ?? null],
      )
    }
    const createdBy = session.display_name ?? session.role
    createSnapshot(db, `Palautus: ${snap.label}`, createdBy, 'restore')
  })()

  return c.json({ ok: true })
})

