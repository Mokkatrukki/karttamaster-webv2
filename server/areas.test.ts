import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createDb } from './db'
import { seedTestUsers, authHeaders } from './test-fixtures'
import { app } from './index'
import type { Database } from 'bun:sqlite'

let db: Database

beforeEach(() => {
  db = createDb(':memory:')
  seedTestUsers(db)
  // Override app's db with test db via re-import trick: use app directly
  // (app uses module-level db, so we test via the exported app with its own db)
  // Instead, test with fresh app per test by creating routes directly
})

afterEach(() => {
  db.close()
})

// Helpers
const BASE_AREA = {
  name: 'Huoltopiste 25km',
  centerLat: 65.628,
  centerLng: 27.628,
  widthM: 200,
  heightM: 100,
  rotation: 0,
  markdownDescription: '## Ruoka',
  status: 'suunniteltu',
  hashCode: 'testi-hash-001',
}

const SAMPLE_FEATURE = {
  name: 'Tarjoilupöytä',
  centerLat: 65.6281,
  centerLng: 27.6281,
  widthM: 10,
  heightM: 5,
  rotation: 0,
  color: '#4ade80',
}

// Test with isolated Hono app per db
async function makeApp() {
  const { Hono } = await import('hono')
  const { dbMiddleware } = await import('./middleware/auth')
  const { areasRoutes } = await import('./routes/areas')
  const testApp = new Hono()
  testApp.use('*', dbMiddleware(db))
  testApp.route('/api/areas', areasRoutes)
  return testApp
}

describe('T110 — AreasAPI', () => {
  describe('GET /api/areas', () => {
    it('palauttaa 401 ilman autentikointia', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas')
      expect(res.status).toBe(401)
    })

    it('palauttaa tyhjän listan autentikoituneelle', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas', { headers: authHeaders(db, 'järjestäjä') })
      expect(res.status).toBe(200)
      const data = await res.json() as unknown[]
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    })
  })

  describe('POST /api/areas', () => {
    it('luo uuden alueen järjestäjällä', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(BASE_AREA),
      })
      expect(res.status).toBe(201)
      const data = await res.json() as Record<string, unknown>
      expect(data.name).toBe('Huoltopiste 25km')
      expect(data.hashCode).toBe('testi-hash-001')
      expect(data.status).toBe('suunniteltu')
      expect(Array.isArray(data.features)).toBe(true)
    })

    it('palauttaa 403 talkoolaiselle (väärä rooli)', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify(BASE_AREA),
      })
      expect(res.status).toBe(403)
    })

    it('luo alueen featuren kanssa', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...BASE_AREA, hashCode: 'hash-002', features: [SAMPLE_FEATURE] }),
      })
      expect(res.status).toBe(201)
      const data = await res.json() as Record<string, unknown>
      const features = data.features as unknown[]
      expect(features).toHaveLength(1)
      expect((features[0] as Record<string, unknown>).name).toBe('Tarjoilupöytä')
    })
  })

  describe('GET /api/areas (after create)', () => {
    it('CRUD roundtrip: create → list → hae', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

      const createRes = await testApp.request('/api/areas', {
        method: 'POST',
        headers,
        body: JSON.stringify(BASE_AREA),
      })
      const created = await createRes.json() as Record<string, unknown>
      const id = created.id as string

      const listRes = await testApp.request('/api/areas', { headers: authHeaders(db, 'järjestäjä') })
      const list = await listRes.json() as unknown[]
      expect(list).toHaveLength(1)
      expect((list[0] as Record<string, unknown>).id).toBe(id)
    })
  })

  describe('PUT /api/areas/:id', () => {
    it('päivittää nimen ja statuksen', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

      const createRes = await testApp.request('/api/areas', {
        method: 'POST', headers, body: JSON.stringify(BASE_AREA),
      })
      const created = await createRes.json() as Record<string, unknown>
      const id = created.id as string

      const putRes = await testApp.request(`/api/areas/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: 'Päivitetty', status: 'valmis' }),
      })
      expect(putRes.status).toBe(200)
      const updated = await putRes.json() as Record<string, unknown>
      expect(updated.name).toBe('Päivitetty')
      expect(updated.status).toBe('valmis')
    })

    it('päivittää features[]', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

      const createRes = await testApp.request('/api/areas', {
        method: 'POST', headers,
        body: JSON.stringify({ ...BASE_AREA, features: [SAMPLE_FEATURE] }),
      })
      const created = await createRes.json() as Record<string, unknown>
      const id = created.id as string

      const putRes = await testApp.request(`/api/areas/${id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ features: [] }),
      })
      const updated = await putRes.json() as Record<string, unknown>
      expect((updated.features as unknown[])).toHaveLength(0)
    })

    it('palauttaa 404 tuntemattomalle id:lle', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }
      const res = await testApp.request('/api/areas/ei-ole', {
        method: 'PUT', headers, body: JSON.stringify({ name: 'X' }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/areas/:id', () => {
    it('poistaa alueen + cascade features', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

      const createRes = await testApp.request('/api/areas', {
        method: 'POST', headers,
        body: JSON.stringify({ ...BASE_AREA, features: [SAMPLE_FEATURE] }),
      })
      const created = await createRes.json() as Record<string, unknown>
      const id = created.id as string

      const delRes = await testApp.request(`/api/areas/${id}`, {
        method: 'DELETE', headers: authHeaders(db, 'järjestäjä'),
      })
      expect(delRes.status).toBe(200)
      const deleted = await delRes.json() as Record<string, unknown>
      expect(deleted.deleted).toBe(id)

      // Verify cascade: area_features poistettu
      const count = db.query<{ n: number }, [string]>(
        'SELECT COUNT(*) as n FROM area_features WHERE area_id = ?'
      ).get(id)!
      expect(count.n).toBe(0)

      // Verify: GET listasta poissa
      const listRes = await testApp.request('/api/areas', { headers: authHeaders(db, 'järjestäjä') })
      const list = await listRes.json() as unknown[]
      expect(list).toHaveLength(0)
    })

    it('palauttaa 404 tuntemattomalle id:lle', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas/ei-ole', {
        method: 'DELETE', headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/areas/by-hash/:hash', () => {
    it('hakee oikean alueen hash-koodilla', async () => {
      const testApp = await makeApp()
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

      await testApp.request('/api/areas', {
        method: 'POST', headers, body: JSON.stringify(BASE_AREA),
      })

      const res = await testApp.request('/api/areas/by-hash/testi-hash-001', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const data = await res.json() as Record<string, unknown>
      expect(data.hashCode).toBe('testi-hash-001')
      expect(data.name).toBe('Huoltopiste 25km')
    })

    it('palauttaa 404 tuntemattomalle hashille', async () => {
      const testApp = await makeApp()
      const res = await testApp.request('/api/areas/by-hash/ei-ole-hash', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })
  })
})
