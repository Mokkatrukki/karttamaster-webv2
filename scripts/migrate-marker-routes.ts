/**
 * T286-migraatio: uudelleentägää merkkien route_ids sijainnin perusteella uusille reiteille.
 *
 * Taustaa: reitit vaihtuivat (35km/55km → smtb-30/55, sgf-62/125/175). Merkeissä on oikeat
 * lat/lon tallessa, mutta route_ids viittaa vanhoihin id:ihin → merkit jäivät orvoiksi
 * (eivät näy uusilla reiteillä). Tämä laskee kullekin merkille uudet route_ids samalla
 * logiikalla kuin sovellus (assignRoutesToMarker, 100 m raja) + päivittää distance_from_start
 * ensimmäistä osuvaa reittiä vasten.
 *
 * Käyttö:
 *   bun scripts/migrate-marker-routes.ts [dbPath] [--apply]
 *   (ilman --apply = dry-run, ei kirjoiteta mitään)
 */
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRoutePoints, nearestPointIndex } from '../src/logic/bearing'
import { assignRoutesToMarker, SHARED_THRESHOLD_M } from '../src/logic/multi-route'
import type { RoutePoint } from '../src/logic/types'

const ROUTE_FILES: Array<{ id: string; file: string }> = [
  { id: 'smtb-30', file: 'smtb-2026-30km.gpx' },
  { id: 'smtb-55', file: 'smtb-2026-55km.gpx' },
  { id: 'sgf-62', file: 'sgf-2026-62km.gpx' },
  { id: 'sgf-125', file: 'sgf-2026-125km.gpx' },
  { id: 'sgf-175', file: 'sgf-2026-175km.gpx' },
]

// Server-side GPX-parseri (ei DOMParseria) — trkpt lat/lon regexillä.
function parseGpxFile(path: string): Array<{ lat: number; lon: number }> {
  const xml = readFileSync(path, 'utf-8')
  const out: Array<{ lat: number; lon: number }> = []
  const re = /<trkpt[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"|<trkpt[^>]*\blon="([-\d.]+)"[^>]*\blat="([-\d.]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const lat = m[1] !== undefined ? +m[1] : +m[4]
    const lon = m[1] !== undefined ? +m[2] : +m[3]
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) out.push({ lat, lon })
  }
  return out
}

const dbPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dev.db'
const apply = process.argv.includes('--apply')
const publicDir = join(import.meta.dir, '..', 'public')

const routes = ROUTE_FILES.map(r => ({
  id: r.id,
  routePoints: buildRoutePoints(parseGpxFile(join(publicDir, r.file))) as RoutePoint[],
}))
for (const r of routes) {
  if (r.routePoints.length < 2) throw new Error(`GPX tyhjä/virheellinen: ${r.id}`)
}

const db = new Database(dbPath)
const markers = db.query('SELECT id, lat, lon, route_ids, distance_from_start FROM markers').all() as Array<{
  id: string; lat: number; lon: number; route_ids: string; distance_from_start: number
}>

let reassigned = 0
let orphaned = 0
let unchanged = 0
const now = new Date().toISOString()
const update = db.prepare('UPDATE markers SET route_ids = ?, distance_from_start = ?, updated_at = ?, updated_by = ? WHERE id = ?')

console.log(`DB: ${dbPath}  merkkejä: ${markers.length}  ${apply ? '*** APPLY ***' : '(dry-run)'}\n`)

for (const m of markers) {
  const oldIds: string[] = JSON.parse(m.route_ids)
  const newIds = assignRoutesToMarker(m.lat, m.lon, routes, SHARED_THRESHOLD_M)

  if (newIds.length === 0) {
    orphaned++
    console.log(`ORPHAN  ${m.id}  ${JSON.stringify(oldIds)} → (ei mitään uutta reittiä <${SHARED_THRESHOLD_M}m) — jää piiloon`)
    continue
  }

  // distance_from_start ensimmäistä osuvaa reittiä vasten (ROUTE_DEFS-järjestys)
  const primary = routes.find(r => newIds.includes(r.id))!
  const idx = nearestPointIndex(primary.routePoints, m.lat, m.lon)
  const newDist = primary.routePoints[idx].distanceFromStart

  const sameIds = JSON.stringify(oldIds) === JSON.stringify(newIds)
  if (sameIds && Math.abs(newDist - m.distance_from_start) < 1) {
    unchanged++
    continue
  }
  reassigned++
  console.log(`REASSIGN ${m.id}  ${JSON.stringify(oldIds)} → ${JSON.stringify(newIds)}  dist ${m.distance_from_start.toFixed(0)}→${newDist.toFixed(0)}m`)
  if (apply) update.run(JSON.stringify(newIds), newDist, now, 'migration-t286', m.id)
}

console.log(`\nYhteenveto: reassign=${reassigned}  orphan=${orphaned}  unchanged=${unchanged}`)
if (!apply) console.log('Dry-run — mitään ei kirjoitettu. Aja --apply toteuttaaksesi.')
db.close()
