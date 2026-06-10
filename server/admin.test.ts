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

interface MapStateJson {
  status: string
  approved_at?: string
  approved_by?: string
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
      bearing: 90,
      distance_from_start: 1000,
      route_ids: ['35km'],
    }),
  })
}

describe('T48: Kartta-tila API', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  afterEach(() => db.close())

  // ── GET /api/admin/map-state ────────────────────────────────────────────

  describe('GET /api/admin/map-state', () => {
    test('returns luonnos by default', async () => {
      const res = await app.request('/api/admin/map-state', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MapStateJson
      expect(body.status).toBe('luonnos')
      expect(body.approved_at).toBeUndefined()
      expect(body.approved_by).toBeUndefined()
    })

    test('returns approved_at and approved_by after approval', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      const res = await app.request('/api/admin/map-state', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      const body = await res.json() as MapStateJson
      expect(body.status).toBe('hyväksytty')
      expect(body.approved_at).toBeTruthy()
      expect(body.approved_by).toBeTruthy()
    })

    test('talkoolainen 403 — V22 role gate', async () => {
      const res = await app.request('/api/admin/map-state', {
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('unauthenticated 401', async () => {
      const res = await app.request('/api/admin/map-state')
      expect(res.status).toBe(401)
    })

    test('admin can access', async () => {
      const res = await app.request('/api/admin/map-state', {
        headers: authHeaders(db, 'admin'),
      })
      expect(res.status).toBe(200)
    })
  })

  // ── POST /api/admin/map-state ───────────────────────────────────────────

  describe('POST /api/admin/map-state', () => {
    test('set hyväksytty → status updated', async () => {
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { status: string }
      expect(body.status).toBe('hyväksytty')
    })

    test('set luonnos → status updated', async () => {
      // First approve
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      // Then revert
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'luonnos' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as MapStateJson
      expect(body.status).toBe('luonnos')
    })

    test('invalid status → 400', async () => {
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'tuntematon' }),
      })
      expect(res.status).toBe(400)
    })

    test('missing status → 400', async () => {
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    test('talkoolainen 403', async () => {
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      expect(res.status).toBe(403)
    })

    test('unauthenticated 401', async () => {
      const res = await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ── V23: auto-snapshot on approval ──────────────────────────────────────

  describe('V23 — auto-snapshot on hyväksytty', () => {
    test('approval creates snapshot', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      const snapshots = db.query<SnapshotRow, []>('SELECT * FROM snapshots').all()
      expect(snapshots.length).toBe(1)
      expect(snapshots[0].trigger).toBe('auto-hyväksytty')
      expect(snapshots[0].label).toBe('Hyväksytty')
    })

    test('snapshot includes all current markers', async () => {
      await seedMarker(db, app)
      await seedMarker(db, app)
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      const snap = db.query<SnapshotRow, []>('SELECT * FROM snapshots').get()!
      const markers = JSON.parse(snap.markers_json) as unknown[]
      expect(markers.length).toBe(2)
    })

    test('snapshot with zero markers is valid (V23: always creates)', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      const snapshots = db.query<SnapshotRow, []>('SELECT * FROM snapshots').all()
      expect(snapshots.length).toBe(1)
    })

    test('revert to luonnos does NOT create snapshot', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'luonnos' }),
      })
      const snapshots = db.query<SnapshotRow, []>('SELECT * FROM snapshots').all()
      // Only the initial approval created a snapshot
      expect(snapshots.length).toBe(1)
    })

    test('multiple approvals each create a snapshot', async () => {
      for (let i = 0; i < 3; i++) {
        await app.request('/api/admin/map-state', {
          method: 'POST',
          headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'hyväksytty' }),
        })
      }
      const snapshots = db.query<SnapshotRow, []>('SELECT * FROM snapshots').all()
      expect(snapshots.length).toBe(3)
    })

    test('snapshot created_by matches session display_name', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      const snap = db.query<SnapshotRow, []>('SELECT * FROM snapshots').get()!
      expect(snap.created_by).toBe('Testi Järjestäjä')
    })
  })

  // ── Revert clears approval metadata ─────────────────────────────────────

  describe('luonnos revert clears metadata', () => {
    test('approved_at and approved_by absent after revert', async () => {
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'luonnos' }),
      })
      const res = await app.request('/api/admin/map-state', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      const body = await res.json() as MapStateJson
      expect(body.status).toBe('luonnos')
      expect(body.approved_at).toBeUndefined()
      expect(body.approved_by).toBeUndefined()
    })
  })
})

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
      // Create via approval
      await app.request('/api/admin/map-state', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
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
