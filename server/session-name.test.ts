// T322/V228: nimen asetus kesken session. Kenttätyö oli jo käynnissä kun T317 vaati nimen
// kirjautumisessa — vanhat sessiot elävät 7 vrk (V188) eikä uudelleenkirjautumista voi vaatia
// kesken maastotyön. Taso 4 Bun-integraatio.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { markersRoutes } from './routes/markers'
import { auditRoutes } from './routes/audit'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/auth', authRoutes)
  app.route('/api/markers', markersRoutes)
  app.route('/api/audit', auditRoutes)
  return app
}

// Ennen T317:ää kirjautunut sessio: kooditon JA geneerinen nimi.
function legacySession(db: Database): { id: string; headers: { Cookie: string } } {
  const id = randomUUID()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, null, 'talkoolainen', 'Talkoolainen', new Date(Date.now() + 7 * 24 * 3600_000).toISOString()],
  )
  return { id, headers: { Cookie: `session=${id}` } }
}

function nameOf(db: Database, sessionId: string): string {
  return db.query<{ display_name: string }, [string]>('SELECT display_name FROM sessions WHERE id = ?').get(sessionId)!.display_name
}

describe('T322: POST /api/auth/name', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
  afterEach(() => db.close())

  async function setName(headers: Record<string, string>, name: unknown) {
    return await makeApp(db).request('/api/auth/name', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  test('vanha nimetön sessio saa nimen ILMAN uudelleenkirjautumista', async () => {
    const s = legacySession(db)
    const res = await setName(s.headers, 'Liisa')
    expect(res.status).toBe(200)
    expect(nameOf(db, s.id)).toBe('Liisa')
  })

  test('sessio pysyy voimassa — kenttätyö ei keskeydy', async () => {
    const s = legacySession(db)
    await setName(s.headers, 'Liisa')
    const me = await makeApp(db).request('/api/auth/me', { headers: s.headers })
    expect(me.status).toBe(200)
    expect((await me.json() as { display_name: string }).display_name).toBe('Liisa')
  })

  test('nimi trimmataan', async () => {
    const s = legacySession(db)
    await setName(s.headers, '  Kalle  ')
    expect(nameOf(db, s.id)).toBe('Kalle')
  })

  test('liian lyhyt → 400, vanha nimi säilyy', async () => {
    const s = legacySession(db)
    expect((await setName(s.headers, 'L')).status).toBe(400)
    expect(nameOf(db, s.id)).toBe('Talkoolainen')
  })

  test('liian pitkä → 400', async () => {
    const s = legacySession(db)
    expect((await setName(s.headers, 'x'.repeat(41))).status).toBe(400)
  })

  test('ilman sessiota → 401', async () => {
    expect((await setName({}, 'Liisa')).status).toBe(401)
  })

  test('nimen jälkeen kirjatut audit-rivit kantavat oikean tekijän', async () => {
    const s = legacySession(db)
    db.run(
      "INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, equipment, phase, updated_at) VALUES (?, ?, ?, ?, ?, '[]', 'asettaminen', ?)",
      [randomUUID(), JSON.stringify(['35km']), 0, 5000, 'SEG-A', new Date().toISOString()],
    )
    await setName(s.headers, 'Liisa')

    await makeApp(db).request('/api/markers', {
      method: 'POST',
      headers: { ...s.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nuoli-oikealle', lat: 65.1, lon: 27.5, distance_from_start: 1000, route_ids: ['35km'] }),
    })

    const res = await makeApp(db).request('/api/audit', { headers: authHeaders(db, 'järjestäjä') })
    const rows = await res.json() as Array<{ actor: string; segment_code: string | null }>
    expect(rows[0].actor).toBe('Liisa')
    expect(rows[0].segment_code).toBe('SEG-A')
  })
})
