import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { segmentRoutes } from './routes/segments'
import { markersRoutes } from './routes/markers'
import { authHeaders, seedTestUsers, cookieHeader } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

// T306/V217/B119: yleissalasana-sessio (talkoolainen_code = null) saa kenttätyöoikeuden
// KAIKKIIN pätkiin ja merkkeihin. Koodillinen legacy-sessio pitää vanhat pätkärajansa.
function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/segments', segmentRoutes)
  app.route('/api/markers', markersRoutes)
  return app
}

// Koodillinen legacy-sessio (code-login) — sidottu yhteen pätkään.
function codeSession(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Koodi-talkoolainen', expires],
  )
  return cookieHeader(id)
}

const VIERAS_SEG = {
  id: 'seg-vieras',
  routeIds: ['35km'],
  startDist: 0,
  endDist: 10000,
  displayName: 'Jonkun toisen pätkä',
  assignedCode: 'TOISEN-KOODI',
  phase: 'asettaminen',
  equipment: [],
}

describe('T306/V217 — yleissalasana-session kirjoitusoikeus', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
    await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify(VIERAS_SEG),
    })
  })

  describe('segments PUT', () => {
    test('kuittaa VIERAAN pätkän tarkastetuksi → 200 (B119 korjattu)', async () => {
      const res = await app.request(`/api/segments/${VIERAS_SEG.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true, inspectionNote: 'kaikki ok' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.inspected).toBe(true)
      expect(body.inspectionNote).toBe('kaikki ok')
    })

    test('completed + equipment + rajat vieraaseen pätkään → 200', async () => {
      const res = await app.request(`/api/segments/${VIERAS_SEG.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: true,
          equipment: [{ name: 'nauhaa', count: 2 }],
          startDist: 100,
          endDist: 9000,
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.completed).toBe(true)
      expect(body.equipment).toEqual([{ name: 'nauhaa', count: 2 }])
      expect(body.startDist).toBe(100)
    })

    test('järjestäjän kentät eivät muutu talkoolaisen PUT:sta (kenttäsuodatin ennallaan)', async () => {
      const res = await app.request(`/api/segments/${VIERAS_SEG.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'kaapattu', slug: 'kaapattu', assignedCode: 'KAAPATTU' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.description).toBeUndefined()
      expect(body.assignedCode).toBe('TOISEN-KOODI')
    })
  })

  describe('markers', () => {
    const MARKER = {
      id: 'm-1',
      type: 'nuoli',
      lat: 65.1,
      lon: 27.1,
      distance_from_start: 5000,
      route_ids: ['35km'],
      status: 'suunniteltu',
    }

    async function seedMarker(headers: Record<string, string>) {
      return app.request('/api/markers', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER),
      })
    }

    test('asettaa merkin vieraalle pätkälle → 201', async () => {
      const res = await seedMarker(authHeaders(db, 'talkoolainen'))
      expect(res.status).toBe(201)
    })

    test('kuittaa ja siirtää vieraan pätkän merkin → 200', async () => {
      await seedMarker(authHeaders(db, 'järjestäjä'))
      const res = await app.request(`/api/markers/${MARKER.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu', lat: 65.2, lon: 27.2, distance_from_start: 30000 }),
      })
      expect(res.status).toBe(200)
    })

    test('identiteettikenttä pysyy kiellettynä (V150 ennallaan)', async () => {
      await seedMarker(authHeaders(db, 'järjestäjä'))
      const res = await app.request(`/api/markers/${MARKER.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'kielto' }),
      })
      expect(res.status).toBe(403)
    })

    test('järjestäjän luomaa merkkiä ei saa poistaa (V151 säilyy)', async () => {
      await seedMarker(authHeaders(db, 'järjestäjä'))
      const res = await app.request(`/api/markers/${MARKER.id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('talkoolaisen luoman merkin saa poistaa (hyväksytty seuraus: ei hierarkiaa)', async () => {
      await seedMarker(authHeaders(db, 'talkoolainen'))
      const res = await app.request(`/api/markers/${MARKER.id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(200)
    })
  })

  describe('koodillinen legacy-sessio', () => {
    test('pitää pätkärajansa — vieras pätkä 403', async () => {
      const res = await app.request(`/api/segments/${VIERAS_SEG.id}`, {
        method: 'PUT',
        headers: { ...codeSession(db, 'JOKU-MUU'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true }),
      })
      expect(res.status).toBe(403)
    })

    test('oma pätkä → 200', async () => {
      const res = await app.request(`/api/segments/${VIERAS_SEG.id}`, {
        method: 'PUT',
        headers: { ...codeSession(db, 'TOISEN-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true }),
      })
      expect(res.status).toBe(200)
    })
  })
})
