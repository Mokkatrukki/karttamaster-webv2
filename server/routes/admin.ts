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
    .query<Pick<User, 'id' | 'username' | 'role' | 'display_name' | 'created_at'>, []>(
      'SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at ASC',
    )
    .all()
  return c.json(users)
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

function getMapStateRow(db: Database, key: string): string | undefined {
  return db.query<{ value: string }, [string]>('SELECT value FROM map_state WHERE key = ?').get(key)?.value
}

// GET /api/admin/map-state — V22: current status + approved metadata
adminRoutes.get('/map-state', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const status = getMapStateRow(db, 'status') ?? 'luonnos'
  const approved_at = getMapStateRow(db, 'approved_at')
  const approved_by = getMapStateRow(db, 'approved_by')
  return c.json({
    status,
    ...(approved_at !== undefined ? { approved_at } : {}),
    ...(approved_by !== undefined ? { approved_by } : {}),
  })
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

// POST /api/admin/map-state — V23: auto-snapshot when transitioning to 'hyväksytty'
adminRoutes.post('/map-state', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<{ status?: string }>()
  const { status } = body

  if (!status || !['luonnos', 'hyväksytty'].includes(status)) {
    return c.json({ error: 'invalid_status' }, 400)
  }

  if (status === 'hyväksytty') {
    const now = new Date().toISOString()
    const displayName = session.display_name ?? session.role
    createSnapshot(db, 'Hyväksytty', displayName, 'auto-hyväksytty')
    db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('approved_at', ?)", [now])
    db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('approved_by', ?)", [displayName])
  } else {
    // Revert to luonnos: clear approval metadata
    db.run("DELETE FROM map_state WHERE key IN ('approved_at', 'approved_by')")
  }

  db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('status', ?)", [status])
  return c.json({ status })
})
