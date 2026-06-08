import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, seedAdmin } from './db'
import { dbMiddleware, requireAuth, requireRole } from './middleware/auth'
import type { Database } from 'bun:sqlite'
import { setCookie } from 'hono/cookie'
import { randomUUID } from 'crypto'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.get('/api/health', (c) => c.json({ ok: true }))
  app.get('/api/protected', requireAuth(), (c) => c.json({ ok: true }))
  app.get('/api/admin-only', requireAuth(), requireRole('admin'), (c) => c.json({ ok: true }))
  return app
}

function insertSession(
  db: Database,
  role: 'admin' | 'järjestäjä' | 'talkoolainen',
  expiresOffset = 3600
): string {
  const id = randomUUID()
  const expires = new Date(Date.now() + expiresOffset * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, null, role, 'Testi', expires]
  )
  return id
}

describe('T41: Backend server-perusta', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  describe('GET /api/health', () => {
    test('returns 200 with ok:true', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/health')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({ ok: true })
    })
  })

  describe('schema init', () => {
    test('idempotent — second createDb does not throw', () => {
      expect(() => {
        const db2 = createDb(':memory:')
        db2.close()
      }).not.toThrow()
    })

    test('map_state seeded with luonnos', () => {
      const row = db.query<{ value: string }, [string]>(
        "SELECT value FROM map_state WHERE key = ?"
      ).get('status')
      expect(row?.value).toBe('luonnos')
    })

    test('map_state insert idempotent — no duplicate', () => {
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
      process.env.ADMIN_USERNAME = 'testadmin'
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$fakehash'
      seedAdmin(db)
      const user = db.query<{ role: string }, [string]>(
        'SELECT role FROM users WHERE username = ?'
      ).get('testadmin')
      expect(user?.role).toBe('admin')
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
    })

    test('idempotent — does not create duplicate', () => {
      process.env.ADMIN_USERNAME = 'testadmin'
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$fakehash'
      seedAdmin(db)
      seedAdmin(db)
      const count = db.query<{ count: number }, [string]>(
        'SELECT COUNT(*) as count FROM users WHERE username = ?'
      ).get('testadmin')
      expect(count?.count).toBe(1)
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
    })

    test('no-op when env vars missing', () => {
      delete process.env.ADMIN_USERNAME
      delete process.env.ADMIN_PASSWORD_HASH
      expect(() => seedAdmin(db)).not.toThrow()
      const count = db.query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM users'
      ).get()
      expect(count?.count).toBe(0)
    })
  })

  describe('requireAuth middleware', () => {
    test('rejects request without session cookie → 401', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/protected')
      expect(res.status).toBe(401)
    })

    test('rejects expired session → 401', async () => {
      const id = insertSession(db, 'admin', -1)
      const app = makeApp(db)
      const res = await app.request('/api/protected', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(401)
    })

    test('accepts valid session → 200', async () => {
      const id = insertSession(db, 'admin')
      const app = makeApp(db)
      const res = await app.request('/api/protected', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('requireRole middleware', () => {
    test('admin can access admin-only route', async () => {
      const id = insertSession(db, 'admin')
      const app = makeApp(db)
      const res = await app.request('/api/admin-only', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(200)
    })

    test('talkoolainen blocked from admin-only route → 403', async () => {
      const id = insertSession(db, 'talkoolainen')
      const app = makeApp(db)
      const res = await app.request('/api/admin-only', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(403)
    })

    test('järjestäjä blocked from admin-only route → 403', async () => {
      const id = insertSession(db, 'järjestäjä')
      const app = makeApp(db)
      const res = await app.request('/api/admin-only', {
        headers: { Cookie: `session=${id}` },
      })
      expect(res.status).toBe(403)
    })
  })
})
