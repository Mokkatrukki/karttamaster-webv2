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
