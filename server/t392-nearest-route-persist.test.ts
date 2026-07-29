import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { authHeaders, seedTestUsers } from './test-fixtures'
import type { Database } from 'bun:sqlite'

// T392/V284 — merkin lähin reitti persistoituu. Serveri EI johda arvoa (reittigeometriaa ⊥ ole
// kannassa) ∴ sen ainoa tehtävä on säilyttää & palauttaa se muuttumattomana; hukattu kenttä
// palauttaisi jäsenyyden vanhaan käytökseen hiljaa.

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  return app
}

const BASE = {
  type: 'nuoli', lat: 65.6, lon: 27.5,
  distance_from_start: 100, route_ids: ['r1'], status: 'suunniteltu',
}

describe('T392 — nearest_route_id / nearest_route_dist_m', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  const post = (body: Record<string, unknown>) =>
    app.request('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify(body),
    })

  const list = async () =>
    (await (await app.request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })).json()) as Array<Record<string, unknown>>

  test('POST tallentaa & GET palauttaa — sarake ⊥ putoa eksplisiittisestä INSERT-listasta', async () => {
    const res = await post({ ...BASE, id: 'm1', nearest_route_id: 'r2', nearest_route_dist_m: 42.5 })
    expect(res.status).toBe(201)

    const got = await list()
    expect(got[0].nearest_route_id).toBe('r2')
    expect(got[0].nearest_route_dist_m).toBe(42.5)
  })

  test('vanha merkki ilman kenttiä → null (välitila on laillinen, ⊥ virhe)', async () => {
    await post({ ...BASE, id: 'm2' })
    const got = await list()
    expect(got[0].nearest_route_id).toBeNull()
    expect(got[0].nearest_route_dist_m).toBeNull()
  })

  test('PUT backfillaa vanhan merkin & muut kentät säilyvät', async () => {
    await post({ ...BASE, id: 'm3', location_note: 'kelo polulla' })
    const res = await app.request('/api/markers/m3', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ nearest_route_id: 'r1', nearest_route_dist_m: 12 }),
    })
    expect(res.status).toBe(200)

    const got = await list()
    expect(got[0].nearest_route_id).toBe('r1')
    expect(got[0].nearest_route_dist_m).toBe(12)
    expect(got[0].location_note).toBe('kelo polulla')
  })

  test('PUT joka ⊥ mainitse kenttiä säilyttää ne (siirto ⊥ pyyhi jäsenyysperustetta)', async () => {
    await post({ ...BASE, id: 'm4', nearest_route_id: 'r1', nearest_route_dist_m: 8 })
    await app.request('/api/markers/m4', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ status: 'asetettu' }),
    })

    const got = await list()
    expect(got[0].nearest_route_id).toBe('r1')
    expect(got[0].nearest_route_dist_m).toBe(8)
    expect(got[0].status).toBe('asetettu')
  })
})
