import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  return app
}

interface MarkerJson {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  distance_from_start: number
  route_ids: string[]
  status: string
  location_note: string | null
  updated_at: string
  updated_by: string | null
}

const MARKER_BODY = {
  type: 'nuoli-oikealle',
  lat: 65.1,
  lon: 27.5,
  bearing: 90,
  distance_from_start: 1000,
  route_ids: ['35km'],
}

async function seedMarker(db: Database): Promise<string> {
  const app = makeApp(db)
  const res = await app.request('/api/markers', {
    method: 'POST',
    headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
    body: JSON.stringify(MARKER_BODY),
  })
  const body = await res.json() as MarkerJson
  return body.id
}

describe('T47: Markers REST API', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  afterEach(() => db.close())

  // ── GET /api/markers ────────────────────────────────────────────────────

  describe('GET /api/markers', () => {
    test('unauthenticated → 401', async () => {
      const res = await makeApp(db).request('/api/markers')
      expect(res.status).toBe(401)
    })

    test('admin sees markers when luonnos', async () => {
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'admin') })
      expect(res.status).toBe(200)
      expect(Array.isArray(await res.json())).toBe(true)
    })

    test('järjestäjä sees markers when luonnos', async () => {
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      expect(res.status).toBe(200)
    })

    test('V22: talkoolainen blocked when luonnos → 403', async () => {
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
      expect(res.status).toBe(403)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('map_not_ready')
    })

    test('V22: talkoolainen sees markers when hyväksytty', async () => {
      db.run("UPDATE map_state SET value = 'hyväksytty' WHERE key = 'status'")
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
      expect(res.status).toBe(200)
    })

    test('returns markers sorted by distance_from_start', async () => {
      const app = makeApp(db)
      // Insert two markers out of order
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }
      await app.request('/api/markers', {
        method: 'POST', headers,
        body: JSON.stringify({ ...MARKER_BODY, distance_from_start: 2000 }),
      })
      await app.request('/api/markers', {
        method: 'POST', headers,
        body: JSON.stringify({ ...MARKER_BODY, distance_from_start: 500 }),
      })
      const res = await app.request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const markers = await res.json() as MarkerJson[]
      expect(markers[0].distance_from_start).toBe(500)
      expect(markers[1].distance_from_start).toBe(2000)
    })

    test('route_ids returned as array (not JSON string)', async () => {
      await seedMarker(db)
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const markers = await res.json() as MarkerJson[]
      expect(Array.isArray(markers[0].route_ids)).toBe(true)
    })
  })

  // ── POST /api/markers ───────────────────────────────────────────────────

  describe('POST /api/markers', () => {
    test('järjestäjä creates marker → 201', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as MarkerJson
      expect(body.type).toBe(MARKER_BODY.type)
      expect(Array.isArray(body.route_ids)).toBe(true)
      expect(body.status).toBe('suunniteltu')
    })

    test('updated_by set to display_name', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      const body = await res.json() as MarkerJson
      expect(body.updated_by).toBe('Testi Järjestäjä')
    })

    test('talkoolainen cannot create marker → 403', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      expect(res.status).toBe(403)
    })

    test('missing required fields → 400', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'nuoli-oikealle' }),
      })
      expect(res.status).toBe(400)
    })

    test('unauthenticated → 401', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      expect(res.status).toBe(401)
    })
  })

  // ── PUT /api/markers/:id ────────────────────────────────────────────────

  describe('PUT /api/markers/:id', () => {
    test('talkoolainen can update status', async () => {
      db.run("UPDATE map_state SET value = 'hyväksytty' WHERE key = 'status'")
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MarkerJson
      expect(body.status).toBe('asetettu')
    })

    test('talkoolainen cannot update position → 403', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 65.2, lon: 27.6 }),
      })
      expect(res.status).toBe(403)
    })

    test('järjestäjä can update position', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 65.2, lon: 27.6, bearing: 180 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MarkerJson
      expect(body.lat).toBe(65.2)
      expect(body.bearing).toBe(180)
    })

    test('updated_by set on status update', async () => {
      db.run("UPDATE map_state SET value = 'hyväksytty' WHERE key = 'status'")
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      const body = await res.json() as MarkerJson
      expect(body.updated_by).toBe('Testi Talkoolainen')
    })

    test('unknown marker → 404', async () => {
      const res = await makeApp(db).request('/api/markers/ei-ole', {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(404)
    })

    test('empty body → 400', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    test('unauthenticated → 401', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ── DELETE /api/markers/:id ─────────────────────────────────────────────

  describe('DELETE /api/markers/:id', () => {
    test('järjestäjä deletes marker → 200', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const row = db.query('SELECT id FROM markers WHERE id = ?').get(id)
      expect(row).toBeNull()
    })

    test('talkoolainen cannot delete → 403', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('unknown marker → 404', async () => {
      const res = await makeApp(db).request('/api/markers/ei-ole', {
        method: 'DELETE',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })

    test('unauthenticated → 401', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, { method: 'DELETE' })
      expect(res.status).toBe(401)
    })
  })
})
