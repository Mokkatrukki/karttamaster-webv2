import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { segmentRoutes } from './routes/segments'
import { authHeaders, seedTestUsers, TEST_USERS } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

// T416/V307: serveri on merkkiliitoksen viimeinen portti. Talkoolaisen patch on UNIONI ⊥ korvaus
// ∴ hän voi LISÄTÄ merkin omaan tehtäväänsä mutta ⊥ poistaa toisen lisäystä eikä nollata listaa
// vanhentuneella clientilla. Järjestäjän patch säilyy korvaavana.

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/segments', segmentRoutes)
  return app
}

/** Koodiin sidottu talkoo-sessio (fixture jättää talkoolainen_code=null). */
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

const SEG_BODY = {
  routeIds: ['35km'],
  startDist: 5000,
  endDist: 12000,
  displayName: 'Pätkä 1',
  phase: 'asettaminen',
  equipment: [],
  assignedCode: CODE,
  linkedMarkerIds: ['a'],
}

describe('T416/V307: talkoolaisen merkkiliitos on additiivinen', () => {
  let db: Database
  let app: Hono
  let segId: string

  async function create(over: Record<string, unknown> = {}): Promise<string> {
    const res = await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ id: randomUUID(), ...SEG_BODY, ...over }),
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }

  async function patch(headers: Record<string, string>, body: unknown): Promise<Response> {
    return app.request(`/api/segments/${segId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  function linked(): string[] {
    const row = db.query<{ linked_marker_ids: string | null }, [string]>(
      'SELECT linked_marker_ids FROM segments WHERE id = ?',
    ).get(segId)!
    return row.linked_marker_ids ? (JSON.parse(row.linked_marker_ids) as string[]) : []
  }

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
    segId = await create()
  })

  test('(i) talkoolainen lisää merkin → UNIONI, vanhat säilyvät', async () => {
    const res = await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    expect(res.status).toBe(200)
    expect(linked().sort()).toEqual(['a', 'b'])
  })

  test('(i) idempotentti: sama id kahdesti ⊥ tuplaa riviä', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    expect(linked().sort()).toEqual(['a', 'b'])
  })

  test('(ii) talkoolainen ⊥ voi poistaa liitosta — lyhyempi lista ⊥ typistä', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b', 'c'] })
    // Vanhentunut client (offline-outbox) lähettää listan josta 'b' ja 'c' puuttuvat.
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['a'] })
    expect(linked().sort()).toEqual(['a', 'b', 'c'])
  })

  test('(ii) tyhjä lista ⊥ nollaa listaa talkoolaiselta', async () => {
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: [] })
    expect(linked()).toEqual(['a'])
  })

  test('(iii) talkoolainen ⊥ voi kirjoittaa excludedMarkerIds:iä (poisto = järjestäjän oikeus)', async () => {
    await patch(codeHeaders(db, CODE), { excludedMarkerIds: ['a'] })
    const row = db.query<{ excluded_marker_ids: string | null }, [string]>(
      'SELECT excluded_marker_ids FROM segments WHERE id = ?',
    ).get(segId)!
    expect(row.excluded_marker_ids).toBeNull()
  })

  test('(iv) kooditon Model B -sessio (V188/V217) saa saman lisäysoikeuden', async () => {
    const res = await patch(authHeaders(db, 'talkoolainen'), { linkedMarkerIds: ['b'] })
    expect(res.status).toBe(200)
    expect(linked().sort()).toEqual(['a', 'b'])
  })

  test('(v) järjestäjän patch KORVAA — hän omistaa listan & poistaa', async () => {
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: ['z'] })
    expect(linked()).toEqual(['z'])
  })

  test('(v) järjestäjä voi nollata listan tyhjällä taulukolla', async () => {
    await patch(authHeaders(db, 'järjestäjä'), { linkedMarkerIds: [] })
    expect(linked()).toEqual([])
  })

  test('patch joka ⊥ mainitse liitosta säilyttää sen (kenttätyö ⊥ pyyhi listaa)', async () => {
    const res = await patch(codeHeaders(db, CODE), { completed: true })
    expect(res.status).toBe(200)
    expect(linked()).toEqual(['a'])
  })

  test('tyhjästä lähtötilasta talkoolaisen lisäys syntyy', async () => {
    segId = await create({ linkedMarkerIds: undefined })
    await patch(codeHeaders(db, CODE), { linkedMarkerIds: ['b'] })
    expect(linked()).toEqual(['b'])
  })

  test('autentikoimaton ⊥ pääse lisäämään', async () => {
    const res = await patch({}, { linkedMarkerIds: ['b'] })
    expect(res.status).toBe(401)
    expect(linked()).toEqual(['a'])
  })
})
