import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, seedAdmin } from './db'
import { dbMiddleware, requireAuth, requireRole } from './middleware/auth'
import { seedTestUsers, makeTestSession, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.get('/api/health', (c) => c.json({ ok: true }))
  app.get('/api/protected', requireAuth(), (c) => c.json({ ok: true }))
  app.get('/api/admin-only', requireAuth(), requireRole('admin'), (c) => c.json({ ok: true }))
  return app
}

describe('T41: Backend server-perusta', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('GET /api/health', () => {
    test('returns 200 with ok:true', async () => {
      const res = await makeApp(db).request('/api/health')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    })
  })

  describe('schema init', () => {
    test('idempotent — second createDb does not throw', () => {
      expect(() => { const d = createDb(':memory:'); d.close() }).not.toThrow()
    })

    test('map_state seeded with luonnos', () => {
      const row = db.query<{ value: string }, [string]>(
        "SELECT value FROM map_state WHERE key = ?"
      ).get('status')
      expect(row?.value).toBe('luonnos')
    })

    test('map_state init idempotent — no duplicate status row', () => {
      const db2 = createDb(':memory:')
      const count = db2.query<{ count: number }, []>(
        "SELECT COUNT(*) as count FROM map_state WHERE key='status'"
      ).get()
      expect(count?.count).toBe(1)
      db2.close()
    })
  })

  describe('seedAdmin', () => {
    test('creates admin user from env', () => {
      const db2 = createDb(':memory:')
      process.env.ADMIN_USERNAME = 'prodadmin'
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$fakehash'
      seedAdmin(db2)
      const user = db2.query<{ role: string }, [string]>(
        'SELECT role FROM users WHERE username = ?'
      ).get('prodadmin')
      expect(user?.role).toBe('admin')
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
      db2.close()
    })

    test('idempotent — does not create duplicate', () => {
      const db2 = createDb(':memory:')
      process.env.ADMIN_USERNAME = 'prodadmin'
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$fakehash'
      seedAdmin(db2)
      seedAdmin(db2)
      const count = db2.query<{ count: number }, [string]>(
        'SELECT COUNT(*) as count FROM users WHERE username = ?'
      ).get('prodadmin')
      expect(count?.count).toBe(1)
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
      db2.close()
    })

    test('no-op when env vars missing', () => {
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
      const db2 = createDb(':memory:')
      expect(() => seedAdmin(db2)).not.toThrow()
      const count = db2.query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM users'
      ).get()
      expect(count?.count).toBe(0)
      db2.close()
    })
  })

  describe('requireAuth middleware', () => {
    test('rejects request without session cookie → 401', async () => {
      const res = await makeApp(db).request('/api/protected')
      expect(res.status).toBe(401)
    })

    test('rejects expired session → 401', async () => {
      const id = makeTestSession(db, 'admin', -1)
      const res = await makeApp(db).request('/api/protected', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(401)
    })

    test('accepts valid session → 200', async () => {
      const res = await makeApp(db).request('/api/protected', {
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
    })
  })

  describe('requireRole middleware', () => {
    test('admin can access admin-only route', async () => {
      const res = await makeApp(db).request('/api/admin-only', {
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
    })

    test('talkoolainen blocked from admin-only route → 403', async () => {
      const res = await makeApp(db).request('/api/admin-only', {
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('järjestäjä blocked from admin-only route → 403', async () => {
      const res = await makeApp(db).request('/api/admin-only', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(403)
    })
  })
})
