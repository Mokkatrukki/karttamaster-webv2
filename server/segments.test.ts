import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { segmentRoutes } from './routes/segments'
import { authHeaders, seedTestUsers } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/segments', segmentRoutes)
  return app
}

// V93: talkoolainen-sessio joka on sidottu koodiin (fixture jättää talkoolainen_code=null)
function talkoolainenCodeHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

const SEG_BODY = {
  routeIds: ['35km'],
  startDist: 5000,
  endDist: 12000,
  displayName: 'Pätkä 1',
  phase: 'asettaminen',
  equipment: [{ name: 'nauhaa', count: 3 }],
}

describe('T61: Segments API', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  test('POST /api/segments — järjestäjä luo segmentin', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify(SEG_BODY),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.routeIds).toEqual(['35km'])
    expect(body.startDist).toBe(5000)
    expect(body.endDist).toBe(12000)
    expect(body.equipment).toEqual([{ name: 'nauhaa', count: 3 }])
    expect(body.phase).toBe('asettaminen')
    expect(typeof body.id).toBe('string')
  })

  test('POST /api/segments — upsert by id pitää id:n', async () => {
    const app = makeApp(db)
    const id = 'fixed-id-123'
    const res1 = await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...SEG_BODY, id }),
    })
    expect(res1.status).toBe(201)
    const body1 = await res1.json() as Record<string, unknown>
    expect(body1.id).toBe(id)

    // Upsert same id with new displayName
    const res2 = await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...SEG_BODY, id, displayName: 'Päivitetty' }),
    })
    expect(res2.status).toBe(201)
    const body2 = await res2.json() as Record<string, unknown>
    expect(body2.id).toBe(id)
    expect(body2.displayName).toBe('Päivitetty')
  })

  test('GET /api/segments — järjestäjä näkee kaikki', async () => {
    const app = makeApp(db)
    const headers = authHeaders(db, 'järjestäjä')
    await app.request('/api/segments', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(SEG_BODY),
    })
    const res = await app.request('/api/segments', { headers })
    expect(res.status).toBe(200)
    const list = await res.json() as unknown[]
    expect(list).toHaveLength(1)
  })

  test('GET /api/segments — talkoolainen saa 403', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/segments', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(403)
  })

  test('PUT /api/segments/:id — päivittää kenttiä', async () => {
    const app = makeApp(db)
    const postRes = await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify(SEG_BODY),
    })
    const { id } = await postRes.json() as { id: string }

    const putRes = await app.request(`/api/segments/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Muista parkkipaikka', equipment: [{ name: 'vasara', count: 1 }] }),
    })
    expect(putRes.status).toBe(200)
    const updated = await putRes.json() as Record<string, unknown>
    expect(updated.description).toBe('Muista parkkipaikka')
    expect(updated.equipment).toEqual([{ name: 'vasara', count: 1 }])
  })

  test('DELETE /api/segments/:id — poistaa', async () => {
    const app = makeApp(db)
    const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }
    const postRes = await app.request('/api/segments', {
      method: 'POST', headers, body: JSON.stringify(SEG_BODY),
    })
    const { id } = await postRes.json() as { id: string }

    const delRes = await app.request(`/api/segments/${id}`, { method: 'DELETE', headers })
    expect(delRes.status).toBe(200)

    const listRes = await app.request('/api/segments', { headers })
    const list = await listRes.json() as unknown[]
    expect(list).toHaveLength(0)
  })

  test('GET /api/segments/by-code/:code — talkoolainen saa oman pätkän (V36)', async () => {
    const app = makeApp(db)
    const orgHeaders = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }

    // Create segment with code
    await app.request('/api/segments', {
      method: 'POST',
      headers: orgHeaders,
      body: JSON.stringify({ ...SEG_BODY, assignedCode: 'TEST-KOODI-1' }),
    })

    const res = await app.request('/api/segments/by-code/TEST-KOODI-1', {
      headers: authHeaders(db, 'talkoolainen'),
    })
    expect(res.status).toBe(200)
    const seg = await res.json() as Record<string, unknown>
    expect(seg.assignedCode).toBe('TEST-KOODI-1')
    expect(seg.startDist).toBe(5000)
  })

  test('GET /api/segments/by-code/:code — 404 jos ei löydy', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/segments/by-code/EI-OLE', {
      headers: authHeaders(db, 'talkoolainen'),
    })
    expect(res.status).toBe(404)
  })

  test('GET /api/segments/by-code/:code — 401 ilman auth', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/segments/by-code/TEST-KOODI-1')
    expect(res.status).toBe(401)
  })

  // ── Security: role-gate kaikilla kirjoitusoperaatioilla ─────────────────

  describe('Security: talkoolainen ei pysty muokkaamaan segmenttejä (V39)', () => {
    test('POST /api/segments — talkoolainen 403', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify(SEG_BODY),
      })
      expect(res.status).toBe(403)
    })

    test('PUT /api/segments/:id — talkoolainen 403', async () => {
      const app = makeApp(db)
      const postRes = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(SEG_BODY),
      })
      const { id } = await postRes.json() as { id: string }
      const res = await app.request(`/api/segments/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'yritys' }),
      })
      expect(res.status).toBe(403)
    })

    test('DELETE /api/segments/:id — talkoolainen 403', async () => {
      const app = makeApp(db)
      const postRes = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(SEG_BODY),
      })
      const { id } = await postRes.json() as { id: string }
      const res = await app.request(`/api/segments/${id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('POST /api/segments — unauthenticated 401', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SEG_BODY),
      })
      expect(res.status).toBe(401)
    })

    test('DELETE /api/segments/:id — unauthenticated 401', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/segments/ei-ole', { method: 'DELETE' })
      expect(res.status).toBe(401)
    })
  })

  // ── T149/V93: tarkastuskuittaus persistoituu + talkoolainen muokkaa omaa pätkää ──
  describe('T149/V93: inspected + talkoolaisen oma pätkä', () => {
    async function createOwnSegment(app: Hono, db: Database, code: string): Promise<string> {
      const res = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...SEG_BODY, phase: 'tarkastus', assignedCode: code }),
      })
      const { id } = await res.json() as { id: string }
      return id
    }

    test('inspected/inspectionNote roundtrippaa (järjestäjä PUT → GET)', async () => {
      const app = makeApp(db)
      const headers = { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' }
      const postRes = await app.request('/api/segments', {
        method: 'POST', headers, body: JSON.stringify({ ...SEG_BODY, phase: 'tarkastus' }),
      })
      const { id } = await postRes.json() as { id: string }
      // POST default: inspected false
      const created = await (await app.request('/api/segments', { headers })).json() as Record<string, unknown>[]
      expect(created[0].inspected).toBe(false)

      const putRes = await app.request(`/api/segments/${id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ inspected: true, inspectionNote: 'Ajettu läpi, kaikki ok' }),
      })
      expect(putRes.status).toBe(200)
      const updated = await putRes.json() as Record<string, unknown>
      expect(updated.inspected).toBe(true)
      expect(updated.inspectionNote).toBe('Ajettu läpi, kaikki ok')
    })

    test('talkoolainen muokkaa omaa pätkäänsä (inspected) — 200', async () => {
      const app = makeApp(db)
      const code = 'TARK-KOODI-9'
      const id = await createOwnSegment(app, db, code)

      const res = await app.request(`/api/segments/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, code), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true, inspectionNote: 'Tarkastettu' }),
      })
      expect(res.status).toBe(200)
      const updated = await res.json() as Record<string, unknown>
      expect(updated.inspected).toBe(true)
      expect(updated.inspectionNote).toBe('Tarkastettu')
    })

    test('talkoolaisen kenttärajaus: displayName-yritys ei muuta järjestäjän kenttää (V93)', async () => {
      const app = makeApp(db)
      const code = 'TARK-KOODI-8'
      const id = await createOwnSegment(app, db, code)

      const res = await app.request(`/api/segments/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, code), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true, displayName: 'HAKKEROITU', description: 'x' }),
      })
      expect(res.status).toBe(200)
      const updated = await res.json() as Record<string, unknown>
      expect(updated.inspected).toBe(true)
      expect(updated.displayName).toBe('Pätkä 1') // ennallaan
      expect(updated.description).toBeUndefined()
    })

    test('talkoolainen vieraaseen pätkään (eri koodi) — 403', async () => {
      const app = makeApp(db)
      const id = await createOwnSegment(app, db, 'OMA-KOODI')

      const res = await app.request(`/api/segments/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'VIERAS-KOODI'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspected: true }),
      })
      expect(res.status).toBe(403)
    })
  })

  // T213/V141: reititön tehtävä persistoituu (route-kentät nullable)
  describe('T213/V141: reititön tehtävä', () => {
    test('POST reititön tehtävä ilman route-kenttiä → 201, roundtrip ilman route-kenttiä', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Maalialue', phase: 'asettaminen', equipment: [] }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as Record<string, unknown>
      expect(body.routeIds).toBeUndefined()
      expect(body.startDist).toBeUndefined()
      expect(body.endDist).toBeUndefined()
      expect(body.displayName).toBe('Maalialue')

      // GET / roundtrip
      const list = await (await app.request('/api/segments', {
        headers: authHeaders(db, 'järjestäjä'),
      })).json() as Record<string, unknown>[]
      const found = list.find(s => s.id === body.id)!
      expect(found.routeIds).toBeUndefined()
      expect(found.startDist).toBeUndefined()
    })

    test('reitillinen tehtävä ennallaan (route-kentät säilyvät)', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeIds: ['35km'], startDist: 1000, endDist: 5000, phase: 'asettaminen', equipment: [] }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as Record<string, unknown>
      expect(body.routeIds).toEqual(['35km'])
      expect(body.startDist).toBe(1000)
      expect(body.endDist).toBe(5000)
    })

    test('reitittömän tehtävän GET by-code palauttaa ilman route-kenttiä', async () => {
      const app = makeApp(db)
      const post = await app.request('/api/segments', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedCode: 'ALUE1', displayName: 'Keräysalue', phase: 'purku', equipment: [] }),
      })
      expect(post.status).toBe(201)
      const res = await app.request('/api/segments/by-code/ALUE1', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.routeIds).toBeUndefined()
      expect(body.assignedCode).toBe('ALUE1')
    })
  })
})
