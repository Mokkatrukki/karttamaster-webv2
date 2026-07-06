import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { adminRoutes } from './routes/admin'
import { markersRoutes } from './routes/markers'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/admin', adminRoutes)
  app.route('/api/markers', markersRoutes)
  return app
}

interface SnapshotRow {
  id: string
  label: string
  markers_json: string
  created_at: string
  created_by: string
  trigger: string
}

interface SnapshotListItem {
  id: string
  label: string
  created_at: string
  created_by: string
  trigger: string
}

async function seedMarker(db: Database, app: ReturnType<typeof makeApp>): Promise<void> {
  await app.request('/api/markers', {
    method: 'POST',
    headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'nuoli-oikealle',
      lat: 65.1,
      lon: 27.5,
      distance_from_start: 1000,
      route_ids: ['35km'],
    }),
  })
}


describe('T50: Snapshot API', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  afterEach(() => db.close())

  // ── GET /api/admin/snapshots ─────────────────────────────────────────────

  describe('GET /api/admin/snapshots', () => {
    test('returns empty list initially', async () => {
      const res = await app.request('/api/admin/snapshots', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as SnapshotListItem[]
      expect(body).toEqual([])
    })

    test('returns created snapshots, newest first', async () => {
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Ensimmäinen' }),
      })
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Manuaalinen testi' }),
      })
      const res = await app.request('/api/admin/snapshots', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      const body = await res.json() as SnapshotListItem[]
      expect(body.length).toBe(2)
      expect(body[0].label).toBe('Manuaalinen testi')
    })

    test('does not return markers_json', async () => {
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await app.request('/api/admin/snapshots', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      const body = await res.json() as Record<string, unknown>[]
      expect(body[0].markers_json).toBeUndefined()
    })

    test('talkoolainen 403', async () => {
      const res = await app.request('/api/admin/snapshots', {
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('unauthenticated 401', async () => {
      const res = await app.request('/api/admin/snapshots')
      expect(res.status).toBe(401)
    })

    test('max 20 enforced — oldest pruned on creation', async () => {
      // Create 22 snapshots
      for (let i = 0; i < 22; i++) {
        await app.request('/api/admin/snapshots', {
          method: 'POST',
          headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: `snap-${i}` }),
        })
      }
      const res = await app.request('/api/admin/snapshots', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      const body = await res.json() as SnapshotListItem[]
      expect(body.length).toBe(20)
      // Newest is last created
      expect(body[0].label).toBe('snap-21')
      // Oldest (snap-0, snap-1) pruned
      expect(body.find(s => s.label === 'snap-0')).toBeUndefined()
    })
  })

  // ── POST /api/admin/snapshots ────────────────────────────────────────────

  describe('POST /api/admin/snapshots', () => {
    test('creates snapshot with provided label', async () => {
      const res = await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Ennen isoa muutosta' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as SnapshotListItem
      expect(body.label).toBe('Ennen isoa muutosta')
      expect(body.trigger).toBe('manual')
    })

    test('creates snapshot with auto-label when no label given', async () => {
      const res = await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as SnapshotListItem
      expect(body.label).toMatch(/Manuaalinen/)
    })

    test('snapshot captures current markers', async () => {
      await seedMarker(db, app)
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'testi' }),
      })
      const snap = db.query<SnapshotRow, []>('SELECT * FROM snapshots').get()!
      const markers = JSON.parse(snap.markers_json) as unknown[]
      expect(markers.length).toBe(1)
    })

    test('talkoolainen 403', async () => {
      const res = await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(403)
    })
  })

  // ── POST /api/admin/snapshots/:id/restore ────────────────────────────────

  describe('POST /api/admin/snapshots/:id/restore — V24', () => {
    test('restore replaces all markers atomically', async () => {
      // Create 2 markers
      await seedMarker(db, app)
      await seedMarker(db, app)
      // Take snapshot
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Ennen' }),
      })
      const snap = db.query<SnapshotListItem, [string]>(
        'SELECT id FROM snapshots WHERE trigger = ? ORDER BY created_at DESC LIMIT 1',
      ).get('manual')!
      // Add a 3rd marker after snapshot
      await seedMarker(db, app)
      expect(db.query('SELECT * FROM markers').all().length).toBe(3)

      // Restore to snapshot (2 markers)
      const res = await app.request(`/api/admin/snapshots/${snap.id}/restore`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      expect(db.query('SELECT * FROM markers').all().length).toBe(2)
    })

    test('restore creates "Palautus: ..." snapshot — V24', async () => {
      await app.request('/api/admin/snapshots', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Versio 1' }),
      })
      const snap = db.query<{ id: string }, []>('SELECT id FROM snapshots LIMIT 1').get()!
      await app.request(`/api/admin/snapshots/${snap.id}/restore`, {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
      })
      const snapshots = db.query<SnapshotRow, []>('SELECT * FROM snapshots ORDER BY created_at ASC').all()
      const restoreSnap = snapshots.find(s => s.trigger === 'restore')
      expect(restoreSnap).toBeTruthy()
      expect(restoreSnap!.label).toBe('Palautus: Versio 1')
    })

    test('restore 404 for unknown id', async () => {
      const res = await app.request('/api/admin/snapshots/tuntematon-id/restore', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })

    test('talkoolainen 403', async () => {
      const res = await app.request('/api/admin/snapshots/some-id/restore', {
        method: 'POST',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('unauthenticated 401', async () => {
      const res = await app.request('/api/admin/snapshots/some-id/restore', { method: 'POST' })
      expect(res.status).toBe(401)
    })
  })
})

// ── T162/V100: snapshot kattaa koko datasetin ────────────────────────────────

function seedMarkerDirect(db: Database, id: string, extra: Record<string, unknown> = {}): void {
  db.run(
    'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at, color, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, 'nuoli-oikealle', 65.1, 27.5, 1000, '["35km"]', 'suunniteltu', new Date().toISOString(), extra.color ?? '#ff0000', extra.label ?? 'Oikealle'],
  )
}

function seedSegment(db: Database, id: string): void {
  db.run(
    'INSERT INTO segments (id, route_ids, start_dist, end_dist, phase, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, '["35km"]', 0, 500, 'purku', new Date().toISOString()],
  )
}

function seedArea(db: Database, id: string, hash: string): void {
  db.run(
    'INSERT INTO areas (id, name, center_lat, center_lng, width_m, height_m, hash_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, 'Huoltoalue', 65.2, 27.6, 100, 80, hash],
  )
  db.run(
    'INSERT INTO area_features (id, area_id, center_lat, center_lng, width_m, height_m, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [`${id}-f`, id, 65.2, 27.6, 20, 20, '#00ff00'],
  )
}

describe('T162: snapshot kattaa koko datasetin (V100)', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  afterEach(() => db.close())

  async function takeSnapshot(): Promise<string> {
    const res = await app.request('/api/admin/snapshots', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Koko dataset' }),
    })
    return (await res.json() as { id: string }).id
  }

  function count(table: string): number {
    return (db.query<{ n: number }, []>(`SELECT COUNT(*) as n FROM ${table}`).get()!).n
  }

  test('full snapshot → restore palauttaa kaikki 4 taulua', async () => {
    seedMarkerDirect(db, 'm1')
    seedSegment(db, 's1')
    seedArea(db, 'a1', 'HASH-A1')

    const snapId = await takeSnapshot()

    // Tyhjennä kaikki (lapset ensin FK:n takia)
    db.run('DELETE FROM area_features')
    db.run('DELETE FROM areas')
    db.run('DELETE FROM markers')
    db.run('DELETE FROM segments')
    expect(count('markers')).toBe(0)

    const res = await app.request(`/api/admin/snapshots/${snapId}/restore`, {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(res.status).toBe(200)

    expect(count('markers')).toBe(1)
    expect(count('segments')).toBe(1)
    expect(count('areas')).toBe(1)
    expect(count('area_features')).toBe(1)
    // segmentin phase + alueen nimi round-trippaavat
    expect(db.query<{ phase: string }, []>('SELECT phase FROM segments').get()!.phase).toBe('purku')
  })

  test('generic insert round-trippaa aiemmin dropatut sarakkeet (color/label)', async () => {
    seedMarkerDirect(db, 'm1', { color: '#123456', label: 'Testikyltti' })
    const snapId = await takeSnapshot()
    db.run('DELETE FROM markers')

    await app.request(`/api/admin/snapshots/${snapId}/restore`, {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    })

    const m = db.query<{ color: string; label: string }, []>('SELECT color, label FROM markers').get()!
    expect(m.color).toBe('#123456')
    expect(m.label).toBe('Testikyltti')
  })

  test('legacy markers-only snapshot: restore korvaa vain markers, jättää segments/areas koskematta', async () => {
    seedSegment(db, 's1')
    seedArea(db, 'a1', 'HASH-A1')

    // Manuaali legacy-snapshot: dataset_json NULL, markers_json = yksi merkki
    const legacyMarker = { id: 'legacy-m', type: 'nuoli-oikealle', lat: 65, lon: 27, distance_from_start: 0, route_ids: '["35km"]', status: 'suunniteltu', updated_at: new Date().toISOString() }
    db.run(
      "INSERT INTO snapshots (id, label, markers_json, dataset_json, created_at, created_by, trigger) VALUES (?, ?, ?, NULL, ?, ?, ?)",
      ['legacy-snap', 'Legacy', JSON.stringify([legacyMarker]), new Date().toISOString(), 'system', 'auto-yö'],
    )

    const res = await app.request('/api/admin/snapshots/legacy-snap/restore', {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(res.status).toBe(200)

    // markers korvattu legacy-merkillä
    expect(count('markers')).toBe(1)
    expect(db.query<{ id: string }, []>('SELECT id FROM markers').get()!.id).toBe('legacy-m')
    // segments/areas EIVÄT hävinneet
    expect(count('segments')).toBe(1)
    expect(count('areas')).toBe(1)
    expect(count('area_features')).toBe(1)
  })

  test('restore on atominen: viallinen segment-rivi → mikään ei muutu', async () => {
    seedMarkerDirect(db, 'alkuperainen')

    // dataset jossa validi marker mutta segment ilman NOT NULL start_dist → INSERT kaatuu
    const badDataset = {
      version: 1,
      markers: [{ id: 'uusi-m', type: 'x', lat: 1, lon: 2, distance_from_start: 0, route_ids: '[]', status: 'suunniteltu', updated_at: 'now' }],
      segments: [{ id: 'bad-seg', route_ids: '[]' }], // puuttuu start_dist/end_dist/updated_at (NOT NULL)
      areas: [],
      areaFeatures: [],
    }
    db.run(
      "INSERT INTO snapshots (id, label, markers_json, dataset_json, created_at, created_by, trigger) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['bad-snap', 'Bad', '[]', JSON.stringify(badDataset), new Date().toISOString(), 'system', 'manual'],
    )

    await app.request('/api/admin/snapshots/bad-snap/restore', {
      method: 'POST',
      headers: authHeaders(db, 'järjestäjä'),
    }).catch(() => {})

    // rollback: alkuperäinen marker ennallaan, uutta ei tullut
    expect(count('markers')).toBe(1)
    expect(db.query<{ id: string }, []>('SELECT id FROM markers').get()!.id).toBe('alkuperainen')
    expect(count('segments')).toBe(0)
  })
})
