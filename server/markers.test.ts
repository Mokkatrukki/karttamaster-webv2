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

    test('admin sees markers', async () => {
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'admin') })
      expect(res.status).toBe(200)
      expect(Array.isArray(await res.json())).toBe(true)
    })

    test('järjestäjä sees markers', async () => {
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      expect(res.status).toBe(200)
    })

    test('talkoolainen always sees markers', async () => {
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
        body: JSON.stringify({ lat: 65.2, lon: 27.6 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MarkerJson
      expect(body.lat).toBe(65.2)
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

  // ── T103: description + images ──────────────────────────────────────────

  describe('PUT /api/markers/:id — description', () => {
    test('järjestäjä asettaa kuvauksen', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Kiinnitä puuhun, näkyy tieltä' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MarkerJson & { description: string | null }
      expect(body.description).toBe('Kiinnitä puuhun, näkyy tieltä')
    })

    test('talkoolainen ei voi asettaa kuvausta → 403', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'yritys' }),
      })
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/markers — images', () => {
    test('merkillä on tyhjä images-lista oletuksena', async () => {
      await seedMarker(db)
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const body = await res.json() as Array<MarkerJson & { images: string[] }>
      expect(body[0].images).toEqual([])
    })
  })

  describe('POST /api/markers/:id/images', () => {
    test('järjestäjä lataa kuvan → palauttaa url', async () => {
      const id = await seedMarker(db)
      const form = new FormData()
      form.append('image', makeUploadFile())
      const res = await makeApp(db).request(`/api/markers/${id}/images`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(201)
      const body = await res.json() as { url: string }
      expect(body.url).toMatch(new RegExp(`^/api/markers/${id}/images/`))
    })

    test('kuva näkyy sen jälkeen GET /api/markers images-listassa', async () => {
      const id = await seedMarker(db)
      const form = new FormData()
      form.append('image', makeUploadFile())
      await makeApp(db).request(`/api/markers/${id}/images`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const body = await res.json() as Array<MarkerJson & { images: string[] }>
      expect(body[0].images.length).toBe(1)
    })

    test('talkoolainen ei voi ladata kuvaa → 403', async () => {
      const id = await seedMarker(db)
      const form = new FormData()
      form.append('image', makeUploadFile())
      const res = await makeApp(db).request(`/api/markers/${id}/images`, {
        method: 'POST',
        headers: authHeaders(db, 'talkoolainen'),
        body: form,
      })
      expect(res.status).toBe(403)
    })

    test('ei-kuva-tiedosto hylätään → 400', async () => {
      const id = await seedMarker(db)
      const form = new FormData()
      form.append('image', new File(['not an image'], 'note.txt', { type: 'text/plain' }))
      const res = await makeApp(db).request(`/api/markers/${id}/images`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(400)
    })

    test('tuntematon merkki → 404', async () => {
      const form = new FormData()
      form.append('image', makeUploadFile())
      const res = await makeApp(db).request('/api/markers/ei-ole/images', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/markers/:id/images/:imageId', () => {
    test('palauttaa kuvan oikealla content-typellä', async () => {
      const id = await seedMarker(db)
      const form = new FormData()
      form.append('image', makeUploadFile())
      const uploadRes = await makeApp(db).request(`/api/markers/${id}/images`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      const { url } = await uploadRes.json() as { url: string }

      const res = await makeApp(db).request(url, { headers: authHeaders(db, 'talkoolainen') })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/jpeg')
      const bytes = new Uint8Array(await res.arrayBuffer())
      expect(bytes.length).toBeGreaterThan(0)
    })

    test('tuntematon kuva → 404', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}/images/ei-ole`, {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })

    test('unauthenticated → 401', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}/images/ei-ole`)
      expect(res.status).toBe(401)
    })
  })
})

function makeUploadFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'kuva.jpg', { type: 'image/jpeg' })
}
