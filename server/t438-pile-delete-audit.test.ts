// T438/V323/V231: kasan poisto on kaksi datamuutosta — merkit takaisin avoimiksi & kasa pois.
// Molemmat kulkevat olemassa olevaa reittiä ∴ loki kertoo kuka poisti, milloin & mitkä merkit
// palautuivat. Poistorivin payload ! kantaa `pile_marker_ids` — ilman sitä "mitkä merkit"
// katoaisi historiasta sillä hetkellä kun kasa poistetaan (V231, V21-suku).
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { auditRoutes } from './routes/audit'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  app.route('/api/audit', auditRoutes)
  return app
}

interface MarkerJson { id: string; status: string; pile_marker_ids: string[] | null }
interface AuditRow { marker_id: string; action: string; actor: string; payload: Record<string, unknown> | null }

const BASE = { type: 'nuoli-oikealle', lat: 65.1, lon: 27.5, distance_from_start: 1000, route_ids: ['35km'] }

describe('T438/V323 — kasan poisto lokissa', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
  afterEach(() => db.close())

  async function create(db: Database, body: Record<string, unknown>): Promise<MarkerJson> {
    return await (await makeApp(db).request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...BASE, ...body }),
    })).json() as MarkerJson
  }

  test('palautus + poisto: merkit avoimia, kasa poissa, loki kantaa sisällön', async () => {
    const app = makeApp(db)
    const m1 = await create(db, { status: 'kerätty' })
    const m2 = await create(db, { status: 'kerätty', distance_from_start: 1200 })
    const kasa = await create(db, {
      type: 'kerayskasa', template_id: 'kerayskasa', pile_marker_ids: [m1.id, m2.id],
    })

    // 1) sisältö takaisin purun avoimeen statukseen
    for (const id of [m1.id, m2.id]) {
      const res = await app.request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(res.status).toBe(200)
    }
    // 2) kasa pois
    const del = await app.request(`/api/markers/${kasa.id}`, {
      method: 'DELETE',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(del.status).toBe(200)

    const list = await (await app.request('/api/markers', {
      headers: authHeaders(db, 'talkoolainen'),
    })).json() as MarkerJson[]
    expect(list.find(m => m.id === kasa.id)).toBeUndefined()
    expect(list.filter(m => m.status === 'asetettu').map(m => m.id).sort()).toEqual([m1.id, m2.id].sort())

    const rows = await (await app.request('/api/audit', {
      headers: authHeaders(db, 'järjestäjä'),
    })).json() as AuditRow[]
    const remove = rows.find(r => r.marker_id === kasa.id && r.action === 'remove')
    expect(remove).toBeDefined()
    // "mitkä merkit palautuivat" luettavissa poistorivin payloadista
    expect(JSON.stringify(remove!.payload)).toContain(m1.id)
    expect(JSON.stringify(remove!.payload)).toContain(m2.id)
    // "kuka perui mitäkin" — palautus per merkki omana rivinään, ennen-tila `kerätty`
    for (const id of [m1.id, m2.id]) {
      const status = rows.find(r => r.marker_id === id && r.action === 'status')
      expect(status?.payload?.status).toBe('kerätty')
    }
  })

  test('naapurikasa & sen sisältö eivät liiku poiston mukana', async () => {
    const app = makeApp(db)
    const mine = await create(db, { status: 'kerätty' })
    const other = await create(db, { status: 'kerätty', distance_from_start: 3000 })
    const kasaA = await create(db, { type: 'kerayskasa', template_id: 'kerayskasa', pile_marker_ids: [mine.id] })
    const kasaB = await create(db, { type: 'kerayskasa', template_id: 'kerayskasa', pile_marker_ids: [other.id] })

    await app.request(`/api/markers/${mine.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'asetettu' }),
    })
    await app.request(`/api/markers/${kasaA.id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })

    const list = await (await app.request('/api/markers', {
      headers: authHeaders(db, 'talkoolainen'),
    })).json() as MarkerJson[]
    expect(list.find(m => m.id === kasaB.id)?.pile_marker_ids).toEqual([other.id])
    expect(list.find(m => m.id === other.id)?.status).toBe('kerätty')
  })
})
