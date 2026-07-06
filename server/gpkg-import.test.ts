import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { gpkgRoutes } from './routes/gpkg'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders } from './test-fixtures'
import { hasOgr2ogr, geoJSONToGpkg } from './gpkg/convert'
import { markersToGeoJSON } from './gpkg/geojson'
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

describe('POST /api/gpkg/import', () => {
  test('vaatii autentikoinnin', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/gpkg/import', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('talkoolainen ei pääse (vain admin/järjestäjä)', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/gpkg/import', {
      method: 'POST',
      headers: authHeaders(db, 'talkoolainen'),
    })
    expect(res.status).toBe(403)
  })

  const maybe = hasOgr2ogr() ? test : test.skip
  maybe(
    'olemassa oleva id päivittää type/lat/lon/description, status/route_ids koskematta; uusi id luo suunniteltu-merkin (vaatii ogr2ogr)',
    async () => {
      const app = makeApp(db)

      const createRes = await app.request('/api/markers', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'huolto',
          lat: 65.1,
          lon: 27.1,
          distance_from_start: 500,
          route_ids: ['r1'],
          status: 'asetettu',
          description: 'Alkuperäinen',
        }),
      })
      const existing = (await createRes.json()) as { id: string }

      const fc = markersToGeoJSON([
        { id: existing.id, type: 'nuoli-oikea', label: 'Käännösnuoli', lat: 65.2, lon: 27.2, description: 'Kaverin muokkaama' },
        { id: '', type: 'huolto', label: 'Uusi huolto', lat: 65.3, lon: 27.3, description: 'Uusi kaverilta' },
      ])
      // ogr2ogr generates its own fid if id is empty-string dupe risk avoided by giving a real uuid
      fc.features[1].properties.id = crypto.randomUUID()
      const gpkgBytes = await geoJSONToGpkg(fc, 'kyltit')

      const form = new FormData()
      form.set('file', new Blob([gpkgBytes], { type: 'application/geopackage+sqlite3' }), 'kyltit.gpkg')

      const res = await app.request('/api/gpkg/import', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { created: number; updated: number }
      expect(body).toEqual({ created: 1, updated: 1 })

      const rows = db
        .query<
          { id: string; type: string; label: string | null; description: string | null; status: string; route_ids: string },
          []
        >('SELECT id, type, label, description, status, route_ids FROM markers ORDER BY type ASC')
        .all()

      const updatedRow = rows.find((r) => r.id === existing.id)!
      expect(updatedRow.type).toBe('nuoli-oikea')
      expect(updatedRow.label).toBe('Käännösnuoli')
      expect(updatedRow.description).toBe('Kaverin muokkaama')
      expect(updatedRow.status).toBe('asetettu')
      expect(JSON.parse(updatedRow.route_ids)).toEqual(['r1'])

      const newRow = rows.find((r) => r.id !== existing.id)!
      expect(newRow.label).toBe('Uusi huolto')
      expect(newRow.status).toBe('suunniteltu')
      expect(JSON.parse(newRow.route_ids)).toEqual([])
    },
  )

  const maybe2 = hasOgr2ogr() ? test : test.skip
  maybe2('round-trip export→import säilyttää labelin (V98, vaatii ogr2ogr)', async () => {
    const app = makeApp(db)

    await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'huolto',
        lat: 65.1,
        lon: 27.1,
        distance_from_start: 500,
        route_ids: ['r1'],
        label: 'Huoltopiste',
        description: 'Alkuperäinen',
      }),
    })

    const exportRes = await app.request('/api/gpkg/export', { headers: authHeaders(db, 'järjestäjä') })
    expect(exportRes.status).toBe(200)
    const gpkgBytes = new Uint8Array(await exportRes.arrayBuffer())

    const form = new FormData()
    form.set('file', new Blob([gpkgBytes], { type: 'application/geopackage+sqlite3' }), 'kyltit.gpkg')
    const importRes = await app.request('/api/gpkg/import', {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
      body: form,
    })
    expect(importRes.status).toBe(200)

    const row = db.query<{ label: string | null }, []>('SELECT label FROM markers LIMIT 1').get()!
    expect(row.label).toBe('Huoltopiste')
  })
})
