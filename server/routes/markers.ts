import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

export const markersRoutes = new Hono<AuthEnv>()

interface MarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  distance_from_start: number
  route_ids: string
  status: string
  location_note: string | null
  color: string | null
  short_label: string | null
  bearing_manual: number
  updated_at: string
  updated_by: string | null
}

function toJson(row: MarkerRow) {
  return { ...row, route_ids: JSON.parse(row.route_ids) as string[] }
}

// GET /api/markers — kaikki autentikoidut käyttäjät näkevät merkit
markersRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<MarkerRow, []>('SELECT * FROM markers ORDER BY distance_from_start ASC').all()
  return c.json(rows.map(toJson))
})

// POST /api/markers — järjestäjä+
markersRoutes.post('/', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<{
    id?: string
    type?: string
    lat?: number
    lon?: number
    bearing?: number
    distance_from_start?: number
    route_ids?: string[]
    status?: string
    location_note?: string
    color?: string | null
    short_label?: string | null
    bearing_manual?: boolean
  }>()

  if (
    body.type === undefined ||
    body.lat === undefined ||
    body.lon === undefined ||
    body.bearing === undefined ||
    body.distance_from_start === undefined ||
    !body.route_ids
  ) {
    return c.json({ error: 'missing_fields' }, 400)
  }

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO markers (id, type, lat, lon, bearing, distance_from_start, route_ids, status, location_note, color, short_label, bearing_manual, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      body.type,
      body.lat,
      body.lon,
      body.bearing,
      body.distance_from_start,
      JSON.stringify(body.route_ids),
      body.status ?? 'suunniteltu',
      body.location_note ?? null,
      body.color ?? null,
      body.short_label ?? null,
      body.bearing_manual ? 1 : 0,
      now,
      session.display_name,
    ],
  )

  const row = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(row), 201)
})

// PUT /api/markers/:id — status: kaikki autentikoidut; lat/lon/bearing/type: järjestäjä+
markersRoutes.put('/:id', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const body = await c.req.json<{
    status?: string
    location_note?: string
    lat?: number
    lon?: number
    bearing?: number
    bearing_manual?: boolean
    type?: string
    distance_from_start?: number
    route_ids?: string[]
  }>()

  const positionFields = ['lat', 'lon', 'bearing', 'type', 'distance_from_start', 'route_ids'] as const
  const hasPositionFields = positionFields.some((f) => f in body)
  if (hasPositionFields && !['admin', 'järjestäjä'].includes(session.role)) {
    return c.json({ error: 'forbidden' }, 403)
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status) }
  if (body.location_note !== undefined) { fields.push('location_note = ?'); values.push(body.location_note) }
  if (body.lat !== undefined) { fields.push('lat = ?'); values.push(body.lat) }
  if (body.lon !== undefined) { fields.push('lon = ?'); values.push(body.lon) }
  if (body.bearing !== undefined) { fields.push('bearing = ?'); values.push(body.bearing) }
  if (body.bearing_manual !== undefined) { fields.push('bearing_manual = ?'); values.push(body.bearing_manual ? 1 : 0) }
  if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type) }
  if (body.distance_from_start !== undefined) { fields.push('distance_from_start = ?'); values.push(body.distance_from_start) }
  if (body.route_ids !== undefined) { fields.push('route_ids = ?'); values.push(JSON.stringify(body.route_ids)) }

  if (fields.length === 0) return c.json({ error: 'no_fields' }, 400)

  fields.push('updated_at = ?'); values.push(new Date().toISOString())
  fields.push('updated_by = ?'); values.push(session.display_name)
  values.push(id)

  db.run(`UPDATE markers SET ${fields.join(', ')} WHERE id = ?`, values as string[])

  const updated = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(updated))
})

// DELETE /api/markers/:id — järjestäjä+
markersRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  db.run('DELETE FROM markers WHERE id = ?', [id])
  return c.json({ ok: true })
})
