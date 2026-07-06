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
  distance_from_start: number
  route_ids: string
  status: string
  location_note: string | null
  color: string | null
  short_label: string | null
  label: string | null
  description: string | null
  updated_at: string
  updated_by: string | null
}

function imageUrls(db: Database, markerId: string): string[] {
  const rows = db
    .query<{ id: string }, [string]>('SELECT id FROM marker_images WHERE marker_id = ? ORDER BY created_at ASC')
    .all(markerId)
  return rows.map((r) => `/api/markers/${markerId}/images/${r.id}`)
}

function toJson(db: Database, row: MarkerRow) {
  return { ...row, route_ids: JSON.parse(row.route_ids) as string[], images: imageUrls(db, row.id) }
}

// GET /api/markers — kaikki autentikoidut käyttäjät näkevät merkit
markersRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<MarkerRow, []>('SELECT * FROM markers ORDER BY distance_from_start ASC').all()
  return c.json(rows.map((row) => toJson(db, row)))
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
    distance_from_start?: number
    route_ids?: string[]
    status?: string
    location_note?: string
    color?: string | null
    short_label?: string | null
    label?: string | null
    description?: string | null
  }>()

  if (
    body.type === undefined ||
    body.lat === undefined ||
    body.lon === undefined ||
    body.distance_from_start === undefined ||
    !body.route_ids
  ) {
    return c.json({ error: 'missing_fields' }, 400)
  }

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, location_note, color, short_label, label, description, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      body.type,
      body.lat,
      body.lon,
      body.distance_from_start,
      JSON.stringify(body.route_ids),
      body.status ?? 'suunniteltu',
      body.location_note ?? null,
      body.color ?? null,
      body.short_label ?? null,
      body.label ?? null,
      body.description ?? null,
      now,
      session.display_name,
    ],
  )

  const row = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(db, row), 201)
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
    type?: string
    distance_from_start?: number
    route_ids?: string[]
    description?: string | null
  }>()

  const positionFields = ['lat', 'lon', 'type', 'distance_from_start', 'route_ids', 'description'] as const
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
  if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type) }
  if (body.distance_from_start !== undefined) { fields.push('distance_from_start = ?'); values.push(body.distance_from_start) }
  if (body.route_ids !== undefined) { fields.push('route_ids = ?'); values.push(JSON.stringify(body.route_ids)) }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description) }

  if (fields.length === 0) return c.json({ error: 'no_fields' }, 400)

  fields.push('updated_at = ?'); values.push(new Date().toISOString())
  fields.push('updated_by = ?'); values.push(session.display_name)
  values.push(id)

  db.run(`UPDATE markers SET ${fields.join(', ')} WHERE id = ?`, values as string[])

  const updated = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(db, updated))
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// POST /api/markers/:id/images — järjestäjä+ (multipart, field "image")
markersRoutes.post('/:id/images', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const body = await c.req.parseBody()
  const file = body.image
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400)
  if (file.size > MAX_IMAGE_BYTES) return c.json({ error: 'file_too_large' }, 413)
  if (!file.type.startsWith('image/')) return c.json({ error: 'invalid_type' }, 400)

  const imageId = randomUUID()
  const data = Buffer.from(await file.arrayBuffer())
  db.run(
    'INSERT INTO marker_images (id, marker_id, content_type, data, created_at) VALUES (?, ?, ?, ?, ?)',
    [imageId, id, file.type, data, new Date().toISOString()],
  )

  return c.json({ url: `/api/markers/${id}/images/${imageId}` }, 201)
})

// GET /api/markers/:id/images/:imageId — kaikki autentikoidut käyttäjät (readonly kuva)
markersRoutes.get('/:id/images/:imageId', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const imageId = c.req.param('imageId')

  const row = db
    .query<{ content_type: string; data: Uint8Array }, [string, string]>(
      'SELECT content_type, data FROM marker_images WHERE id = ? AND marker_id = ?',
    )
    .get(imageId, id)
  if (!row) return c.json({ error: 'not_found' }, 404)

  return new Response(row.data, { headers: { 'Content-Type': row.content_type } })
})
