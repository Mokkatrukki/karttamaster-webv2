import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

interface AreaRow {
  id: string
  name: string
  center_lat: number
  center_lng: number
  width_m: number
  height_m: number
  rotation: number
  markdown_description: string
  status: string
  hash_code: string
}

interface AreaFeatureRow {
  id: string
  area_id: string
  name: string | null
  center_lat: number
  center_lng: number
  width_m: number
  height_m: number
  rotation: number
  color: string
}

function rowToArea(row: AreaRow, features: AreaFeatureRow[]) {
  return {
    id: row.id,
    name: row.name,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    widthM: row.width_m,
    heightM: row.height_m,
    rotation: row.rotation,
    markdownDescription: row.markdown_description,
    status: row.status as 'suunniteltu' | 'valmis',
    hashCode: row.hash_code,
    features: features.map(f => ({
      id: f.id,
      areaId: f.area_id,
      name: f.name ?? undefined,
      centerLat: f.center_lat,
      centerLng: f.center_lng,
      widthM: f.width_m,
      heightM: f.height_m,
      rotation: f.rotation,
      color: f.color,
    })),
  }
}

function getFeatures(db: Database, areaId: string): AreaFeatureRow[] {
  return db.query<AreaFeatureRow, [string]>(
    'SELECT * FROM area_features WHERE area_id = ? ORDER BY rowid ASC'
  ).all(areaId)
}

export const areasRoutes = new Hono<AuthEnv>()

// GET /api/areas — kaikki alueet (autentikoitu)
areasRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<AreaRow, []>('SELECT * FROM areas ORDER BY rowid ASC').all()
  return c.json(rows.map(row => rowToArea(row, getFeatures(db, row.id))))
})

// GET /api/areas/by-hash/:hash — haku hash-koodilla (autentikoitu)
areasRoutes.get('/by-hash/:hash', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const hash = c.req.param('hash')
  const row = db.query<AreaRow, [string]>('SELECT * FROM areas WHERE hash_code = ?').get(hash)
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(rowToArea(row, getFeatures(db, row.id)))
})

// POST /api/areas — luo uusi (järjestäjä+)
areasRoutes.post('/', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    id?: string
    name: string
    centerLat: number
    centerLng: number
    widthM: number
    heightM: number
    rotation?: number
    markdownDescription?: string
    status?: string
    hashCode?: string
    features?: Array<{
      id?: string
      name?: string
      centerLat: number
      centerLng: number
      widthM: number
      heightM: number
      rotation?: number
      color: string
    }>
  }>()

  const id = body.id ?? randomUUID()
  const hashCode = body.hashCode ?? randomUUID().replace(/-/g, '')

  db.query<void, [string, string, number, number, number, number, number, string, string, string]>(
    `INSERT INTO areas (id, name, center_lat, center_lng, width_m, height_m, rotation, markdown_description, status, hash_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name,
    body.centerLat,
    body.centerLng,
    body.widthM,
    body.heightM,
    body.rotation ?? 0,
    body.markdownDescription ?? '',
    body.status ?? 'suunniteltu',
    hashCode,
  )

  if (body.features?.length) {
    upsertFeatures(db, id, body.features)
  }

  const row = db.query<AreaRow, [string]>('SELECT * FROM areas WHERE id = ?').get(id)!
  return c.json(rowToArea(row, getFeatures(db, id)), 201)
})

// PUT /api/areas/:id — päivitä (järjestäjä+), sisältää features[]
areasRoutes.put('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const existing = db.query<AreaRow, [string]>('SELECT * FROM areas WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<{
    name?: string
    centerLat?: number
    centerLng?: number
    widthM?: number
    heightM?: number
    rotation?: number
    markdownDescription?: string
    status?: string
    features?: Array<{
      id?: string
      name?: string
      centerLat: number
      centerLng: number
      widthM: number
      heightM: number
      rotation?: number
      color: string
    }>
  }>()

  db.query<void, [string, number, number, number, number, number, string, string, string]>(
    `UPDATE areas SET name=?, center_lat=?, center_lng=?, width_m=?, height_m=?, rotation=?,
     markdown_description=?, status=? WHERE id=?`
  ).run(
    body.name ?? existing.name,
    body.centerLat ?? existing.center_lat,
    body.centerLng ?? existing.center_lng,
    body.widthM ?? existing.width_m,
    body.heightM ?? existing.height_m,
    body.rotation ?? existing.rotation,
    body.markdownDescription ?? existing.markdown_description,
    body.status ?? existing.status,
    id,
  )

  if (body.features !== undefined) {
    db.query<void, [string]>('DELETE FROM area_features WHERE area_id = ?').run(id)
    if (body.features.length) {
      upsertFeatures(db, id, body.features)
    }
  }

  const row = db.query<AreaRow, [string]>('SELECT * FROM areas WHERE id = ?').get(id)!
  return c.json(rowToArea(row, getFeatures(db, id)))
})

// DELETE /api/areas/:id — poista + cascade features (järjestäjä+)
areasRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const existing = db.query<AreaRow, [string]>('SELECT * FROM areas WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  // ON DELETE CASCADE hoitaa area_features
  db.query<void, [string]>('DELETE FROM areas WHERE id = ?').run(id)
  return c.json({ deleted: id })
})

function upsertFeatures(
  db: Database,
  areaId: string,
  features: Array<{
    id?: string
    name?: string
    centerLat: number
    centerLng: number
    widthM: number
    heightM: number
    rotation?: number
    color: string
  }>,
): void {
  const stmt = db.prepare<void, [string, string, string | null, number, number, number, number, number, string]>(
    `INSERT INTO area_features (id, area_id, name, center_lat, center_lng, width_m, height_m, rotation, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const f of features) {
    stmt.run(
      f.id ?? randomUUID(),
      areaId,
      f.name ?? null,
      f.centerLat,
      f.centerLng,
      f.widthM,
      f.heightM,
      f.rotation ?? 0,
      f.color,
    )
  }
}
