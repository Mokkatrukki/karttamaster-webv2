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
  icon_id: string | null
  image_id: string | null
  template_id: string | null
  parts_json: string | null
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

// V149/T219: talkoolaisen omalle pätkälle osuva merkki kelpaa — muut järjestäjä+.
// Ownership-pattern kuten segments.ts PUT (V93): assigned_code = session.talkoolainen_code.
interface OwnerSegRow { route_ids: string | null; start_dist: number | null; end_dist: number | null }
function talkoolainenMayPlace(db: Database, session: SessionData, routeIds: string[], distFromStart: number): boolean {
  if (session.role !== 'talkoolainen' || !session.talkoolainen_code) return false
  const segs = db.query<OwnerSegRow, [string]>(
    'SELECT route_ids, start_dist, end_dist FROM segments WHERE UPPER(assigned_code) = ?',
  ).all(session.talkoolainen_code.toUpperCase())
  if (segs.length === 0) return false // pätkätön → 403
  return segs.some(seg => {
    // V139: reititön pätkä → ei distance-rangea, salli jos assignattu seg olemassa
    if (seg.route_ids == null || seg.start_dist == null || seg.end_dist == null) return true
    const segRoutes = JSON.parse(seg.route_ids) as string[]
    const routeOverlap = routeIds.some(r => segRoutes.includes(r))
    const inRange = distFromStart >= seg.start_dist && distFromStart <= seg.end_dist
    return routeOverlap && inRange
  })
}

// POST /api/markers — järjestäjä+ TAI talkoolainen omalle pätkälleen (V149, EI tyyppirajausta)
markersRoutes.post('/', requireAuth(), async (c) => {
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
    label?: string | null
    icon_id?: string | null
    image_id?: string | null
    template_id?: string | null
    parts_json?: string | null
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

  // V149: role-gate — organizer aina; talkoolainen vain oman pätkän sisään; muu → 403
  const isOrganizer = session.role === 'admin' || session.role === 'järjestäjä'
  if (!isOrganizer && !talkoolainenMayPlace(db, session, body.route_ids, body.distance_from_start)) {
    return c.json({ error: 'forbidden' }, 403)
  }

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, location_note, color, label, icon_id, image_id, template_id, parts_json, description, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      body.label ?? null,
      body.icon_id ?? null,
      body.image_id ?? null,
      body.template_id ?? null,
      body.parts_json ?? null,
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
    icon_id?: string | null
    image_id?: string | null
    template_id?: string | null
    parts_json?: string | null
  }>()

  const positionFields = ['lat', 'lon', 'type', 'distance_from_start', 'route_ids', 'description', 'icon_id', 'image_id', 'template_id', 'parts_json'] as const
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
  if (body.icon_id !== undefined) { fields.push('icon_id = ?'); values.push(body.icon_id) }
  if (body.image_id !== undefined) { fields.push('image_id = ?'); values.push(body.image_id) }
  if (body.template_id !== undefined) { fields.push('template_id = ?'); values.push(body.template_id) }
  if (body.parts_json !== undefined) { fields.push('parts_json = ?'); values.push(body.parts_json) }
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
