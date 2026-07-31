import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { phaseRoutes } from './routes/phase'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/phase', phaseRoutes)
  return app
}

describe('T426/V317 + T432/V321 — aktiivinen vaihe on järjestelmän tila, kirjoitus admin-only', () => {
  let db: Database
  beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
  afterEach(() => db.close())

  test('oletus ilman asetusta on asettaminen', async () => {
    const res = await makeApp(db).request('/api/phase', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect((await res.json() as { phase: string }).phase).toBe('asettaminen')
  })

  test('talkoolainen SAA lukea vaiheen — hän tarvitsee sen tietääkseen mitä on menossa', async () => {
    const app = makeApp(db)
    await app.request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'purku' }),
    })
    const res = await app.request('/api/phase', { headers: authHeaders(db, 'talkoolainen') })
    expect((await res.json() as { phase: string }).phase).toBe('purku')
  })

  test('talkoolainen EI saa vaihtaa vaihetta (403)', async () => {
    const res = await makeApp(db).request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'purku' }),
    })
    expect(res.status).toBe(403)
  })

  // T432/V321: tämä testi KÄÄNTYI (väitti 200) ⊥ poistunut — se on säännön ainoa vahti.
  // Järjestäjä lukee vaiheen & selaa vaiheita omassa näkymässään (T434 katselusuodin),
  // mutta tapahtuman käynnistys kaikille on adminin komento.
  test('järjestäjä EI saa vaihtaa vaihetta (403) — katselu ⊥ komento', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'purku' }),
    })
    expect(res.status).toBe(403)
    // Arvo ⊥ muuttunut — hylätty kirjoitus ⊥ saa jättää sivuvaikutusta.
    const get = await app.request('/api/phase', { headers: authHeaders(db, 'järjestäjä') })
    expect((await get.json() as { phase: string }).phase).toBe('asettaminen')
  })

  test('admin vaihtaa & arvo säilyy', async () => {
    const app = makeApp(db)
    const put = await app.request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'tarkastus' }),
    })
    expect(put.status).toBe(200)
    const get = await app.request('/api/phase', { headers: authHeaders(db, 'järjestäjä') })
    expect((await get.json() as { phase: string }).phase).toBe('tarkastus')
  })

  test('epäkelpo arvo → 400, ei hiljaista putoamista oletukseen', async () => {
    const app = makeApp(db)
    await app.request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'purku' }),
    })
    const res = await app.request('/api/phase', {
      method: 'PUT',
      headers: { ...authHeaders(db, 'admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'roskaa' }),
    })
    expect(res.status).toBe(400)
    // Aiempi kelvollinen arvo ei muuttunut.
    const get = await app.request('/api/phase', { headers: authHeaders(db, 'järjestäjä') })
    expect((await get.json() as { phase: string }).phase).toBe('purku')
  })

  test('kannassa oleva roskavaihe → oletus, ei 500 (V14-linja)', async () => {
    db.run("INSERT INTO settings (key, value) VALUES ('active_phase', 'muinainen') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    const res = await makeApp(db).request('/api/phase', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect((await res.json() as { phase: string }).phase).toBe('asettaminen')
  })

  test('kirjautumaton ei näe vaihetta', async () => {
    const res = await makeApp(db).request('/api/phase')
    expect(res.status).toBe(401)
  })
})
