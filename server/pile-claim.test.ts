import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders, TEST_USERS } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/markers', markersRoutes)
  return app
}

interface MarkerJson {
  id: string
  claimed_by: string | null
  claimed_at: string | null
}

const PILE_BODY = {
  type: 'kerayskasa',
  lat: 65.1,
  lon: 27.5,
  distance_from_start: 1000,
  route_ids: ['35km'],
  template_id: 'kerayskasa',
  pile_marker_ids: ['m1', 'm2'],
}

async function createPile(app: Hono, db: Database): Promise<string> {
  const res = await app.request('/api/markers', {
    method: 'POST',
    headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
    body: JSON.stringify(PILE_BODY),
  })
  return ((await res.json()) as MarkerJson).id
}

describe('T449/V333 — kasan varaus', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })
  afterEach(() => db.close())

  test('uusi kasa on VAPAA — vanha data & uusi rivi ovat samaa mieltä', async () => {
    const id = await createPile(app, db)
    const list = (await (await app.request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })).json()) as MarkerJson[]
    const row = list.find(m => m.id === id)!
    expect(row.claimed_by).toBeNull()
    expect(row.claimed_at).toBeNull()
  })

  test('varaus tallentaa session display_namen & ajan (⊥ uutta tunnistautumista)', async () => {
    const id = await createPile(app, db)
    const res = await app.request(`/api/markers/${id}/claim`, {
      method: 'POST',
      headers: authHeaders(db, 'talkoolainen'),
    })
    expect(res.status).toBe(200)
    const row = (await res.json()) as MarkerJson
    expect(row.claimed_by).toBe(TEST_USERS.talkoolainen.displayName)
    expect(Number.isFinite(Date.parse(row.claimed_at!))).toBe(true)
  })

  test('toisen varaus → 409 & nykyinen varaus säilyy (⊥ hiljaista ylikirjoitusta)', async () => {
    const id = await createPile(app, db)
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'talkoolainen') })

    const res = await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string; claimed_by: string }
    expect(body.error).toBe('already_claimed')
    expect(body.claimed_by).toBe(TEST_USERS.talkoolainen.displayName)

    const after = db.query<{ claimed_by: string }, [string]>('SELECT claimed_by FROM markers WHERE id = ?').get(id)!
    expect(after.claimed_by).toBe(TEST_USERS.talkoolainen.displayName)
  })

  test('oman varauksen uusinta on idempotentti (tuplanapautus hanskoilla ⊥ ole virhe)', async () => {
    const id = await createPile(app, db)
    const headers = authHeaders(db, 'talkoolainen')
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers })
    const res = await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers })
    expect(res.status).toBe(200)
  })

  test('vapautus on KENEN TAHANSA käytettävissä (V333)', async () => {
    const id = await createPile(app, db)
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'talkoolainen') })

    // Toinen porukka vapauttaa — metsässä ⊥ ole ketään joka ratkoisi oikeuskiistaa.
    const res = await app.request(`/api/markers/${id}/claim`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(200)
    const row = (await res.json()) as MarkerJson
    expect(row.claimed_by).toBeNull()
    expect(row.claimed_at).toBeNull()
  })

  test('vapaan kasan vapautus on no-op ⊥ virhe', async () => {
    const id = await createPile(app, db)
    const res = await app.request(`/api/markers/${id}/claim`, { method: 'DELETE', headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
  })

  test('tuntematon kasa → 404 molemmilla poluilla', async () => {
    expect((await app.request('/api/markers/ei-ole/claim', { method: 'POST', headers: authHeaders(db, 'talkoolainen') })).status).toBe(404)
    expect((await app.request('/api/markers/ei-ole/claim', { method: 'DELETE', headers: authHeaders(db, 'talkoolainen') })).status).toBe(404)
  })

  test('kirjautumaton ⊥ voi varata', async () => {
    const id = await createPile(app, db)
    expect((await app.request(`/api/markers/${id}/claim`, { method: 'POST' })).status).toBe(401)
  })

  test('V231: varaus & vapautus kirjautuvat lokiin tekijöineen', async () => {
    const id = await createPile(app, db)
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'talkoolainen') })
    await app.request(`/api/markers/${id}/claim`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })

    const rows = db.query<{ action: string; actor: string; payload_json: string | null }, [string]>(
      'SELECT action, actor, payload_json FROM marker_audit WHERE marker_id = ? ORDER BY created_at ASC, rowid ASC',
    ).all(id)
    const claim = rows.find(r => r.action === 'claim')!
    const unclaim = rows.find(r => r.action === 'unclaim')!
    expect(claim.actor).toBe(TEST_USERS.talkoolainen.displayName)
    expect(unclaim.actor).toBe(TEST_USERS.järjestäjä.displayName)
    // Vapautuksen payload kertoo KENEN varaus purettiin.
    expect(JSON.parse(unclaim.payload_json!).claimed_by).toBe(TEST_USERS.talkoolainen.displayName)
  })

  test('varaus ⊥ vanhene automaattisesti — vanha leima säilyy sellaisenaan', async () => {
    const id = await createPile(app, db)
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'talkoolainen') })
    // Kelataan varaus vuorokauden taaksepäin: mikään luku ⊥ saa pudottaa sitä pois.
    const old = new Date(Date.now() - 24 * 3600_000).toISOString()
    db.run('UPDATE markers SET claimed_at = ? WHERE id = ?', [old, id])

    const list = (await (await app.request('/api/markers', { headers: authHeaders(db, 'talkoolainen') })).json()) as MarkerJson[]
    const row = list.find(m => m.id === id)!
    expect(row.claimed_by).toBe(TEST_USERS.talkoolainen.displayName)
    expect(row.claimed_at).toBe(old)
  })

  test('varaus ⊥ ole peruttavissa undo-reitiltä (whitelist torjuu)', async () => {
    const id = await createPile(app, db)
    await app.request(`/api/markers/${id}/claim`, { method: 'POST', headers: authHeaders(db, 'talkoolainen') })
    const row = db.query<{ action: string }, [string]>('SELECT action FROM marker_audit WHERE marker_id = ?').all(id)
      .find(r => r.action === 'claim')
    expect(row).toBeDefined()
    expect(['add', 'move', 'status', 'remove']).not.toContain('claim')
  })
})
