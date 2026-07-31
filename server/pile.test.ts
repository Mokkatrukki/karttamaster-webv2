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

interface MarkerJson {
  id: string
  template_id: string | null
  pile_marker_ids: string[] | null
}

const PILE_BODY = {
  type: 'kerayskasa',
  lat: 65.1,
  lon: 27.5,
  distance_from_start: 1000,
  route_ids: ['35km'],
  template_id: 'kerayskasa',
  pile_marker_ids: ['m1', 'm2', 'm3'],
}

describe('T423/V314 — kasan sisältö persistoituu', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })
  afterEach(() => db.close())

  test('POST → GET roundtrip: pile_marker_ids säilyy taulukkona', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify(PILE_BODY),
    })
    expect(res.status).toBe(201)
    const created = await res.json() as MarkerJson
    expect(created.pile_marker_ids).toEqual(['m1', 'm2', 'm3'])

    const list = await (await app.request('/api/markers', {
      headers: authHeaders(db, 'talkoolainen'),
    })).json() as MarkerJson[]
    expect(list.find(m => m.id === created.id)?.pile_marker_ids).toEqual(['m1', 'm2', 'm3'])
  })

  test('PUT päivittää sisällön (hakija korjaa listaa)', async () => {
    const app = makeApp(db)
    const created = await (await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify(PILE_BODY),
    })).json() as MarkerJson

    const res = await app.request(`/api/markers/${created.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pile_marker_ids: ['m1', 'm2', 'm3', 'm4'] }),
    })
    expect(res.status).toBe(200)
    expect((await res.json() as MarkerJson).pile_marker_ids).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  test('tavallinen merkki ilman kenttää → null (ei kasa)', async () => {
    const app = makeApp(db)
    const created = await (await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'right', lat: 65, lon: 27, distance_from_start: 10, route_ids: ['35km'] }),
    })).json() as MarkerJson
    expect(created.pile_marker_ids).toBeNull()
  })

  test('vanha rivi ilman saraketta ei kaada listausta (V141-kuvio)', async () => {
    // Rivi suoraan kantaan ilman pile_marker_ids-arvoa = migraatiota edeltävä data.
    const id = randomUUID()
    db.run(
      `INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at)
       VALUES (?, 'right', 65, 27, 500, '["35km"]', 'kerätty', ?)`,
      [id, new Date().toISOString()],
    )
    const app = makeApp(db)
    const res = await app.request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect((await res.json() as MarkerJson[]).find(m => m.id === id)?.pile_marker_ids).toBeNull()
  })

  test('vioittunut JSON → null, ei 500 (V14-linja)', async () => {
    const id = randomUUID()
    db.run(
      `INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at, pile_marker_ids)
       VALUES (?, 'kerayskasa', 65, 27, 500, '["35km"]', 'suunniteltu', ?, '{ei json')`,
      [id, new Date().toISOString()],
    )
    const app = makeApp(db)
    const res = await app.request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect((await res.json() as MarkerJson[]).find(m => m.id === id)?.pile_marker_ids).toBeNull()
  })

  test('migraatio on idempotentti — 2. createDb samalle kannalle ei kaadu', () => {
    const path = `/tmp/pile-migration-${randomUUID()}.db`
    const a = createDb(path)
    a.close()
    const b = createDb(path)
    const cols = b.query<{ name: string }, []>('PRAGMA table_info(markers)').all()
    expect(cols.some(c => c.name === 'pile_marker_ids')).toBe(true)
    b.close()
  })
})
