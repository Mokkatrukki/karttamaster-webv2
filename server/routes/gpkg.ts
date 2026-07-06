import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { SessionData } from '../types'
import { markersToGeoJSON, geoJSONToMarkers, type GpkgMarkerRow } from '../gpkg/geojson'
import { geoJSONToGpkg, gpkgToGeoJSON, hasOgr2ogr } from '../gpkg/convert'

export const gpkgRoutes = new Hono<AuthEnv>()

const LAYER_NAME = 'kyltit'

interface MarkerRow {
  id: string
  type: string
  label: string | null
  lat: number
  lon: number
  description: string | null
}

// GET /api/gpkg/export — järjestäjä+
gpkgRoutes.get('/export', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  if (!hasOgr2ogr()) {
    return c.json({ error: 'gdal_not_available' }, 503)
  }
  const db: Database = c.get('db')
  const rows = db
    .query<MarkerRow, []>('SELECT id, type, label, lat, lon, description FROM markers ORDER BY id ASC')
    .all()
  const markerRows: GpkgMarkerRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    label: r.label,
    lat: r.lat,
    lon: r.lon,
    description: r.description,
  }))
  const fc = markersToGeoJSON(markerRows)
  const gpkgBytes = await geoJSONToGpkg(fc, LAYER_NAME)
  return new Response(gpkgBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/geopackage+sqlite3',
      'Content-Disposition': 'attachment; filename="kyltit.gpkg"',
    },
  })
})

// POST /api/gpkg/import — järjestäjä+
gpkgRoutes.post('/import', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  if (!hasOgr2ogr()) {
    return c.json({ error: 'gdal_not_available' }, 503)
  }
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'missing_file' }, 400)
  }

  const gpkgBytes = new Uint8Array(await file.arrayBuffer())
  const fc = await gpkgToGeoJSON(gpkgBytes)
  const markers: GpkgMarkerRow[] = geoJSONToMarkers(fc)

  const now = new Date().toISOString()
  let created = 0
  let updated = 0

  for (const marker of markers) {
    const existing = db.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get(marker.id)
    if (existing) {
      db.run(
        'UPDATE markers SET type = ?, label = ?, lat = ?, lon = ?, description = ?, updated_at = ?, updated_by = ? WHERE id = ?',
        [marker.type, marker.label, marker.lat, marker.lon, marker.description, now, session.display_name, marker.id],
      )
      updated++
    } else {
      db.run(
        'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, location_note, color, label, description, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          marker.id || randomUUID(),
          marker.type,
          marker.lat,
          marker.lon,
          0,
          '[]',
          'suunniteltu',
          null,
          null,
          marker.label,
          marker.description,
          now,
          session.display_name,
        ],
      )
      created++
    }
  }

  return c.json({ created, updated })
})
