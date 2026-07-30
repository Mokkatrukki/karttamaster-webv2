import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { segmentRoutes } from './routes/segments'
import { auditRoutes } from './routes/audit'
import { authHeaders, seedTestUsers, TEST_USERS } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

// T417/V308: merkin JÄSENYYS tehtävässä on datamuutos joka ! näkyä lokissa. 2026-07-25-incidentin
// oppi: syy löytyi vain koska muutos oli kirjattu. Ilman tätä "miksi tämä merkki on tässä
// tehtävässä" ⊥ ole vastattavissa jälkikäteen.

interface AuditRow {
  marker_id: string
  action: string
  actor: string | null
  actor_role: string
  segment_code: string | null
  payload_json: string | null
}

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/segments', segmentRoutes)
  app.route('/api/audit', auditRoutes)
  return app
}

function codeHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

const CODE = TEST_USERS.talkoolainen.code

describe('T417/V308: merkkiliitos kirjautuu lokiin', () => {
  let db: Database
  let app: Hono
  let segId: string

  async function patch(headers: Record<string, string>, body: unknown): Promise<Response> {
    return app.request(`/api/segments/${segId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  function auditRows(): AuditRow[] {
    return db.query<AuditRow, []>('SELECT * FROM marker_audit ORDER BY created_at, marker_id').all()
  }

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
    const res = await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({
        id: randomUUID(),
        routeIds: ['35km'], startDist: 5000, endDist: 12000,
        displayName: 'Kohdepätkä', phase: 'asettaminen', equipment: [],
        assignedCode: CODE, linkedMarkerIds: ['a'],
      }),
    })
    expect(res.status).toBe(201)
    segId = ((await res.json()) as { id: string }).id
    // Luonti ⊥ kirjaa jäsenyyttä (se on POST-polku) → lähtötila on tyhjä loki.
    db.run('DELETE FROM marker_audit')
  })

  test('(i) talkoolaisen lisäys → rivi jossa lisätty merkki, tekijä & kohdetehtävä', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    const rows = auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].marker_id).toBe('b')
    expect(rows[0].action).toBe('link')
    expect(rows[0].actor).toBe('Testi Talkoolainen')
    expect(rows[0].actor_role).toBe('talkoolainen')
    expect(rows[0].segment_code).toBe(CODE)
    expect(JSON.parse(rows[0].payload_json!)).toMatchObject({ segmentId: segId, segmentName: 'Kohdepätkä' })
  })

  test('(i) monta merkkiä → rivi per MERKKI (⊥ yksi rivi listalla)', async () => {
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: ['a', 'b', 'c'] })
    const rows = auditRows()
    expect(rows.map(r => r.marker_id)).toEqual(['b', 'c'])
    expect(rows.every(r => r.action === 'link')).toBe(true)
  })

  test('(ii) idempotentti patch (⊥ uusia id:itä) → ⊥ lokiriviä (kohina peittäisi oikeat)', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['a'] })
    expect(auditRows()).toHaveLength(0)
  })

  test('(ii) patch joka ⊥ mainitse liitosta → ⊥ lokiriviä', async () => {
    await patch(codeHeaders(db, CODE), { completed: true })
    expect(auditRows()).toHaveLength(0)
  })

  test('(iii) järjestäjän korvaava patch kirjaa lisätyt & poistetut ERIKSEEN', async () => {
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: ['b'] })
    const rows = auditRows()
    expect(rows).toHaveLength(2)
    const byAction = new Map(rows.map(r => [r.action, r.marker_id]))
    expect(byAction.get('link')).toBe('b')
    expect(byAction.get('unlink')).toBe('a')
  })

  test('(iii) järjestäjän nollaus kirjaa unlinkin joka merkille', async () => {
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: ['a', 'b'] })
    db.run('DELETE FROM marker_audit')
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: [] })
    const rows = auditRows()
    expect(rows.map(r => r.action)).toEqual(['unlink', 'unlink'])
    expect(rows.map(r => r.marker_id)).toEqual(['a', 'b'])
  })

  test('talkoolainen ⊥ voi tuottaa unlink-rivejä (unioni estää poiston, V307)', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: [] })
    expect(auditRows()).toHaveLength(0)
  })

  test('DELTA luetaan TALLENNETUSTA arvosta ⊥ pyynnön rungosta', async () => {
    // Talkoolaisen runko sanoo ['x'] mutta tallennettu arvo on unioni ['a','x'] ∴ lokissa ! olla
    // TASAN 'x' — jos delta laskettaisiin rungosta, 'a' näyttäisi kadonneelta (unlink-haamu).
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['x'] })
    const rows = auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].marker_id).toBe('x')
    expect(rows[0].action).toBe('link')
  })

  test('kirjaus & mutaatio ovat SAMASSA transaktiossa: kumpikin tai ei kumpaakaan', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    const seg = db.query<{ linked_marker_ids: string | null }, [string]>(
      'SELECT linked_marker_ids FROM segments WHERE id = ?',
    ).get(segId)!
    expect(JSON.parse(seg.linked_marker_ids!)).toContain('b')
    expect(auditRows()).toHaveLength(1)
  })
})

describe('T417/V308: jäsenyysrivi ⊥ ole peruutettavissa merkkireitiltä', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  test('POST /api/audit/undo/:auditId → 400 not_undoable (⊥ hiljainen no-op)', async () => {
    const auditId = randomUUID()
    db.run(
      'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['mk-1', 'right', 65.6, 27.5, 1000, JSON.stringify(['35km']), 'suunniteltu', new Date().toISOString()],
    )
    db.run(
      'INSERT INTO marker_audit (id, marker_id, action, actor, actor_role, segment_code, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [auditId, 'mk-1', 'link', 'Testi', 'talkoolainen', 'TEST-KOODI-1', new Date().toISOString(), JSON.stringify({ segmentId: 's1', segmentName: 'P' })],
    )
    const res = await app.request(`/api/audit/undo/${auditId}`, {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBe('not_undoable')
    // Rivi ⊥ saa myöskään merkkiytyä peruutetuksi eikä tuottaa käänteisriviä.
    const row = db.query<{ undone_at: string | null }, [string]>('SELECT undone_at FROM marker_audit WHERE id = ?').get(auditId)!
    expect(row.undone_at).toBeNull()
    expect(db.query<{ c: number }, []>('SELECT COUNT(*) AS c FROM marker_audit').get()!.c).toBe(1)
  })

  test('bulk-undo torjuu link-actionin (olemassa oleva whitelist)', async () => {
    const res = await app.request('/api/audit/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ segment_code: 'TEST-KOODI-1', action: 'link' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBe('action_not_undoable')
  })
})
