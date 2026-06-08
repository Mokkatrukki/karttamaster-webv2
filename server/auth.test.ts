import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { seedTestUsers, authHeaders, TEST_USERS, TEST_PASSWORD } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/auth', authRoutes)
  app.route('/api/admin', adminRoutes)
  return app
}

describe('T36: Auth-reittit', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  afterEach(() => db.close())

  // ── POST /api/auth/login ────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    test('valid credentials → 200 + session cookie', async () => {
      const res = await makeApp(db).request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERS.admin.username, password: TEST_PASSWORD }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { role: string; display_name: string }
      expect(body.role).toBe('admin')
      expect(res.headers.get('set-cookie')).toContain('session=')
    })

    test('wrong password → 401', async () => {
      const res = await makeApp(db).request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERS.admin.username, password: 'wrong' }),
      })
      expect(res.status).toBe(401)
    })

    test('unknown user → 401', async () => {
      const res = await makeApp(db).request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ei-ole', password: TEST_PASSWORD }),
      })
      expect(res.status).toBe(401)
    })

    test('missing fields → 400', async () => {
      const res = await makeApp(db).request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERS.admin.username }),
      })
      expect(res.status).toBe(400)
    })

    test('järjestäjä login returns correct role', async () => {
      const res = await makeApp(db).request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERS.järjestäjä.username, password: TEST_PASSWORD }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { role: string }
      expect(body.role).toBe('järjestäjä')
    })
  })

  // ── POST /api/auth/code-login ───────────────────────────────────────────

  describe('POST /api/auth/code-login', () => {
    test('valid code → 200 + session cookie', async () => {
      const res = await makeApp(db).request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: TEST_USERS.talkoolainen.code }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { role: string; display_name: string }
      expect(body.role).toBe('talkoolainen')
      expect(res.headers.get('set-cookie')).toContain('session=')
    })

    test('code case-insensitive (lowercase input)', async () => {
      const res = await makeApp(db).request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: TEST_USERS.talkoolainen.code.toLowerCase() }),
      })
      expect(res.status).toBe(200)
    })

    test('invalid code → 401', async () => {
      const res = await makeApp(db).request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'EI-OLE-KOODI' }),
      })
      expect(res.status).toBe(401)
    })

    test('missing code → 400', async () => {
      const res = await makeApp(db).request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    test('used_at updated after login', async () => {
      await makeApp(db).request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: TEST_USERS.talkoolainen.code }),
      })
      const row = db.query<{ used_at: string | null }, [string]>(
        'SELECT used_at FROM talkoolainen_codes WHERE code = ?',
      ).get(TEST_USERS.talkoolainen.code)
      expect(row?.used_at).not.toBeNull()
    })
  })

  // ── GET /api/auth/me ────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    test('authenticated → 200 with role', async () => {
      const res = await makeApp(db).request('/api/auth/me', {
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { role: string }
      expect(body.role).toBe('admin')
    })

    test('unauthenticated → 401', async () => {
      const res = await makeApp(db).request('/api/auth/me')
      expect(res.status).toBe(401)
    })
  })

  // ── POST /api/auth/logout ───────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    test('logout deletes session from DB', async () => {
      const app = makeApp(db)
      // First login to get a session
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERS.admin.username, password: TEST_PASSWORD }),
      })
      const cookie = loginRes.headers.get('set-cookie') ?? ''
      const sessionId = cookie.match(/session=([^;]+)/)?.[1] ?? ''

      const countBefore = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM sessions').get()
      expect(countBefore?.count).toBeGreaterThan(0)

      await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: `session=${sessionId}` },
      })

      const row = db.query<{ id: string }, [string]>('SELECT id FROM sessions WHERE id = ?').get(sessionId)
      expect(row).toBeNull()
    })

    test('unauthenticated logout → 401', async () => {
      const res = await makeApp(db).request('/api/auth/logout', { method: 'POST' })
      expect(res.status).toBe(401)
    })
  })

  // ── Invite flow ─────────────────────────────────────────────────────────

  describe('Invite flow (järjestäjä rekisteröinti)', () => {
    test('POST /api/admin/invites → token returned (admin)', async () => {
      const res = await makeApp(db).request('/api/admin/invites', {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as { token: string }
      expect(typeof body.token).toBe('string')
      expect(body.token.length).toBeGreaterThan(10)
    })

    test('POST /api/admin/invites → forbidden for talkoolainen', async () => {
      const res = await makeApp(db).request('/api/admin/invites', {
        method: 'POST',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('GET /api/auth/invite/:token → valid token recognized', async () => {
      const inviteRes = await makeApp(db).request('/api/admin/invites', {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      const { token } = await inviteRes.json() as { token: string }

      const res = await makeApp(db).request(`/api/auth/invite/${token}`)
      expect(res.status).toBe(200)
    })

    test('GET /api/auth/invite/:token → unknown token 404', async () => {
      const res = await makeApp(db).request('/api/auth/invite/ei-ole-token')
      expect(res.status).toBe(404)
    })

    test('POST /api/auth/register → creates user, invalidates token', async () => {
      const inviteRes = await makeApp(db).request('/api/admin/invites', {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      const { token } = await inviteRes.json() as { token: string }

      const regRes = await makeApp(db).request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, username: 'uusi-jarjestaja', password: 'salasana123' }),
      })
      expect(regRes.status).toBe(200)

      // Token invalidated — second register attempt fails
      const res2 = await makeApp(db).request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, username: 'toinen', password: 'abc' }),
      })
      expect(res2.status).toBe(400)
    })

    test('POST /api/auth/register → username conflict → 409', async () => {
      const inviteRes = await makeApp(db).request('/api/admin/invites', {
        method: 'POST',
        headers: authHeaders(db, 'admin'),
      })
      const { token } = await inviteRes.json() as { token: string }

      const res = await makeApp(db).request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, username: TEST_USERS.admin.username, password: 'salasana' }),
      })
      expect(res.status).toBe(409)
    })
  })

  // ── Talkoolainen codes (admin) ──────────────────────────────────────────

  describe('Talkoolainen codes CRUD', () => {
    test('POST /api/admin/codes → creates code (järjestäjä)', async () => {
      const res = await makeApp(db).request('/api/admin/codes', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'SYOTE-MATTI-1', display_name: 'Matti Meikäläinen' }),
      })
      expect(res.status).toBe(201)
    })

    test('POST /api/admin/codes bulk → array accepted', async () => {
      const res = await makeApp(db).request('/api/admin/codes', {
        method: 'POST',
        headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { code: 'SYOTE-A1', display_name: 'Aino' },
          { code: 'SYOTE-B2', display_name: 'Bertta' },
        ]),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as { created: number }
      expect(body.created).toBe(2)
    })

    test('GET /api/admin/codes → returns codes list', async () => {
      const res = await makeApp(db).request('/api/admin/codes', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const codes = await res.json() as unknown[]
      expect(Array.isArray(codes)).toBe(true)
    })

    test('DELETE /api/admin/codes/:code → removes code', async () => {
      const code = TEST_USERS.talkoolainen.code
      const res = await makeApp(db).request(`/api/admin/codes/${code}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
      const row = db.query('SELECT * FROM talkoolainen_codes WHERE code = ?').get(code)
      expect(row).toBeNull()
    })

    test('talkoolainen cannot manage codes → 403', async () => {
      const res = await makeApp(db).request('/api/admin/codes', {
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })
  })

  // ── GET /api/admin/users ────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    test('admin sees user list', async () => {
      const res = await makeApp(db).request('/api/admin/users', {
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
      const users = await res.json() as unknown[]
      expect(Array.isArray(users)).toBe(true)
      expect(users.length).toBeGreaterThanOrEqual(2) // admin + järjestäjä seeded
    })

    test('järjestäjä cannot see user list → 403', async () => {
      const res = await makeApp(db).request('/api/admin/users', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(403)
    })
  })
})
