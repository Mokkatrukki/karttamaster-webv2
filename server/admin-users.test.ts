import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/admin', adminRoutes)
  app.route('/api/auth', authRoutes)
  return app
}

/** Create a real user row + a live session tied to its user_id (needed for is_active checks). */
function makeUserSession(db: Database, role: 'admin' | 'järjestäjä' = 'järjestäjä'): { userId: string; cookie: { Cookie: string } } {
  const userId = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, `user-${userId.slice(0, 8)}`, '', role, 'Testikäyttäjä', now],
  )
  const sessionId = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, userId, null, role, 'Testikäyttäjä', expires],
  )
  return { userId, cookie: { Cookie: `session=${sessionId}` } }
}

describe('T121: is_active + käyttäjähallinta API', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  afterEach(() => db.close())

  // ── V75: is_active=0 → 401 also with a valid session ─────────────────────

  test('deactivated user gets 401 on subsequent request even with valid session', async () => {
    const { userId, cookie } = makeUserSession(db, 'järjestäjä')

    // Sanity check: works while active
    const before = await app.request('/api/auth/me', { headers: cookie })
    expect(before.status).toBe(200)

    db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId])

    const after = await app.request('/api/auth/me', { headers: cookie })
    expect(after.status).toBe(401)
    const body = await after.json() as { error: string }
    expect(body.error).toBe('account_disabled')
  })

  test('talkoolainen session (no user_id) unaffected by is_active check', async () => {
    const res = await app.request('/api/auth/me', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
  })

  // ── PATCH /api/admin/users/:id ────────────────────────────────────────────

  describe('PATCH /api/admin/users/:id', () => {
    test('admin deactivates a user', async () => {
      const { userId } = makeUserSession(db)
      const res = await app.request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 0 }),
      })
      expect(res.status).toBe(200)
      const row = db.query<{ is_active: number }, [string]>('SELECT is_active FROM users WHERE id = ?').get(userId)!
      expect(row.is_active).toBe(0)
    })

    test('admin re-activates a user', async () => {
      const { userId } = makeUserSession(db)
      db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId])
      const res = await app.request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 1 }),
      })
      expect(res.status).toBe(200)
      const row = db.query<{ is_active: number }, [string]>('SELECT is_active FROM users WHERE id = ?').get(userId)!
      expect(row.is_active).toBe(1)
    })

    test('järjestäjä forbidden (V74: admin-only)', async () => {
      const { userId } = makeUserSession(db)
      const res = await app.request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 0 }),
      })
      expect(res.status).toBe(403)
    })

    test('unknown id 404', async () => {
      const res = await app.request('/api/admin/users/tuntematon-id', {
        method: 'PATCH',
        headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 0 }),
      })
      expect(res.status).toBe(404)
    })

    test('invalid is_active value 400', async () => {
      const { userId } = makeUserSession(db)
      const res = await app.request(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 2 }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── POST /api/admin/users/:id/reset-password ──────────────────────────────

  describe('POST /api/admin/users/:id/reset-password', () => {
    test('admin resets password — new invite token, returned as inviteUrl', async () => {
      const { userId } = makeUserSession(db)
      const res = await app.request(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { inviteUrl: string }
      expect(body.inviteUrl).toMatch(/^\/auth\/invite\//)

      const row = db.query<{ invite_token: string }, [string]>('SELECT invite_token FROM users WHERE id = ?').get(userId)!
      expect(row.invite_token).toBeTruthy()
      expect(body.inviteUrl).toBe(`/auth/invite/${row.invite_token}`)
    })

    test('järjestäjä forbidden (V74: admin-only)', async () => {
      const { userId } = makeUserSession(db)
      const res = await app.request(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(403)
    })

    test('unknown id 404', async () => {
      const res = await app.request('/api/admin/users/tuntematon-id/reset-password', {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(404)
    })
  })

  // ── GET /api/admin/users includes is_active ───────────────────────────────

  test('GET /api/admin/users includes is_active field', async () => {
    const res = await app.request('/api/admin/users', { headers: authHeaders(db, 'admin') })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ is_active: number }>
    expect(body.length).toBeGreaterThan(0)
    for (const u of body) expect(typeof u.is_active).toBe('number')
  })
})
