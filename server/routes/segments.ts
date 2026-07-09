import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

interface SegmentRow {
  id: string
  route_ids: string | null
  start_dist: number | null
  end_dist: number | null
  assigned_code: string | null
  display_name: string | null
  description: string | null
  equipment: string
  phase: string
  inspected: number
  inspection_note: string | null
  updated_at: string
}

function rowToSegment(row: SegmentRow) {
  return {
    // V141: reititön tehtävä — route-kentät null kannassa → undefined ulos.
    id: row.id,
    routeIds: row.route_ids ? (JSON.parse(row.route_ids) as string[]) : undefined,
    startDist: row.start_dist ?? undefined,
    endDist: row.end_dist ?? undefined,
    assignedCode: row.assigned_code ?? undefined,
    displayName: row.display_name ?? undefined,
    description: row.description ?? undefined,
    equipment: JSON.parse(row.equipment) as { name: string; count: number }[],
    phase: row.phase as 'asettaminen' | 'tarkastus' | 'purku',
    inspected: !!row.inspected,
    inspectionNote: row.inspection_note ?? undefined,
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
    routeIds?: string[]
    startDist?: number
    endDist?: number
    assignedCode?: string
    displayName?: string
    description?: string
    equipment?: { name: string; count: number }[]
    phase?: string
    inspected?: boolean
    inspectionNote?: string
  }>()

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO segments (id, route_ids, start_dist, end_dist, assigned_code, display_name, description, equipment, phase, inspected, inspection_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       route_ids = excluded.route_ids,
       start_dist = excluded.start_dist,
       end_dist = excluded.end_dist,
       assigned_code = excluded.assigned_code,
       display_name = excluded.display_name,
       description = excluded.description,
       equipment = excluded.equipment,
       phase = excluded.phase,
       inspected = excluded.inspected,
       inspection_note = excluded.inspection_note,
       updated_at = excluded.updated_at`,
    [
      id,
      // V141: reititön tehtävä → route-kentät null kantaan.
      body.routeIds != null ? JSON.stringify(body.routeIds) : null,
      body.startDist ?? null,
      body.endDist ?? null,
      body.assignedCode?.toUpperCase() ?? null,
      body.displayName ?? null,
      body.description ?? null,
      JSON.stringify(body.equipment ?? []),
      body.phase ?? 'asettaminen',
      body.inspected ? 1 : 0,
      body.inspectionNote ?? null,
      now,
    ],
  )

  const row = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)!
  return c.json(rowToSegment(row), 201)
})

// Päivitä (patch). Järjestäjä+ kaikki kentät; talkoolainen vain oma pätkä + rajatut kentät (V93/V43).
segmentRoutes.put('/:id', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const session = c.get('session')
  const id = c.req.param('id')
  const raw = await c.req.json<Partial<{
    routeIds: string[]
    startDist: number
    endDist: number
    assignedCode: string | null
    displayName: string
    description: string
    equipment: { name: string; count: number }[]
    phase: string
    inspected: boolean
    inspectionNote: string
  }>>()

  const existing = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const isOrganizer = session.role === 'admin' || session.role === 'järjestäjä'
  const isOwnTalkoolainen =
    session.role === 'talkoolainen' &&
    session.talkoolainen_code != null &&
    existing.assigned_code != null &&
    session.talkoolainen_code.toUpperCase() === existing.assigned_code.toUpperCase()
  if (!isOrganizer && !isOwnTalkoolainen) return c.json({ error: 'forbidden' }, 403)

  // V93 (T224 laajennus): talkoolainen saa muuttaa oman pätkän kenttätyön kentät: inspected/
  // inspectionNote/startDist/endDist + equipment (varustelistan päivitys ennen lähtöä, VISION r42/239).
  const body = isOrganizer
    ? raw
    : {
        inspected: raw.inspected,
        inspectionNote: raw.inspectionNote,
        startDist: raw.startDist,
        endDist: raw.endDist,
        equipment: raw.equipment,
      }

  const now = new Date().toISOString()
  db.run(
    `UPDATE segments SET
      route_ids = ?, start_dist = ?, end_dist = ?, assigned_code = ?,
      display_name = ?, description = ?, equipment = ?, phase = ?,
      inspected = ?, inspection_note = ?, updated_at = ?
     WHERE id = ?`,
    [
      'routeIds' in body && body.routeIds ? JSON.stringify(body.routeIds) : existing.route_ids,
      body.startDist ?? existing.start_dist,
      body.endDist ?? existing.end_dist,
      'assignedCode' in body ? (body.assignedCode?.toUpperCase() ?? null) : existing.assigned_code,
      'displayName' in body ? (body.displayName ?? existing.display_name) : existing.display_name,
      'description' in body && body.description !== undefined ? body.description : existing.description,
      'equipment' in body && body.equipment ? JSON.stringify(body.equipment) : existing.equipment,
      'phase' in body ? (body.phase ?? existing.phase) : existing.phase,
      body.inspected !== undefined ? (body.inspected ? 1 : 0) : existing.inspected,
      body.inspectionNote !== undefined ? body.inspectionNote : existing.inspection_note,
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
