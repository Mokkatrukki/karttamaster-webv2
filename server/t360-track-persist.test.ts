import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { Database as RawDatabase } from 'bun:sqlite'
import { existsSync, unlinkSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { segmentRoutes } from './routes/segments'
import { markersRoutes } from './routes/markers'
import { authHeaders, seedTestUsers } from './test-fixtures'
import { serializeDataset, restoreDataset } from './snapshot-data'
import { allSegments, ownSegments, markerInOwnSegment, ownerSegmentIds } from './marker-audit'
import { distanceToTrackM } from './track-geo'
import type { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'

// T360/V258/V259/V261 — jäljen persistointi + serverin omistajuus.

const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const at = (east: number, north: number) => ({
  lat: LAT0 + north / M_LAT,
  lon: LON0 + east / M_LON,
})

/** Suora jälki `fromE`…`toE` metriä itään, `north` metriä sivussa. */
function track(fromE: number, toE: number, north = 0, step = 100) {
  const pts: { lat: number; lon: number; d: number }[] = []
  for (let e = fromE; e <= toE; e += step) pts.push({ ...at(e, north), d: e - fromE })
  return pts
}

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/segments', segmentRoutes)
  app.route('/api/markers', markersRoutes)
  return app
}

function talkooHeaders(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  const expires = new Date(Date.now() + 3600 * 1000).toISOString()
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', 'Testi Talkoolainen', expires],
  )
  return { Cookie: `session=${id}` }
}

describe('T360 — track ja excludedMarkerIds persistoituvat', () => {
  let db: Database
  let app: Hono
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles) {
      for (const suffix of ['', '-wal', '-shm']) {
        try { if (existsSync(f + suffix)) unlinkSync(f + suffix) } catch { /* ignore */ }
      }
    }
    tmpFiles.length = 0
  })

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  test('POST tallentaa jäljen ja palauttaa sen — sarake ei putoa eksplisiittisestä listasta', async () => {
    const body = {
      id: 'seg-1',
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 500,
      phase: 'asettaminen',
      equipment: [],
      track: track(0, 500),
      excludedMarkerIds: ['m-pois'],
    }
    const res = await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(201)

    const got = await (await app.request('/api/segments', { headers: authHeaders(db, 'järjestäjä') })).json()
    expect(got[0].track).toHaveLength(6)
    expect(got[0].track[0].d).toBe(0)
    expect(got[0].excludedMarkerIds).toEqual(['m-pois'])
  })

  test('PUT joka ei mainitse jälkeä säilyttää sen; tyhjä jälki nollaa (paluu legacy-tilaan)', async () => {
    await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ id: 's', routeIds: ['r1'], startDist: 0, endDist: 500, phase: 'asettaminen', equipment: [], track: track(0, 500) }),
    })

    await app.request('/api/segments/s', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ displayName: 'Uusi nimi' }),
    })
    let got = await (await app.request('/api/segments', { headers: authHeaders(db, 'järjestäjä') })).json()
    expect(got[0].track).toHaveLength(6)
    expect(got[0].displayName).toBe('Uusi nimi')

    await app.request('/api/segments/s', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ track: [] }),
    })
    got = await (await app.request('/api/segments', { headers: authHeaders(db, 'järjestäjä') })).json()
    expect(got[0].track).toBeUndefined()
  })

  test('talkoolainen saa päivittää jäljen rajojen mukana (T363-kenttätyö)', async () => {
    await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ id: 's', routeIds: ['r1'], startDist: 0, endDist: 500, phase: 'asettaminen', equipment: [], assignedCode: 'ABC', track: track(0, 500) }),
    })

    const res = await app.request('/api/segments/s', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...talkooHeaders(db, 'ABC') },
      body: JSON.stringify({ startDist: 0, endDist: 300, track: track(0, 300) }),
    })
    expect(res.status).toBe(200)

    const got = await (await app.request('/api/segments', { headers: authHeaders(db, 'järjestäjä') })).json()
    expect(got[0].track).toHaveLength(4)
    expect(got[0].endDist).toBe(300)
  })

  test('snapshot-kierros säilyttää jäljen (V100 — SELECT * ei saa pudottaa saraketta)', async () => {
    await app.request('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ id: 's', routeIds: ['r1'], startDist: 0, endDist: 500, phase: 'asettaminen', equipment: [], track: track(0, 500), excludedMarkerIds: ['x'] }),
    })

    const dataset = serializeDataset(db)
    db.run('DELETE FROM segments')
    restoreDataset(db, dataset)

    const got = await (await app.request('/api/segments', { headers: authHeaders(db, 'järjestäjä') })).json()
    expect(got[0].track).toHaveLength(6)
    expect(got[0].excludedMarkerIds).toEqual(['x'])
  })

  test('migraatio lisää sarakkeet TUOTANNON kaltaiseen vanhaan kantaan datamenetyksettä', () => {
    // Sama kuvio kuin `db-migration.test.ts` (B84/V121): oikea vanha kanta levylle, sitten
    // `createDb` ajaa migraatiot sitä vasten. Testi joka ALTERoi itse ei testaisi migraatiota.
    const dir = mkdtempSync(join(tmpdir(), 'km-t360-'))
    const path = join(dir, 'legacy.db')
    tmpFiles.push(path)

    const raw = new RawDatabase(path)
    raw.exec(`
      CREATE TABLE segments (
        id TEXT PRIMARY KEY,
        route_ids TEXT,
        primary_route_id TEXT,
        start_dist REAL,
        end_dist REAL,
        assigned_code TEXT,
        slug TEXT,
        display_name TEXT,
        description TEXT,
        equipment TEXT NOT NULL DEFAULT '[]',
        phase TEXT NOT NULL DEFAULT 'asettaminen',
        inspected INTEGER NOT NULL DEFAULT 0,
        inspection_note TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        linked_marker_ids TEXT,
        marker_type_filter TEXT,
        updated_at TEXT NOT NULL
      )
    `)
    raw.run(
      "INSERT INTO segments (id, route_ids, primary_route_id, start_dist, end_dist, display_name, updated_at) VALUES ('vanha', '[\"r1\"]', 'r1', 1500, 4200, 'Pätkä 1', '2026-01-01')",
    )
    raw.close()

    const migrated = createDb(path)
    const row = migrated.query('SELECT * FROM segments WHERE id = ?').get('vanha') as Record<string, unknown>

    // Sarakkeet ovat olemassa & tyhjiä → V260-legacy-haara.
    expect(row.track).toBeNull()
    expect(row.excluded_marker_ids).toBeNull()
    // Vanha data koskematon.
    expect(row.start_dist).toBe(1500)
    expect(row.end_dist).toBe(4200)
    expect(row.display_name).toBe('Pätkä 1')
    migrated.close()
  })
})

describe('T360/V259 — serveri ratkaisee omistajuuden samoin kuin client', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  function insertSeg(id: string, code: string | null, trackPts: unknown, opts: { phase?: string; excluded?: string[] } = {}): void {
    db.run(
      `INSERT INTO segments (id, route_ids, primary_route_id, start_dist, end_dist, assigned_code, equipment, phase, track, excluded_marker_ids, updated_at)
       VALUES (?, '["r1"]', 'r1', 0, 1000, ?, '[]', ?, ?, ?, '2026-07-27')`,
      [id, code, opts.phase ?? 'asettaminen', trackPts ? JSON.stringify(trackPts) : null, opts.excluded ? JSON.stringify(opts.excluded) : null],
    )
  }

  test('merkki kuuluu LÄHIMMÄLLE jäljelle — ei molemmille (B143 serverillä)', () => {
    insertSeg('a', 'AAA', track(0, 1000, 0))
    insertSeg('b', 'BBB', track(0, 1000, 60))
    const marker = { id: 'm', ...at(500, 10), routeIds: ['r1'], distFromStart: 500 }

    const owners = ownerSegmentIds(allSegments(db), marker)
    expect([...owners]).toEqual(['a'])
  })

  test('403-portti seuraa samaa sääntöä: vieraan pätkän merkki torjutaan', () => {
    insertSeg('a', 'AAA', track(0, 1000, 0))
    insertSeg('b', 'BBB', track(0, 1000, 60))
    const all = allSegments(db)
    const session = { role: 'talkoolainen', talkoolainen_code: 'BBB' } as never
    const mine = ownSegments(db, session)
    const marker = { id: 'm', ...at(500, 10), routeIds: ['r1'], distFromStart: 500 }

    // Lähin jälki on a (10 m) ⊥ b (50 m) ∴ BBB:n talkoolainen ei omista tätä merkkiä.
    expect(markerInOwnSegment(mine, marker, all)).toBe(false)
    // Sama merkki 10 m b:n jäljen puolella → omistus kääntyy.
    expect(markerInOwnSegment(mine, { ...marker, ...at(500, 50) }, all)).toBe(true)
  })

  test('excludedMarkerIds torjuu vaikka jälki olisi lähin', () => {
    insertSeg('a', 'AAA', track(0, 1000, 0), { excluded: ['m'] })
    insertSeg('b', 'BBB', track(0, 1000, 60))
    const marker = { id: 'm', ...at(500, 10), routeIds: ['r1'], distFromStart: 500 }

    expect([...ownerSegmentIds(allSegments(db), marker)]).toEqual(['b'])
  })

  test('jäljetön pätkä pitää entisen km-sääntönsä (V260-välitila)', () => {
    insertSeg('legacy', 'AAA', null)
    const inRange = { id: 'in', ...at(500, 10), routeIds: ['r1'], distFromStart: 500 }
    const outOfRange = { id: 'out', ...at(9000, 10), routeIds: ['r1'], distFromStart: 9000 }

    expect(ownerSegmentIds(allSegments(db), inRange).has('legacy')).toBe(true)
    expect(ownerSegmentIds(allSegments(db), outOfRange).has('legacy')).toBe(false)
  })

  test('vanha client ilman lat/lon putoaa km-haaraan, ei hylkäykseen (V260)', () => {
    insertSeg('a', 'AAA', track(0, 1000, 0))
    // Ei lat/lon — vanha payload.
    const marker = { id: 'm', routeIds: ['r1'], distFromStart: 500 }

    expect(ownerSegmentIds(allSegments(db), marker).has('a')).toBe(true)
  })

  test('eri vaiheiden pätkät omistavat saman merkin (V91)', () => {
    insertSeg('as', 'AAA', track(0, 1000, 0), { phase: 'asettaminen' })
    insertSeg('pu', 'BBB', track(0, 1000, 0), { phase: 'purku' })
    const marker = { id: 'm', ...at(500, 10), routeIds: ['r1'], distFromStart: 500 }

    expect([...ownerSegmentIds(allSegments(db), marker)].sort()).toEqual(['as', 'pu'])
  })
})

describe('T360/V261 — serverin projektio vastaa frontin odotusarvoja', () => {
  // SAMA geometria & SAMAT odotusarvot kuin `tests/segment-track.test.ts`:ssä. Kaksi
  // toteutusta ilman yhteistä odotusarvoa ajautuu erilleen (B100-suku) ∴ tämä on se side.
  test('kohtisuora etäisyys janalle, ei kärkipisteeseen (20 m ⊥ 102 m)', () => {
    const t = [{ ...at(0, 0), d: 0 }, { ...at(200, 0), d: 200 }]
    const m = at(100, 20)
    expect(Math.abs(distanceToTrackM(t, m.lat, m.lon) - 20)).toBeLessThan(1)
  })

  test('harva GPX: 30 m kohtisuora siellä missä kärkipiste antaisi 47.6 m', () => {
    const t = [{ ...at(0, 0), d: 0 }, { ...at(73.8, 0), d: 73.8 }]
    const m = at(36.9, 30)
    expect(Math.abs(distanceToTrackM(t, m.lat, m.lon) - 30)).toBeLessThan(1)
  })

  test('tyhjä jälki ei voita ketään', () => {
    expect(distanceToTrackM([], LAT0, LON0)).toBe(Infinity)
  })
})
