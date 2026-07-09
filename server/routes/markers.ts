import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { SessionData } from '../types'
import { ownSegments, markerInOwnSegment, logMarkerAudit, type AuditAction } from '../marker-audit'

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
  created_by: string | null
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
  if (!isOrganizer) {
    const segs = ownSegments(db, session)
    const mayPlace = markerInOwnSegment(segs, {
      routeIds: body.route_ids,
      distFromStart: body.distance_from_start,
      templateId: body.template_id,
    })
    if (!mayPlace) return c.json({ error: 'forbidden' }, 403)
  }

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()
  // T226/V151: created_by = talkoolainen_code ensisijainen (kova-poisto-oikeus, nimikaimo-turvallinen),
  // muuten display_name (järjestäjä). T226/V152: INSERT + audit samassa transaktiossa (atominen).
  const createdBy = session.talkoolainen_code ?? session.display_name
  db.transaction(() => {
    db.run(
      'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, location_note, color, label, icon_id, image_id, template_id, parts_json, description, updated_at, updated_by, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        createdBy,
      ],
    )
    // add: ei ENNEN-tilaa (undo = DELETE, V153).
    logMarkerAudit(db, { markerId: id, action: 'add', session })
  })()

  const row = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(db, row), 201)
})

// PUT /api/markers/:id — status: kaikki autentikoidut; lat/lon/bearing/type: järjestäjä+
markersRoutes.put('/:id', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const id = c.req.param('id')

  // T222/V150: auktorisointi OLEMASSA olevasta rivistä. T226/V152: ennen-tila (status/lat/lon/
  // dist/route_ids) audit-payloadia varten; template_id ownership-unionia varten (V143 typeFilter).
  const existing = db.query<{
    id: string
    route_ids: string | null
    distance_from_start: number
    status: string
    lat: number
    lon: number
    template_id: string | null
  }, [string]>(
    'SELECT id, route_ids, distance_from_start, status, lat, lon, template_id FROM markers WHERE id = ?',
  ).get(id)
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

  const isOrganizer = ['admin', 'järjestäjä'].includes(session.role)

  // T222/V150: identiteettikentät (tyyppi, kuvaus, ikoni, kuva, malli) = vain järjestäjä+.
  const identityFields = ['type', 'description', 'icon_id', 'image_id', 'template_id', 'parts_json'] as const
  // Sijaintikentät (siirto) — talkoolainen sallittu VAIN omalle pätkälleen + range-tarkistus.
  const moveFields = ['lat', 'lon', 'distance_from_start', 'route_ids'] as const

  const existingRoutes = existing.route_ids ? (JSON.parse(existing.route_ids) as string[]) : []
  if (!isOrganizer) {
    const segs = ownSegments(db, session)
    // (a) identiteettimuutos aina kielletty talkoolaiselta
    if (identityFields.some((f) => f in body)) return c.json({ error: 'forbidden' }, 403)
    // (b) V150a: olemassa olevan merkin PITÄÄ kuulua talkoolaisen pätkään (kanoninen unioni:
    //     route+dist ∪ linked ∪ typeFilter) — koskee MYÖS status/location_note-kenttiä.
    if (!markerInOwnSegment(segs, { id, routeIds: existingRoutes, distFromStart: existing.distance_from_start, templateId: existing.template_id })) {
      return c.json({ error: 'forbidden' }, 403)
    }
    // (c) V150b: siirto ei saa raahata merkkiä ulos omasta pätkästä — uusi sijainti range-tarkistus.
    if (moveFields.some((f) => f in body)) {
      const newDist = body.distance_from_start ?? existing.distance_from_start
      const newRoutes = body.route_ids ?? existingRoutes
      if (!markerInOwnSegment(segs, { id, routeIds: newRoutes, distFromStart: newDist, templateId: existing.template_id })) {
        return c.json({ error: 'forbidden' }, 403)
      }
    }
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

  // T226/V152: audit-action + ENNEN-tila. Siirto ensisijainen (move-payload restoraa V153),
  // muuten tilamuutos. Identiteetti/location_note-vain-PUT (järjestäjän muokkaus) ei ole osa
  // add/move/status/remove-undomallia → ei audit-riviä (4-action-enum määrittää auditoitavan mutaation).
  const isMove = moveFields.some((f) => f in body)
  const isStatus = body.status !== undefined && body.status !== existing.status
  let audit: { action: AuditAction; payload: unknown } | null = null
  if (isMove) {
    audit = { action: 'move', payload: { lat: existing.lat, lon: existing.lon, distance_from_start: existing.distance_from_start, route_ids: existingRoutes } }
  } else if (isStatus) {
    audit = { action: 'status', payload: { status: existing.status } }
  }

  db.transaction(() => {
    db.run(`UPDATE markers SET ${fields.join(', ')} WHERE id = ?`, values as string[])
    if (audit) logMarkerAudit(db, { markerId: id, action: audit.action, session, payload: audit.payload })
  })()

  const updated = db.query<MarkerRow, [string]>('SELECT * FROM markers WHERE id = ?').get(id)!
  return c.json(toJson(db, updated))
})

// DELETE /api/markers/:id — järjestäjä+ TAI talkoolainen VAIN oman itse-luoman merkin (V151).
// Suunniteltu (created_by≠oma tai NULL) → 403; UI ohjaa soft ei_tarpeen -polulle (T225).
markersRoutes.delete('/:id', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const id = c.req.param('id')

  const existing = db.query<{
    id: string
    type: string
    lat: number
    lon: number
    distance_from_start: number
    route_ids: string | null
    status: string
    template_id: string | null
    created_by: string | null
  }, [string]>(
    'SELECT id, type, lat, lon, distance_from_start, route_ids, status, template_id, created_by FROM markers WHERE id = ?',
  ).get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const isOrganizer = ['admin', 'järjestäjä'].includes(session.role)
  if (!isOrganizer) {
    // T225/V151: (a) merkki omalla pätkällä JA (b) oma itse-luoma (created_by = talkoolainen_code).
    const existingRoutes = existing.route_ids ? (JSON.parse(existing.route_ids) as string[]) : []
    const segs = ownSegments(db, session)
    const owns = markerInOwnSegment(segs, { id, routeIds: existingRoutes, distFromStart: existing.distance_from_start, templateId: existing.template_id })
    const selfCreated = existing.created_by != null && existing.created_by === session.talkoolainen_code
    if (!owns || !selfCreated) return c.json({ error: 'forbidden' }, 403)
  }

  // T226/V152: remove-audit ennen-tilalla (audit-näkyvyys; V153 ei restoraa removea) + DELETE atomisesti.
  db.transaction(() => {
    logMarkerAudit(db, {
      markerId: id,
      action: 'remove',
      session,
      payload: {
        type: existing.type,
        lat: existing.lat,
        lon: existing.lon,
        distance_from_start: existing.distance_from_start,
        route_ids: existing.route_ids ? (JSON.parse(existing.route_ids) as string[]) : [],
        status: existing.status,
      },
    })
    db.run('DELETE FROM markers WHERE id = ?', [id])
  })()
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
