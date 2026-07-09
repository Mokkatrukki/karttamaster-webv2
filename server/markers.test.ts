import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  return app
}

// Luo pätkä suoraan kantaan (markers.test ei reititä /api/segments)
function seedSegment(db: Database, opts: { code: string; routeIds?: string[]; startDist?: number; endDist?: number; linkedMarkerIds?: string[]; markerTypeFilter?: string }): void {
  db.run(
    `INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at, linked_marker_ids, marker_type_filter)
     VALUES (?, ?, ?, ?, ?, '[]', 'asettaminen', ?, ?, ?)`,
    [
      randomUUID(),
      opts.routeIds ? JSON.stringify(opts.routeIds) : null,
      opts.startDist ?? null,
      opts.endDist ?? null,
      opts.code.toUpperCase(),
      new Date().toISOString(),
      opts.linkedMarkerIds ? JSON.stringify(opts.linkedMarkerIds) : null,
      opts.markerTypeFilter ?? null,
    ],
  )
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

// T222/V150: koodiin sidottu talkoolainen-sessio (fixture jättää talkoolainen_code=null).
function talkoolainenCodeHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

// Pätkä joka kattaa MARKER_BODY:n (route 35km, dist 1000 ∈ [0,5000]) ja on assignattu koodille.
function seedOwnedSegment(db: Database, code: string): void {
  db.run(
    "INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 'asettaminen', ?)",
    [randomUUID(), JSON.stringify(['35km']), 0, 5000, code, new Date().toISOString()],
  )
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

    test('T196: image_id säilyy roundtripissä (POST → GET)', async () => {
      const url = '/api/templates/wc/images/uuid-1'
      const postRes = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, image_id: url }),
      })
      const created = await postRes.json() as MarkerJson & { image_id: string | null }
      expect(created.image_id).toBe(url)

      const getRes = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
      const list = await getRes.json() as Array<MarkerJson & { image_id: string | null }>
      expect(list.find(m => m.id === created.id)?.image_id).toBe(url)
    })

    // T215/V143: template_id denormalisoitu markerille (dynaaminen markerTypeFilter-osuma)
    test('T215: template_id säilyy roundtripissä (POST → GET)', async () => {
      const postRes = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, template_id: 'keräyskasa' }),
      })
      const created = await postRes.json() as MarkerJson & { template_id: string | null }
      expect(created.template_id).toBe('keräyskasa')

      const getRes = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
      const list = await getRes.json() as Array<MarkerJson & { template_id: string | null }>
      expect(list.find(m => m.id === created.id)?.template_id).toBe('keräyskasa')
    })

    test('T215: PUT päivittää template_id:n (uudelleentyypitys)', async () => {
      const postRes = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, template_id: 'wc' }),
      })
      const created = await postRes.json() as MarkerJson & { template_id: string | null }

      const putRes = await makeApp(db).request(`/api/markers/${created.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: 'keräyskasa' }),
      })
      const updated = await putRes.json() as MarkerJson & { template_id: string | null }
      expect(updated.template_id).toBe('keräyskasa')
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

    test('talkoolainen ilman pätkää ei voi luoda merkkiä → 403 (V149)', async () => {
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'PÄTKÄTÖN'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      expect(res.status).toBe(403)
    })

    // V149/T219: talkoolainen saa lisätä merkin OMALLE pätkälleen (segment-scoped, ei tyyppirajausta)
    test('V149: talkoolainen luo merkin omalle reitilliselle pätkälleen (osuu rangeen) → 201', async () => {
      seedSegment(db, { code: 'OMA1', routeIds: ['35km'], startDist: 0, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA1'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY), // distance_from_start: 1000, route_ids: ['35km']
      })
      expect(res.status).toBe(201)
      const body = await res.json() as MarkerJson
      expect(body.distance_from_start).toBe(1000)
      expect(body.updated_by).toBe('Testi Talkoolainen')
    })

    test('V149: talkoolaisen merkki pätkän rangen ULKOPUOLELLA → 403', async () => {
      seedSegment(db, { code: 'OMA2', routeIds: ['35km'], startDist: 2000, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA2'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY), // distance 1000 < startDist 2000 → ulkona
      })
      expect(res.status).toBe(403)
    })

    test('V149: talkoolaisen merkki eri reitillä kuin pätkä → 403', async () => {
      seedSegment(db, { code: 'OMA3', routeIds: ['20km'], startDist: 0, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA3'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY), // route_ids ['35km'] ∩ ['20km'] = ∅
      })
      expect(res.status).toBe(403)
    })

    test('V149: talkoolainen luo merkin reitittömälle pätkälleen → 201 (V139, ei range-tarkistusta)', async () => {
      seedSegment(db, { code: 'ALUE1' }) // reititön: route/start/end null
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'ALUE1'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      expect(res.status).toBe(201)
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
    // T222/V150: talkoolainen saa muuttaa statuksen VAIN oman pätkän merkissä.
    test('talkoolainen can update status on OWN segment marker', async () => {
      db.run("UPDATE map_state SET value = 'hyväksytty' WHERE key = 'status'")
      const id = await seedMarker(db)
      seedOwnedSegment(db, 'OMA-KOODI')
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MarkerJson
      expect(body.status).toBe('asetettu')
    })

    // V150 (aukon sulku): talkoolainen jolla EI ole merkkiä kattavaa pätkää → 403 (myös statukselle).
    test('talkoolainen EI voi muuttaa vieraan merkin statusta → 403', async () => {
      const id = await seedMarker(db)
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'VIERAS-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(403)
    })

    // T222/V150: talkoolainen saa siirtää oman pätkän merkkiä range-sisällä.
    test('talkoolainen voi siirtää oman merkin range-sisällä → 200', async () => {
      const id = await seedMarker(db)
      seedOwnedSegment(db, 'OMA-KOODI')
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 65.11, lon: 27.51, distance_from_start: 2000, route_ids: ['35km'] }),
      })
      expect(res.status).toBe(200)
      expect((await res.json() as MarkerJson).lat).toBe(65.11)
    })

    // V150b: talkoolainen ei saa raahata merkkiä ulos omasta pätkästä (uusi dist ∉ range) → 403.
    test('talkoolainen ei voi siirtää merkkiä ulos pätkästä → 403', async () => {
      const id = await seedMarker(db)
      seedOwnedSegment(db, 'OMA-KOODI') // range [0,5000]
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance_from_start: 9000, route_ids: ['35km'] }),
      })
      expect(res.status).toBe(403)
    })

    // V150: identiteettikentät (tyyppi/kuvaus/ikoni) vain järjestäjä+ — talkoolaiselta 403.
    test('talkoolainen EI voi muuttaa merkin tyyppiä (identiteetti) → 403', async () => {
      const id = await seedMarker(db)
      seedOwnedSegment(db, 'OMA-KOODI')
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'nuoli-vasemmalle' }),
      })
      expect(res.status).toBe(403)
    })

    test('codeless talkoolainen ei voi muuttaa position → 403', async () => {
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

    test('updated_by set on status update (oma pätkä)', async () => {
      db.run("UPDATE map_state SET value = 'hyväksytty' WHERE key = 'status'")
      const id = await seedMarker(db)
      seedOwnedSegment(db, 'OMA-KOODI')
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA-KOODI'), 'Content-Type': 'application/json' },
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

  describe('T170/V106: icon_id roundtrip', () => {
    test('POST tallentaa icon_id ja GET palauttaa sen', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, icon_id: 'wrench' }),
      })
      const body = await res.json() as { icon_id: string | null }
      expect(body.icon_id).toBe('wrench')

      const getRes = await app.request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const rows = await getRes.json() as { icon_id: string | null }[]
      expect(rows[0].icon_id).toBe('wrench')
    })

    test('PUT päivittää icon_id:n', async () => {
      const id = await seedMarker(db)
      const app = makeApp(db)
      const res = await app.request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon_id: 'map-pin' }),
      })
      const body = await res.json() as { icon_id: string | null }
      expect(body.icon_id).toBe('map-pin')
    })
  })

  describe('T172/V107: parts_json roundtrip (yhdistelmämerkki)', () => {
    const parts = JSON.stringify([{ iconId: 'flag' }, { iconId: 'wrench' }])

    test('POST tallentaa parts_json ja GET palauttaa sen', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, parts_json: parts }),
      })
      const body = await res.json() as { parts_json: string | null }
      expect(JSON.parse(body.parts_json!)).toEqual([{ iconId: 'flag' }, { iconId: 'wrench' }])

      const getRes = await app.request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
      const rows = await getRes.json() as { parts_json: string | null }[]
      expect(JSON.parse(rows[0].parts_json!)).toEqual([{ iconId: 'flag' }, { iconId: 'wrench' }])
    })

    test('PUT päivittää parts_json:n', async () => {
      const id = await seedMarker(db)
      const app = makeApp(db)
      const res = await app.request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts_json: parts }),
      })
      const body = await res.json() as { parts_json: string | null }
      expect(JSON.parse(body.parts_json!)).toEqual([{ iconId: 'flag' }, { iconId: 'wrench' }])
    })
  })

  // ── Ownership-unioni (bugikorjaus): frontend resolveTaskMarkers ∪ ⊥ backend range-only ──
  // Frontend näyttää pätkän merkit unionina (route+dist ∪ linked_marker_ids ∪ marker_type_filter);
  // backend tarkisti VAIN rangen → link/typeFilter-merkin "Aseta" sai 403. Kanoninen sääntö korjaa.
  describe('Ownership-unioni: link/typeFilter + ε (bugikorjaus)', () => {
    test('talkoolainen muuttaa statusta linked_marker_ids-merkille (range ei täsmää) → 200', async () => {
      const id = await seedMarker(db) // route 35km, dist 1000
      // Pätkä eri reitillä (route-match epäonnistuu) MUTTA merkki eksplisiittisesti liitetty.
      seedSegment(db, { code: 'LINK1', routeIds: ['20km'], startDist: 0, endDist: 500, linkedMarkerIds: [id] })
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'LINK1'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(200)
    })

    test('talkoolainen muuttaa statusta marker_type_filter-merkille (range ei täsmää) → 200', async () => {
      // Merkki template_id 'keräyskasa', pätkä eri reitillä mutta typeFilter täsmää.
      const app = makeApp(db)
      const postRes = await app.request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, template_id: 'keräyskasa' }),
      })
      const id = (await postRes.json() as MarkerJson).id
      seedSegment(db, { code: 'TYPE1', routeIds: ['20km'], startDist: 0, endDist: 500, markerTypeFilter: 'keräyskasa' })
      const res = await app.request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'TYPE1'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(200)
    })

    test('talkoolainen POST typeFilter-merkin (route ei täsmää) → 201', async () => {
      seedSegment(db, { code: 'TYPE2', routeIds: ['20km'], startDist: 0, endDist: 500, markerTypeFilter: 'keräyskasa' })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'TYPE2'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...MARKER_BODY, template_id: 'keräyskasa' }), // route 35km ∌ 20km
      })
      expect(res.status).toBe(201)
    })

    test('V149 ε: merkki juuri pätkän reunan ulkopuolella (<50m) → 201', async () => {
      seedSegment(db, { code: 'EPS1', routeIds: ['35km'], startDist: 1030, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'EPS1'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY), // dist 1000, startDist 1030 → 30m ulkona < ε(50)
      })
      expect(res.status).toBe(201)
    })

    test('ε ei laajenna liikaa: merkki >50m pätkän ulkopuolella → 403', async () => {
      seedSegment(db, { code: 'EPS2', routeIds: ['35km'], startDist: 1100, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'EPS2'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY), // dist 1000, startDist 1100 → 100m ulkona > ε(50)
      })
      expect(res.status).toBe(403)
    })
  })

  // ── T226/V152: audit-loki + created_by ──────────────────────────────────
  describe('T226: marker_audit + created_by', () => {
    function auditRows(id: string): Array<{ action: string; segment_code: string | null; payload_json: string | null; actor_role: string }> {
      return db.query<{ action: string; segment_code: string | null; payload_json: string | null; actor_role: string }, [string]>(
        'SELECT action, segment_code, payload_json, actor_role FROM marker_audit WHERE marker_id = ? ORDER BY created_at ASC',
      ).all(id)
    }

    test('POST kirjaa add-audit-rivin', async () => {
      const id = await seedMarker(db)
      const rows = auditRows(id)
      expect(rows.length).toBe(1)
      expect(rows[0].action).toBe('add')
      expect(rows[0].actor_role).toBe('järjestäjä')
    })

    test('järjestäjän merkin created_by = display_name, segment_code null', async () => {
      const id = await seedMarker(db)
      const row = db.query<{ created_by: string | null }, [string]>('SELECT created_by FROM markers WHERE id = ?').get(id)!
      expect(row.created_by).toBe('Testi Järjestäjä')
      expect(auditRows(id)[0].segment_code).toBeNull()
    })

    test('talkoolaisen merkin created_by = talkoolainen_code, audit segment_code = code', async () => {
      seedSegment(db, { code: 'OMA9', routeIds: ['35km'], startDist: 0, endDist: 5000 })
      const res = await makeApp(db).request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'OMA9'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      const id = (await res.json() as MarkerJson).id
      const row = db.query<{ created_by: string | null }, [string]>('SELECT created_by FROM markers WHERE id = ?').get(id)!
      expect(row.created_by).toBe('OMA9')
      expect(auditRows(id)[0].segment_code).toBe('OMA9')
    })

    test('PUT status kirjaa status-audit ENNEN-tilalla', async () => {
      const id = await seedMarker(db)
      await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      const statusRow = auditRows(id).find(r => r.action === 'status')!
      expect(statusRow).toBeDefined()
      expect(JSON.parse(statusRow.payload_json!)).toEqual({ status: 'suunniteltu' })
    })

    test('PUT move kirjaa move-audit vanhoilla koordinaateilla', async () => {
      const id = await seedMarker(db) // lat 65.1, lon 27.5, dist 1000
      await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 65.2, lon: 27.6, distance_from_start: 2000, route_ids: ['35km'] }),
      })
      const moveRow = auditRows(id).find(r => r.action === 'move')!
      expect(moveRow).toBeDefined()
      const p = JSON.parse(moveRow.payload_json!)
      expect(p.lat).toBe(65.1)
      expect(p.distance_from_start).toBe(1000)
    })

    test('DELETE kirjaa remove-audit', async () => {
      const id = await seedMarker(db)
      await makeApp(db).request(`/api/markers/${id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
      const rows = auditRows(id)
      expect(rows.some(r => r.action === 'remove')).toBe(true)
    })

    test('identiteetti-vain-PUT (description) ei kirjaa audit-riviä', async () => {
      const id = await seedMarker(db)
      await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'ohje' }),
      })
      // vain POST-add kirjattu, ei description-muutosta
      expect(auditRows(id).filter(r => r.action !== 'add').length).toBe(0)
    })
  })

  // ── T225/V151: talkoolaisen kova-poisto vain oma itse-luoma ──────────────
  describe('T225: talkoolainen DELETE', () => {
    test('talkoolainen kovapoistaa OMAN itse-luomansa merkin omalla pätkällä → 200', async () => {
      seedSegment(db, { code: 'DEL1', routeIds: ['35km'], startDist: 0, endDist: 5000 })
      const app = makeApp(db)
      const postRes = await app.request('/api/markers', {
        method: 'POST',
        headers: { ...talkoolainenCodeHeaders(db, 'DEL1'), 'Content-Type': 'application/json' },
        body: JSON.stringify(MARKER_BODY),
      })
      const id = (await postRes.json() as MarkerJson).id
      const res = await app.request(`/api/markers/${id}`, {
        method: 'DELETE',
        headers: talkoolainenCodeHeaders(db, 'DEL1'),
      })
      expect(res.status).toBe(200)
      expect(db.query('SELECT id FROM markers WHERE id = ?').get(id)).toBeNull()
    })

    test('talkoolainen EI kovapoista järjestäjän suunnittelemaa merkkiä (created_by≠oma) → 403', async () => {
      const id = await seedMarker(db) // created_by = 'Testi Järjestäjä'
      seedSegment(db, { code: 'DEL2', routeIds: ['35km'], startDist: 0, endDist: 5000 })
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'DELETE',
        headers: talkoolainenCodeHeaders(db, 'DEL2'),
      })
      expect(res.status).toBe(403)
      expect(db.query('SELECT id FROM markers WHERE id = ?').get(id)).not.toBeNull()
    })

    test('talkoolainen EI poista toisen pätkän merkkiä vaikka itse-luoma-koodi puuttuu → 403', async () => {
      const id = await seedMarker(db)
      // ei pätkää tälle koodille → owns=false
      const res = await makeApp(db).request(`/api/markers/${id}`, {
        method: 'DELETE',
        headers: talkoolainenCodeHeaders(db, 'VIERAS-DEL'),
      })
      expect(res.status).toBe(403)
    })
  })
})

function makeUploadFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'kuva.jpg', { type: 'image/jpeg' })
}
