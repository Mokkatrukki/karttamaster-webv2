import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import { markersToGeoJSON, type GpkgMarkerRow } from '../gpkg/geojson'
import { geoJSONToGpkg, hasOgr2ogr } from '../gpkg/convert'

export const gpkgRoutes = new Hono<AuthEnv>()

const LAYER_NAME = 'kyltit'

interface MarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  description: string | null
}

// GET /api/gpkg/export — järjestäjä+
gpkgRoutes.get('/export', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  if (!hasOgr2ogr()) {
    return c.json({ error: 'gdal_not_available' }, 503)
  }
  const db: Database = c.get('db')
  const rows = db
    .query<MarkerRow, []>('SELECT id, type, lat, lon, bearing, description FROM markers ORDER BY id ASC')
    .all()
  const markerRows: GpkgMarkerRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    lat: r.lat,
    lon: r.lon,
    bearing: r.bearing,
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
