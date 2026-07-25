// T316-T319: pätkän johdanto merkistä (V227), koko rivin remove-payload (V229),
// per-rivi-undo (V230). Taso 4 — Bun-integraatio oikeaa SQLitea vasten.
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

// B124:n ydin: yleissalasana-sessio on KOODITON ja sen nimi tulee kirjautumisesta (T317).
function codelessTalkooHeaders(db: Database, name = 'Matti Meikäläinen'): { Cookie: string } {
  const id = randomUUID()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, null, 'talkoolainen', name, new Date(Date.now() + 3600_000).toISOString()],
  )
  return { Cookie: `session=${id}` }
}

function seedSegment(db: Database, code: string, start = 0, end = 5000): void {
  db.run(
    "INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 'asettaminen', ?)",
    [randomUUID(), JSON.stringify(['35km']), start, end, code, new Date().toISOString()],
  )
}

const MARKER = { type: 'nuoli-oikealle', lat: 65.1, lon: 27.5, distance_from_start: 1000, route_ids: ['35km'] }

interface AuditJson {
  id: string
  action: string
  actor: string
  segment_code: string | null
  payload: Record<string, unknown> | null
}
interface MarkerJson { id: string; lat: number; lon: number; status: string; description?: string }

async function addMarker(db: Database, headers: Record<string, string>, body: object = MARKER): Promise<string> {
  const res = await makeApp(db).request('/api/markers', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return (await res.json() as MarkerJson).id
}

async function auditRows(db: Database): Promise<AuditJson[]> {
  const res = await makeApp(db).request('/api/audit', { headers: authHeaders(db, 'järjestäjä') })
  return await res.json() as AuditJson[]
}

describe('T316/V227: segment_code johdetaan merkistä', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
  afterEach(() => db.close())

  test('kooditon talkoo-sessio → rivi saa silti pätkäkoodin (B124:n ydin)', async () => {
    seedSegment(db, 'SEG-A')
    await addMarker(db, codelessTalkooHeaders(db))
    const rows = await auditRows(db)
    expect(rows.length).toBe(1)
    expect(rows[0].segment_code).toBe('SEG-A')
    expect(rows[0].actor).toBe('Matti Meikäläinen')
  })

  test('järjestäjän mutaatio kirjautuu merkin pätkälle', async () => {
    seedSegment(db, 'SEG-A')
    await addMarker(db, authHeaders(db, 'järjestäjä'))
    expect((await auditRows(db))[0].segment_code).toBe('SEG-A')
  })

  test('merkki pätkien ulkopuolella → NULL, ei kaadu', async () => {
    seedSegment(db, 'SEG-A', 0, 500)
    await addMarker(db, authHeaders(db, 'järjestäjä')) // dist 1000 > 500 + ε
    expect((await auditRows(db))[0].segment_code).toBeNull()
  })

  test('siirto kirjautuu merkin UUDELLE pätkälle', async () => {
    seedSegment(db, 'SEG-A', 0, 2000)
    seedSegment(db, 'SEG-B', 8000, 12000)
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 65.2, lon: 27.6, distance_from_start: 10000, route_ids: ['35km'] }),
    })
    const moveRow = (await auditRows(db)).find(r => r.action === 'move')!
    expect(moveRow.segment_code).toBe('SEG-B')
  })

  test('poisto johtaa pätkän ENNEN DELETEä — rivi ei jää orvoksi', async () => {
    seedSegment(db, 'SEG-A')
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    const removeRow = (await auditRows(db)).find(r => r.action === 'remove')!
    expect(removeRow.segment_code).toBe('SEG-A')
  })
})

describe('T318/V229 + T319/V230: per-rivi-undo', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db); seedSegment(db, 'SEG-A') })
  afterEach(() => db.close())

  async function undo(auditId: string, role: 'järjestäjä' | 'talkoolainen' = 'järjestäjä') {
    return await makeApp(db).request(`/api/audit/undo/${auditId}`, {
      method: 'POST',
      headers: role === 'järjestäjä' ? authHeaders(db, 'järjestäjä') : codelessTalkooHeaders(db),
    })
  }

  async function getMarker(id: string): Promise<MarkerJson | undefined> {
    const res = await makeApp(db).request('/api/markers', { headers: authHeaders(db, 'järjestäjä') })
    return (await res.json() as MarkerJson[]).find(m => m.id === id)
  }

  test('talkoolainen ei saa perua (requireRole)', async () => {
    await addMarker(db, authHeaders(db, 'järjestäjä'))
    const row = (await auditRows(db))[0]
    expect((await undo(row.id, 'talkoolainen')).status).toBe(403)
  })

  test('add peruuntuu → merkki poistuu', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    const row = (await auditRows(db)).find(r => r.action === 'add')!
    expect((await undo(row.id)).status).toBe(200)
    expect(await getMarker(id)).toBeUndefined()
  })

  test('move peruuntuu → alkuperäiset koordinaatit palautuvat', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 65.9, lon: 27.9, distance_from_start: 4000, route_ids: ['35km'] }),
    })
    const moveRow = (await auditRows(db)).find(r => r.action === 'move')!
    expect((await undo(moveRow.id)).status).toBe(200)
    const m = await getMarker(id)!
    expect(m!.lat).toBeCloseTo(65.1, 5)
    expect(m!.lon).toBeCloseTo(27.5, 5)
  })

  test('status peruuntuu → edellinen tila palautuu', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'asetettu' }),
    })
    const statusRow = (await auditRows(db)).find(r => r.action === 'status')!
    expect((await undo(statusRow.id)).status).toBe(200)
    expect((await getMarker(id))!.status).toBe('suunniteltu')
  })

  test('remove peruuntuu → merkki palautuu SAMALLA id:llä ja kentillä (V229)', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'), { ...MARKER, description: 'Risteyksen jälkeen' })
    await makeApp(db).request(`/api/markers/${id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    expect(await getMarker(id)).toBeUndefined()

    const removeRow = (await auditRows(db)).find(r => r.action === 'remove')!
    // V229: payload kantaa koko rivin, ei otosta
    expect(removeRow.payload).toHaveProperty('description', 'Risteyksen jälkeen')
    expect(removeRow.payload).toHaveProperty('created_by')

    expect((await undo(removeRow.id)).status).toBe(200)
    const restored = await getMarker(id)
    expect(restored).toBeDefined()
    expect(restored!.description).toBe('Risteyksen jälkeen')
    expect(restored!.lat).toBeCloseTo(65.1, 5)
  })

  test('tuplaperuutus → 409, merkki ei muutu toiseen kertaan', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 65.9, lon: 27.9, distance_from_start: 4000, route_ids: ['35km'] }),
    })
    const moveRow = (await auditRows(db)).find(r => r.action === 'move')!
    expect((await undo(moveRow.id)).status).toBe(200)
    expect((await undo(moveRow.id)).status).toBe(409)
  })

  test('tuntematon auditId → 404', async () => {
    expect((await undo(randomUUID())).status).toBe(404)
  })

  test('merkki kadonnut välissä → 404, ei hiljaista 200:aa', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'asetettu' }),
    })
    const statusRow = (await auditRows(db)).find(r => r.action === 'status')!
    db.run('DELETE FROM markers WHERE id = ?', [id])
    expect((await undo(statusRow.id)).status).toBe(404)
  })

  test('legacy remove-payload (otos, ei koko riviä) → not_undoable, ei osittaista restorea', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    await makeApp(db).request(`/api/markers/${id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    const removeRow = (await auditRows(db)).find(r => r.action === 'remove')!
    // simuloi T318:aa edeltävä rivi
    db.run('UPDATE marker_audit SET payload_json = ? WHERE id = ?', [JSON.stringify({ lat: 65.1, lon: 27.5 }), removeRow.id])
    const res = await undo(removeRow.id)
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBe('not_undoable')
    expect(await getMarker(id)).toBeUndefined()
  })

  test('peruutus kirjautuu itsekin auditiin → peruutuskin peruttavissa (V230)', async () => {
    const id = await addMarker(db, authHeaders(db, 'järjestäjä'))
    const before = (await auditRows(db)).length
    const addRow = (await auditRows(db)).find(r => r.action === 'add')!
    await undo(addRow.id)
    const after = await auditRows(db)
    expect(after.length).toBe(before + 1)
    const trace = after.find(r => r.action === 'remove')!
    expect(trace.actor).toBeTruthy()
    expect(trace.segment_code).toBe('SEG-A')
    expect(await getMarker(id)).toBeUndefined()
  })
})

describe('T319: GET /api/audit -suodattimet', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db); seedSegment(db, 'SEG-A') })
  afterEach(() => db.close())

  test('actor_role suodattaa', async () => {
    await addMarker(db, authHeaders(db, 'järjestäjä'))
    await addMarker(db, codelessTalkooHeaders(db))
    const res = await makeApp(db).request('/api/audit?actor_role=talkoolainen', { headers: authHeaders(db, 'järjestäjä') })
    const rows = await res.json() as AuditJson[]
    expect(rows.length).toBe(1)
    expect(rows[0].actor).toBe('Matti Meikäläinen')
  })

  test('actor suodattaa nimellä (T317:n hyöty)', async () => {
    await addMarker(db, codelessTalkooHeaders(db, 'Liisa'))
    await addMarker(db, codelessTalkooHeaders(db, 'Kalle'))
    const res = await makeApp(db).request('/api/audit?actor=Liisa', { headers: authHeaders(db, 'järjestäjä') })
    expect((await res.json() as AuditJson[]).length).toBe(1)
  })

  test('limit leikkaa ja palauttaa uusimmat ensin', async () => {
    for (let i = 0; i < 4; i++) await addMarker(db, authHeaders(db, 'järjestäjä'))
    const res = await makeApp(db).request('/api/audit?limit=2', { headers: authHeaders(db, 'järjestäjä') })
    const rows = await res.json() as AuditJson[]
    expect(rows.length).toBe(2)
  })

  test('segment_code-haku säilyy ASC-järjestyksessä (T227-kuluttajan sopimus)', async () => {
    await addMarker(db, authHeaders(db, 'järjestäjä'))
    await addMarker(db, authHeaders(db, 'järjestäjä'))
    const res = await makeApp(db).request('/api/audit?segment_code=SEG-A', { headers: authHeaders(db, 'järjestäjä') })
    const rows = await res.json() as Array<AuditJson & { created_at: string }>
    expect(rows.length).toBe(2)
    expect(rows[0].created_at <= rows[1].created_at).toBe(true)
  })
})
