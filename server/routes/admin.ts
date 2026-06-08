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
    const markers = db.query('SELECT * FROM markers').all()
    const now = new Date().toISOString()
    const displayName = session.display_name ?? session.role
    db.run(
      'INSERT INTO snapshots (id, label, markers_json, created_at, created_by, trigger) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), 'Hyväksytty', JSON.stringify(markers), now, displayName, 'auto-hyväksytty'],
    )
    db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('approved_at', ?)", [now])
    db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('approved_by', ?)", [displayName])
  } else {
    // Revert to luonnos: clear approval metadata
    db.run("DELETE FROM map_state WHERE key IN ('approved_at', 'approved_by')")
  }

  db.run("INSERT OR REPLACE INTO map_state (key, value) VALUES ('status', ?)", [status])
  return c.json({ status })
})
