import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { auditRoutes } from './routes/audit'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  app.route('/api/audit', auditRoutes)
  return app
}

function talkoolainenCodeHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

function seedOwnedSegment(db: Database, code: string): void {
  db.run(
    "INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 'asettaminen', ?)",
    [randomUUID(), JSON.stringify(['35km']), 0, 5000, code, new Date().toISOString()],
  )
}

const MARKER_BODY = { type: 'nuoli-oikealle', lat: 65.1, lon: 27.5, distance_from_start: 1000, route_ids: ['35km'] }

interface MarkerJson { id: string; status: string; lat: number }

// Luo talkoolaisen itse lisäämä merkki koodin OMA-pätkälle. Palauttaa id:n.
async function talkooAddMarker(db: Database, code: string, body = MARKER_BODY): Promise<string> {
  const res = await makeApp(db).request('/api/markers', {
    method: 'POST',
    headers: { ...talkoolainenCodeHeaders(db, code), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json() as MarkerJson).id
}

describe('T226/T227: audit-reitti', () => {
  let db: Database
  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })
  afterEach(() => db.close())

  describe('GET /api/audit', () => {
    test('unauthenticated → 401', async () => {
      const res = await makeApp(db).request('/api/audit')
      expect(res.status).toBe(401)
    })

    test('talkoolainen → 403 (supervision vain järjestäjä+)', async () => {
      const res = await makeApp(db).request('/api/audit', { headers: authHeaders(db, 'talkoolainen') })
      expect(res.status).toBe(403)
    })

    test('järjestäjä saa lokin aikajärjestyksessä', async () => {
      seedOwnedSegment(db, 'SEG-A')
      await talkooAddMarker(db, 'SEG-A')
      const res = await makeApp(db).request('/api/audit', { headers: authHeaders(db, 'järjestäjä') })
      expect(res.status).toBe(200)
      const rows = await res.json() as Array<{ action: string; segment_code: string }>
      expect(rows.length).toBe(1)
      expect(rows[0].action).toBe('add')
    })

    test('segment_code suodattaa', async () => {
      seedOwnedSegment(db, 'SEG-A')
      seedOwnedSegment(db, 'SEG-B')
      await talkooAddMarker(db, 'SEG-A')
      await talkooAddMarker(db, 'SEG-B')
      const res = await makeApp(db).request('/api/audit?segment_code=SEG-A', { headers: authHeaders(db, 'järjestäjä') })
      const rows = await res.json() as Array<{ segment_code: string }>
      expect(rows.length).toBe(1)
      expect(rows[0].segment_code).toBe('SEG-A')
    })
  })

  describe('POST /api/audit/undo', () => {
    test('talkoolainen → 403', async () => {
      const res = await makeApp(db).request('/api/audit/undo', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_code: 'X', action: 'add' }),
      })
      expect(res.status).toBe(403)
    })

    test('puuttuvat kentät → 400', async () => {
      const res = await makeApp(db).request('/api/audit/undo', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_code: 'X' }),
      })
      expect(res.status).toBe(400)
    })

    test('remove ei peruutettavissa → 400', async () => {
      const res = await makeApp(db).request('/api/audit/undo', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_code: 'X', action: 'remove' }),
      })
      expect(res.status).toBe(400)
    })

    test('massaperuutus add → poistaa kaikki pätkän lisätyt merkit atomisesti', async () => {
      seedOwnedSegment(db, 'SPAM')
      const id1 = await talkooAddMarker(db, 'SPAM')
      const id2 = await talkooAddMarker(db, 'SPAM')
      seedOwnedSegment(db, 'MUU')
      const id3 = await talkooAddMarker(db, 'MUU') // eri pätkä — ei saa poistua

      const res = await makeApp(db).request('/api/audit/undo', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_code: 'SPAM', action: 'add' }),
      })
      expect(res.status).toBe(200)
      expect((await res.json() as { undone: number }).undone).toBe(2)
      expect(db.query('SELECT id FROM markers WHERE id = ?').get(id1)).toBeNull()
      expect(db.query('SELECT id FROM markers WHERE id = ?').get(id2)).toBeNull()
      expect(db.query('SELECT id FROM markers WHERE id = ?').get(id3)).not.toBeNull()
    })

    test('massaperuutus status → palauttaa ENNEN-tilan', async () => {
      seedOwnedSegment(db, 'ST')
      const id = await talkooAddMarker(db, 'ST') // status suunniteltu
      // talkoolainen asettaa → status
      await makeApp(db).request(`/api/markers/${id}`, {
        method: 'PUT',
        headers: { ...talkoolainenCodeHeaders(db, 'ST'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asetettu' }),
      })
      expect(db.query<{ status: string }, [string]>('SELECT status FROM markers WHERE id = ?').get(id)!.status).toBe('asetettu')

      await makeApp(db).request('/api/audit/undo', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_code: 'ST', action: 'status' }),
      })
      expect(db.query<{ status: string }, [string]>('SELECT status FROM markers WHERE id = ?').get(id)!.status).toBe('suunniteltu')
    })
  })
})
