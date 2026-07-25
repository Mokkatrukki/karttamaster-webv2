import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { segmentRoutes } from './routes/segments'
import { authHeaders, seedTestUsers } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

// T301/V213/B115: backendin ownership-tarkistus ! käyttää SAMAA km-lähdettä kuin frontendin
// resolveTaskMarkers. Muuten talkoolainen näkee merkin pätkälistallaan mutta saa siitä 403:n
// (B100-oppi toisin päin). r1 ja r2 jakavat polun: sama kohta on r1:llä 10 km, r2:lla 50 km.

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  app.route('/api/segments', segmentRoutes)
  return app
}

function talkooHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

/** Pätkä jonka km-väli on mitattu `primary`-reittiä vasten, assignattu koodille. */
function seedSegment(
  db: Database,
  opts: { code: string; routeIds: string[]; primary: string | null; start: number; end: number },
): void {
  db.run(
    `INSERT INTO segments (id, route_ids, primary_route_id, start_dist, end_dist, assigned_code, equipment, phase, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 'asettaminen', ?)`,
    [randomUUID(), JSON.stringify(opts.routeIds), opts.primary, opts.start, opts.end,
      opts.code.toUpperCase(), new Date().toISOString()],
  )
}

const MARKER = {
  type: 'nuoli',
  lat: 65.1,
  lon: 25.1,
  status: 'suunniteltu',
  route_ids: ['r1', 'r2'],
  // sama fyysinen kohta, eri km per reitti
  distance_from_start: 10000,
  distance_by_route: { r1: [10000], r2: [50000] },
}

describe('T301/V213 — kerrokset samasta km-lähteestä', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  test('migraatio on idempotentti (createDb ajetaan kahdesti samalle skeemalle)', () => {
    const cols = db.query<{ name: string }, []>('PRAGMA table_info(markers)').all()
    expect(cols.some(c => c.name === 'distance_by_route')).toBe(true)
    const segCols = db.query<{ name: string }, []>('PRAGMA table_info(segments)').all()
    expect(segCols.some(c => c.name === 'primary_route_id')).toBe(true)
  })

  test('distance_by_route roundtrippaa POST → GET', async () => {
    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ ...MARKER, id: 'm1' }),
    })
    expect(res.status).toBe(201)

    const get = await app.request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
    const rows = await get.json() as Array<{ id: string; distance_by_route: Record<string, number[]> | null }>
    expect(rows.find(r => r.id === 'm1')?.distance_by_route).toEqual({ r1: [10000], r2: [50000] })
  })

  test('legacy-merkki ilman karttaa → distance_by_route null, ei kaadu', async () => {
    const { distance_by_route: _drop, ...legacy } = MARKER
    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ ...legacy, id: 'legacy' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { distance_by_route: unknown }
    expect(body.distance_by_route).toBeNull()
  })

  // Ydin: talkoolaisen pätkä on r2:lla km-välillä [9000,11000]. Merkki on r2:lla 50 km
  // kohdalla — se EI kuulu pätkään, vaikka sen r1-km (10000) osuisi väliin.
  test('naapurireitin km-väli ei enää anna oikeutta vieraaseen merkkiin', async () => {
    db.run('INSERT INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
      ['KOODI1', 'Testi', new Date().toISOString()])
    seedSegment(db, { code: 'KOODI1', routeIds: ['r2'], primary: 'r2', start: 9000, end: 11000 })

    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...talkooHeaders(db, 'KOODI1') },
      body: JSON.stringify({ ...MARKER, id: 'vieras' }),
    })
    expect(res.status).toBe(403)
  })

  test('oman pätkän km-välille osuva merkki menee läpi', async () => {
    db.run('INSERT INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
      ['KOODI2', 'Testi', new Date().toISOString()])
    seedSegment(db, { code: 'KOODI2', routeIds: ['r2'], primary: 'r2', start: 49000, end: 51000 })

    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...talkooHeaders(db, 'KOODI2') },
      body: JSON.stringify({ ...MARKER, id: 'oma' }),
    })
    expect(res.status).toBe(201)
  })

  test('legacy-pätkä ilman primary_route_id → route_ids[0] on akseli', async () => {
    db.run('INSERT INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
      ['KOODI3', 'Testi', new Date().toISOString()])
    seedSegment(db, { code: 'KOODI3', routeIds: ['r2'], primary: null, start: 49000, end: 51000 })

    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...talkooHeaders(db, 'KOODI3') },
      body: JSON.stringify({ ...MARKER, id: 'legacy-seg' }),
    })
    expect(res.status).toBe(201)
  })

  test('legacy-merkki ilman karttaa käyttää distance_from_startia (entinen käytös)', async () => {
    db.run('INSERT INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
      ['KOODI4', 'Testi', new Date().toISOString()])
    seedSegment(db, { code: 'KOODI4', routeIds: ['r2'], primary: 'r2', start: 9000, end: 11000 })

    const { distance_by_route: _drop, ...legacy } = MARKER
    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...talkooHeaders(db, 'KOODI4') },
      body: JSON.stringify({ ...legacy, id: 'legacy-marker' }),
    })
    // distance_from_start = 10000 osuu [9000,11000] → sallitaan, kuten ennen T300:aa
    expect(res.status).toBe(201)
  })
})
