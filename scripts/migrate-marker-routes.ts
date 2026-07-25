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
import { buildRoutePoints, nearestPointIndex, haversineDistance } from '../src/logic/bearing'
import { assignRoutesToMarker, SHARED_THRESHOLD_M } from '../src/logic/multi-route'
import { computeDistanceByRoute } from '../src/logic/marker-distance'
import { FAR_FROM_ROUTE_M } from '../src/logic/marker-assign'
import { ROUTE_DEFS } from '../src/logic/route-defs'
import type { RoutePoint } from '../src/logic/types'

// T303/V215/B117: reittilista luetaan SAMASTA lähteestä kuin sovellus. Aiemmin tässä oli
// kovakoodattu 5 reitin kopio → `smtb-110-siirtyma` (lisätty myöhemmin) puuttui, ja skripti
// ajettiin tuotantoon sillä: siirtymän merkit tägättiin naapurireiteille ja niiden km
// laskettiin väärästä geometriasta. Kovakoodattu kopio ei voi pysyä ajan tasalla → poistettu.
const ROUTE_FILES: Array<{ id: string; file: string }> = ROUTE_DEFS.map(d => ({
  id: d.id,
  file: d.file.replace(/^\//, ''),
}))

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
// T303/V215/B117: --apply yksin ei riitä. Tämä skripti ajettiin kerran vaillinaisella
// reittilistalla suoraan tuotantoon; toinen lippu pakottaa katsomaan dry-runin ensin.
const apply = process.argv.includes('--apply') && process.argv.includes('--yes-i-checked-the-dry-run')
if (process.argv.includes('--apply') && !apply) {
  console.error('--apply vaatii myös --yes-i-checked-the-dry-run (aja dry-run ensin ja lue tuloste).')
  process.exit(1)
}
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

// Lähin reitti (min etäisyys mihin tahansa reittipisteeseen).
// T303/V215/B118: käytetään VAIN etäisyyskaton (FAR_FROM_ROUTE_M) sisällä. Aiemmin orpo
// merkki tägättiin lähimpään reittiin katosta riippumatta — kilometrien päässä oleva merkki
// sai sen reitin km:n ja putosi jonkun pätkän km-väliin ∴ ilmestyi talkoolaisen listalle
// vaikka ei ollut reitillä lainkaan. Väärä pätkäjäsenyys on huonompi kuin näkymättömyys:
// talkoolainen lähtee metsään hakemaan merkkiä jota ei ole siellä.
function nearestRoute(lat: number, lon: number): { id: string; dist: number } {
  let best = { id: routes[0].id, dist: Infinity }
  for (const r of routes) {
    const idx = nearestPointIndex(r.routePoints, lat, lon)
    const d = haversineDistance(r.routePoints[idx], { lat, lon })
    if (d < best.dist) best = { id: r.id, dist: d }
  }
  return best
}

let reassigned = 0
let nearestFallback = 0
let unchanged = 0
let manualReview = 0
const now = new Date().toISOString()
const update = db.prepare(
  'UPDATE markers SET route_ids = ?, distance_from_start = ?, distance_by_route = ?, updated_at = ?, updated_by = ? WHERE id = ?',
)

console.log(`DB: ${dbPath}  merkkejä: ${markers.length}  ${apply ? '*** APPLY ***' : '(dry-run)'}\n`)

for (const m of markers) {
  const oldIds: string[] = JSON.parse(m.route_ids)
  let newIds = assignRoutesToMarker(m.lat, m.lon, routes, SHARED_THRESHOLD_M)
  let fallback = false

  if (newIds.length === 0) {
    const near = nearestRoute(m.lat, m.lon)
    // T303/V215/B118: etäisyyskatto. Yli katon → EI tägätä lainkaan, vaan raportoidaan
    // käsin katsottavaksi. Väärä pätkäjäsenyys lähettää talkoolaisen metsään turhaan.
    if (near.dist > FAR_FROM_ROUTE_M) {
      manualReview++
      console.log(`KÄSIN    ${m.id}  ${JSON.stringify(oldIds)} — lähin reitti ${near.dist.toFixed(0)} m (> ${FAR_FROM_ROUTE_M} m) → EI muutettu`)
      continue
    }
    newIds = [near.id]
    fallback = true
    nearestFallback++
    console.log(`NEAREST ${m.id}  ${JSON.stringify(oldIds)} → ${JSON.stringify(newIds)} (lähin ${near.dist.toFixed(0)}m — siirrä käsin)`)
  }

  // T303/V215/B117: primary = LÄHIN reitti, sama sääntö kuin sovelluksella
  // (`markers.ts nearestRouteAssignment`). Aiemmin tässä oli `routes.find(...)` =
  // ROUTE_DEFS-listajärjestyksen ensimmäinen osuva → kaksi eri primary-määritelmää samassa
  // koodipohjassa, ja migraation jälkeen km ei vastannut mitään sovelluksen oletusta.
  const primary = routes
    .filter(r => newIds.includes(r.id))
    .reduce((best, r) => {
      const d = haversineDistance(r.routePoints[nearestPointIndex(r.routePoints, m.lat, m.lon)], { lat: m.lat, lon: m.lon })
      return best === null || d < best.d ? { r, d } : best
    }, null as { r: typeof routes[number]; d: number } | null)!.r
  const idx = nearestPointIndex(primary.routePoints, m.lat, m.lon)
  const newDist = primary.routePoints[idx].distanceFromStart
  // T303/T300/V212: kirjoita myös km per reitti — muuten migraatio tuottaisi dataa jossa
  // uusi kenttä puuttuu ja suodatus jäisi legacy-fallbackiin.
  const newDistByRoute = computeDistanceByRoute(m.lat, m.lon, routes)

  const sameIds = JSON.stringify(oldIds) === JSON.stringify(newIds)
  if (sameIds && Math.abs(newDist - m.distance_from_start) < 1) {
    unchanged++
    continue
  }
  if (!fallback) {
    reassigned++
    console.log(`REASSIGN ${m.id}  ${JSON.stringify(oldIds)} → ${JSON.stringify(newIds)}  dist ${m.distance_from_start.toFixed(0)}→${newDist.toFixed(0)}m`)
  }
  if (apply) update.run(JSON.stringify(newIds), newDist, JSON.stringify(newDistByRoute), now, 'migration-t303', m.id)
}

console.log(`\nYhteenveto: reassign=${reassigned}  nearest-fallback=${nearestFallback}  unchanged=${unchanged}  käsin-tarkistettavat=${manualReview}`)
if (manualReview > 0) {
  console.log(`HUOM: ${manualReview} merkkiä on yli ${FAR_FROM_ROUTE_M} m päässä kaikista reiteistä — ne jätettiin koskematta. Tarkista käsin.`)
}
if (!apply) console.log('Dry-run — mitään ei kirjoitettu. Aja --apply --yes-i-checked-the-dry-run toteuttaaksesi.')
db.close()
