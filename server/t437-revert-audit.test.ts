// T437/V323 (V227/V231): PALAUTUS ON DATAMUUTOS ∴ se menee lokiin kuten kuittauskin —
// "kuka perui" on yhtä tärkeä kuin "kuka kuittasi". Palautus kulkee SAMAA PUT-reittiä kuin
// kuittaus (T437(d): ⊥ uutta koneistoa) ∴ tämä testi lukitsee sen: jos statuspolku joskus
// oikaistaan lokin ohi, purun peruutus katoaisi historiasta hiljaa (V21-suku).
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

function talkooHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Purkaja Pena', expires],
  )
  return { Cookie: `session=${id}` }
}

function seedOwnedSegment(db: Database, code: string): void {
  db.run(
    "INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 'purku', ?)",
    [randomUUID(), JSON.stringify(['35km']), 0, 5000, code, new Date().toISOString()],
  )
}

const MARKER_BODY = { type: 'nuoli-oikealle', lat: 65.1, lon: 27.5, distance_from_start: 1000, route_ids: ['35km'] }

interface MarkerJson { id: string; status: string }
interface AuditRow { marker_id: string; action: string; actor: string; payload: { status?: string } | null }

describe('T437/V323 — peruutus kirjautuu lokiin', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
  afterEach(() => db.close())

  async function collectedMarker(code: string): Promise<string> {
    const app = makeApp(db)
    const created = await (await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...MARKER_BODY, status: 'asetettu' }),
    })).json() as MarkerJson
    await app.request(`/api/markers/${created.id}`, {
      method: 'PUT',
      headers: { ...talkooHeaders(db, code), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'kerätty' }),
    })
    return created.id
  }

  test('kerätty → asetettu tuottaa status-rivin jossa ENNEN-tila on kerätty', async () => {
    seedOwnedSegment(db, 'P1')
    const id = await collectedMarker('P1')
    const app = makeApp(db)

    const res = await app.request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...talkooHeaders(db, 'P1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'asetettu' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json() as MarkerJson).status).toBe('asetettu')

    const rows = await (await app.request('/api/audit', {
      headers: authHeaders(db, 'järjestäjä'),
    })).json() as AuditRow[]
    const statusRows = rows.filter(r => r.marker_id === id && r.action === 'status')
    // kuittaus + peruutus = kaksi riviä. Rivi tunnistetaan ENNEN-tilasta ⊥ järjestyksestä:
    // molemmat syntyvät samassa millisekunnissa ∴ created_at ⊥ erota niitä.
    expect(statusRows.length).toBe(2)
    const revert = statusRows.find(r => r.payload?.status === 'kerätty')
    expect(revert).toBeDefined() // peruutuksen ennen-tila = mistä peruttiin
    expect(revert!.actor).toBe('Purkaja Pena') // kuka perui
    expect(statusRows.some(r => r.payload?.status === 'asetettu')).toBe(true) // kuittaus
  })

  test('peruutus säilyy peruttavana rivinä (undo palauttaa kerätyn)', async () => {
    seedOwnedSegment(db, 'P1')
    const id = await collectedMarker('P1')
    const app = makeApp(db)
    await app.request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...talkooHeaders(db, 'P1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'asetettu' }),
    })
    const rows = await (await app.request('/api/audit', {
      headers: authHeaders(db, 'järjestäjä'),
    })).json() as (AuditRow & { id: string })[]
    const latest = rows.filter(r => r.marker_id === id && r.action === 'status')
      .find(r => r.payload?.status === 'kerätty')!

    const undo = await app.request(`/api/audit/undo/${latest.id}`, {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(undo.status).toBe(200)
    const after = db.query('SELECT status FROM markers WHERE id = ?').get(id) as { status: string }
    expect(after.status).toBe('kerätty')
  })
})
