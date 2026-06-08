import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { User } from '../types'

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
