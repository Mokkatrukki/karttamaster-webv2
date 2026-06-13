import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

interface SegmentRow {
  id: string
  route_ids: string
  start_dist: number
  end_dist: number
  assigned_code: string | null
  display_name: string | null
  description: string | null
  equipment: string
  phase: string
  updated_at: string
}

function rowToSegment(row: SegmentRow) {
  return {
    id: row.id,
    routeIds: JSON.parse(row.route_ids) as string[],
    startDist: row.start_dist,
    endDist: row.end_dist,
    assignedCode: row.assigned_code ?? undefined,
    displayName: row.display_name ?? undefined,
    description: row.description ?? undefined,
    equipment: JSON.parse(row.equipment) as { name: string; count: number }[],
    phase: row.phase as 'asettaminen' | 'purku',
  }
}

export const segmentRoutes = new Hono<AuthEnv>()

// Järjestäjä: hae kaikki segmentit
segmentRoutes.get('/', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<SegmentRow, []>('SELECT * FROM segments ORDER BY start_dist ASC').all()
  return c.json(rows.map(rowToSegment))
})

// Järjestäjä: luo tai päivitä (upsert by id)
segmentRoutes.post('/', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    id?: string
    routeIds: string[]
    startDist: number
    endDist: number
    assignedCode?: string
    displayName?: string
    description?: string
    equipment?: { name: string; count: number }[]
    phase?: string
  }>()

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, display_name, description, equipment, phase, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       route_ids = excluded.route_ids,
       start_dist = excluded.start_dist,
       end_dist = excluded.end_dist,
       assigned_code = excluded.assigned_code,
       display_name = excluded.display_name,
       description = excluded.description,
       equipment = excluded.equipment,
       phase = excluded.phase,
       updated_at = excluded.updated_at`,
    [
      id,
      JSON.stringify(body.routeIds),
      body.startDist,
      body.endDist,
      body.assignedCode?.toUpperCase() ?? null,
      body.displayName ?? null,
      body.description ?? null,
      JSON.stringify(body.equipment ?? []),
      body.phase ?? 'asettaminen',
      now,
    ],
  )

  const row = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)!
  return c.json(rowToSegment(row), 201)
})

// Järjestäjä: päivitä (patch)
segmentRoutes.put('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json<Partial<{
    routeIds: string[]
    startDist: number
    endDist: number
    assignedCode: string | null
    displayName: string
    description: string
    equipment: { name: string; count: number }[]
    phase: string
  }>>()

  const existing = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const now = new Date().toISOString()
  db.run(
    `UPDATE segments SET
      route_ids = ?, start_dist = ?, end_dist = ?, assigned_code = ?,
      display_name = ?, description = ?, equipment = ?, phase = ?, updated_at = ?
     WHERE id = ?`,
    [
      body.routeIds ? JSON.stringify(body.routeIds) : existing.route_ids,
      body.startDist ?? existing.start_dist,
      body.endDist ?? existing.end_dist,
      'assignedCode' in body ? (body.assignedCode?.toUpperCase() ?? null) : existing.assigned_code,
      body.displayName ?? existing.display_name,
      body.description !== undefined ? body.description : existing.description,
      body.equipment ? JSON.stringify(body.equipment) : existing.equipment,
      body.phase ?? existing.phase,
      now,
      id,
    ],
  )

  const row = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)!
  return c.json(rowToSegment(row))
})

// Järjestäjä: poista
segmentRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  db.run('DELETE FROM segments WHERE id = ?', [id])
  return c.json({ ok: true })
})

// Talkoolainen: hae oma pätkä koodilla (auth vaaditaan — session.talkoolainen_code)
segmentRoutes.get('/by-code/:code', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const code = c.req.param('code').toUpperCase()
  const row = db.query<SegmentRow, [string]>(
    'SELECT * FROM segments WHERE assigned_code = ?',
  ).get(code)
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.json(rowToSegment(row))
})
