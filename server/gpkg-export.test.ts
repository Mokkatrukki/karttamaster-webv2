import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { gpkgRoutes } from './routes/gpkg'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders } from './test-fixtures'
import { hasOgr2ogr } from './gpkg/convert'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  app.route('/api/gpkg', gpkgRoutes)
  return app
}

let db: Database
beforeEach(() => {
  db = createDb(':memory:')
  seedTestUsers(db)
})
afterEach(() => db.close())

describe('GET /api/gpkg/export', () => {
  test('vaatii autentikoinnin', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/gpkg/export')
    expect(res.status).toBe(401)
  })

  test('talkoolainen ei pääse (vain admin/järjestäjä)', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/gpkg/export', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(403)
  })

  const maybe = hasOgr2ogr() ? test : test.skip
  maybe('järjestäjä lataa .gpkg-tiedoston sisältäen luodun merkin (vaatii ogr2ogr)', async () => {
    const app = makeApp(db)
    await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'huolto', lat: 65.1, lon: 27.1, bearing: 0, description: 'Testi' }),
    })
    const res = await app.request('/api/gpkg/export', { headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('kyltit.gpkg')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
