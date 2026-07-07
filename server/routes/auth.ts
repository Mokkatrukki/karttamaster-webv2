import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth } from '../middleware/auth'
import type { User, SessionData } from '../types'

export const authRoutes = new Hono<AuthEnv>()

authRoutes.post('/login', async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ username?: string; password?: string }>()
  const { username, password } = body
  if (!username || !password) return c.json({ error: 'missing_fields' }, 400)

  const user = db.query<User, [string]>('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !user.password_hash) return c.json({ error: 'invalid_credentials' }, 401)

  const valid = await Bun.password.verify(password, user.password_hash)
  if (!valid) return c.json({ error: 'invalid_credentials' }, 401)

  const sessionId = randomUUID()
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, user.id, null, user.role, user.display_name, expires],
  )

  setCookie(c, 'session', sessionId, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 7 * 24 * 3600 })
  return c.json({ role: user.role, display_name: user.display_name })
})

authRoutes.post('/code-login', async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ code?: string }>()
  const code = body.code?.trim().toUpperCase()
  if (!code) return c.json({ error: 'missing_code' }, 400)

  const row = db
    .query<{ code: string; display_name: string }, [string]>(
      'SELECT code, display_name FROM talkoolainen_codes WHERE code = ?',
    )
    .get(code)
  if (!row) return c.json({ error: 'invalid_code' }, 401)

  const sessionId = randomUUID()
  // T186/V119: talkoolaisen kenttätyö kestää tapahtumapäivät (asetus + tarkastus + purku).
  // 24h TTL vanheni day-2 kesken työn → 401-sarja. Nostettu 7pv:ään (sama kuin järjestäjä).
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, null, row.code, 'talkoolainen', row.display_name, expires],
  )
  db.run('UPDATE talkoolainen_codes SET used_at = ? WHERE code = ?', [new Date().toISOString(), row.code])

  setCookie(c, 'session', sessionId, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 7 * 24 * 3600 })
  return c.json({ role: 'talkoolainen', display_name: row.display_name })
})

authRoutes.post('/logout', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  db.run('DELETE FROM sessions WHERE id = ?', [session.id])
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

authRoutes.get('/me', requireAuth(), (c) => {
  const session: SessionData = c.get('session')
  return c.json({ role: session.role, display_name: session.display_name })
})

authRoutes.get('/invite/:token', (c) => {
  const db: Database = c.get('db')
  const token = c.req.param('token')
  const row = db
    .query<{ invite_token: string }, [string]>('SELECT invite_token FROM users WHERE invite_token = ?')
    .get(token)
  if (!row) return c.json({ error: 'invalid_token' }, 404)
  return c.json({ valid: true })
})

authRoutes.post('/register', async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    token?: string
    username?: string
    password?: string
    display_name?: string
  }>()
  const { token, username, password, display_name } = body
  if (!token || !username || !password) return c.json({ error: 'missing_fields' }, 400)

  const invited = db.query<User, [string]>('SELECT * FROM users WHERE invite_token = ?').get(token)
  if (!invited) return c.json({ error: 'invalid_token' }, 400)

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return c.json({ error: 'username_taken' }, 409)

  const hash = await Bun.password.hash(password)
  db.run('UPDATE users SET username = ?, password_hash = ?, display_name = ?, invite_token = NULL WHERE id = ?', [
    username,
    hash,
    display_name ?? username,
    invited.id,
  ])

  return c.json({ ok: true })
})
