/**
 * Merkkisiirtojen koneellinen palautus audit-lokista (T226/V152 ennen-tilat).
 *
 * Taustaa: jos merkkejä siirretään vahingossa tai väärin (esim. 2026-07-25 talkoo-sessio
 * hyppäytti 14 merkkiä 1–7 km sivuun), `marker_audit.payload_json` sisältää jokaisen
 * `move`-rivin ENNEN-tilan (lat/lon/distance_from_start/route_ids). Tämä skripti valitsee
 * kullekin merkille SUODATTIMEEN OSUVAN ENSIMMÄISEN siirron ennen-tilan ja palauttaa merkin
 * siihen — eli peruu koko sotkuketjun kerralla, ei rivi kerrallaan.
 *
 * Koskee VAIN markers-taulun sijaintikenttiä. Pätkät, inventaario, alueet, käyttäjät,
 * merkkien tyyppi/kuvaus/status jäävät koskematta.
 *
 * Palautus kirjataan itsekin `marker_audit`iin (actor='admin (undo-palautus)') → jälki säilyy
 * ja skripti on idempotentti (uudelleenajo = 0 palautettavaa).
 *
 * Käyttö:
 *   bun scripts/restore-marker-moves.ts --role talkoolainen --since 2026-07-25 [--apply]
 *   (ilman --apply = dry-run, ei kirjoiteta mitään)
 *
 * Valitsimet:
 *   --db <polku>       DB-tiedosto (oletus: $DB_PATH tai /data/karttamaster.db)
 *   --role <rooli>     suodata tekijän rooli (talkoolainen | järjestäjä | admin)
 *   --actor <nimi>     suodata tekijän nimi (display_name)
 *   --since <ISO>      vain siirrot tästä hetkestä eteenpäin (esim. 2026-07-25)
 *   --until <ISO>      vain siirrot tähän hetkeen asti
 *   --marker <id>      rajaa yhteen merkkiin (toistettavissa)
 *   --threshold <m>    ohita jos merkki on jo näin lähellä ennen-tilaa (oletus 1 m)
 *   --keep-manual      ohita merkit joita joku muu rooli on siirtänyt suodatuksen jälkeen
 *                      (= ihmisen käsinkorjaus voittaa; oletuksena EI ohiteta, koska
 *                       audit-koordinaatti on eksakti ja käsinraahaus ±metrejä)
 *   --apply            kirjoita muutokset (ilman tätä pelkkä dry-run)
 *
 * Tuotantoajo: katso docs/RUNBOOK-merkkien-palautus.md (backup ENSIN).
 */
import { Database } from 'bun:sqlite'

interface MoveBefore {
  lat: number
  lon: number
  distance_from_start: number
  route_ids: string[]
}

interface MarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  distance_from_start: number
  route_ids: string
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function flagAll(name: string): string[] {
  const out: string[] = []
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]) })
  return out
}
const has = (name: string): boolean => process.argv.includes(`--${name}`)

const APPLY = has('apply')
const KEEP_MANUAL = has('keep-manual')
const DB_PATH = flag('db') ?? process.env.DB_PATH ?? '/data/karttamaster.db'
const THRESHOLD_M = Number(flag('threshold') ?? 1)
const ROLE = flag('role')
const ACTOR = flag('actor')
const SINCE = flag('since')
const UNTIL = flag('until')
const MARKER_IDS = flagAll('marker')

// Haversine metreinä — sama kaava kuin src/logic/bearing.ts, mutta skripti pysyy
// riippumattomana app-koodista (ajetaan tuotantokoneella jossa ei ole src/:ää).
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const db = new Database(DB_PATH)
const query = (sql: string, ...params: unknown[]): any[] => db.query(sql).all(...(params as never[]))

// Suodatin rakennetaan kerran ja käytetään sekä kohdehakuun että ennen-tilan valintaan,
// jotta molemmat puhuvat samasta siirtojoukosta.
const where: string[] = ["action = 'move'"]
const params: unknown[] = []
if (ROLE) { where.push('actor_role = ?'); params.push(ROLE) }
if (ACTOR) { where.push('actor = ?'); params.push(ACTOR) }
if (SINCE) { where.push('created_at >= ?'); params.push(SINCE) }
if (UNTIL) { where.push('created_at <= ?'); params.push(UNTIL) }
if (MARKER_IDS.length > 0) { where.push(`marker_id IN (${MARKER_IDS.map(() => '?').join(',')})`); params.push(...MARKER_IDS) }
const FILTER = where.join(' AND ')

console.log(`DB: ${DB_PATH}`)
console.log(`Suodatin: ${FILTER}  [${params.join(', ')}]`)
console.log(`Kynnys: ${THRESHOLD_M} m${KEEP_MANUAL ? '  (käsinkorjaukset säilytetään)' : ''}\n`)

const targets = query(`SELECT DISTINCT marker_id FROM marker_audit WHERE ${FILTER}`, ...params)

interface Plan { id: string; type: string; before: MoveBefore; cur: MarkerRow; dist: number }
const plan: Plan[] = []
let skipped = 0

for (const t of targets) {
  const first = query(
    `SELECT payload_json FROM marker_audit WHERE marker_id = ? AND ${FILTER} ORDER BY created_at ASC LIMIT 1`,
    t.marker_id, ...params,
  )[0]
  if (!first?.payload_json) { console.log(`SKIP ${t.marker_id.slice(0, 8)} — ei ennen-tilaa payloadissa`); skipped++; continue }
  const before = JSON.parse(first.payload_json) as MoveBefore
  if (typeof before.lat !== 'number' || typeof before.lon !== 'number') {
    console.log(`SKIP ${t.marker_id.slice(0, 8)} — vajaa payload`); skipped++; continue
  }

  const cur = query('SELECT id,type,lat,lon,distance_from_start,route_ids FROM markers WHERE id = ?', t.marker_id)[0] as MarkerRow | undefined
  if (!cur) { console.log(`SKIP ${t.marker_id.slice(0, 8)} — merkki poistettu`); skipped++; continue }

  if (KEEP_MANUAL) {
    const lastMatch = query(`SELECT MAX(created_at) t FROM marker_audit WHERE marker_id = ? AND ${FILTER}`, t.marker_id, ...params)[0].t
    const later = query(
      "SELECT COUNT(*) n FROM marker_audit WHERE marker_id = ? AND action = 'move' AND created_at > ? AND actor_role <> ?",
      t.marker_id, lastMatch, ROLE ?? '',
    )[0].n
    if (later > 0) { console.log(`SKIP ${t.marker_id.slice(0, 8)} ${cur.type} — korjattu käsin jälkeenpäin (${later} siirtoa)`); skipped++; continue }
  }

  const dist = Math.round(haversine(before.lat, before.lon, cur.lat, cur.lon))
  if (dist <= THRESHOLD_M) { console.log(`OK   ${t.marker_id.slice(0, 8)} ${cur.type} — jo paikallaan (${dist} m)`); continue }
  plan.push({ id: t.marker_id, type: cur.type, before, cur, dist })
}

plan.sort((a, b) => b.dist - a.dist)

console.log(`\n=== PALAUTETTAVAT: ${plan.length} ===`)
for (const p of plan) {
  console.log(`${p.id.slice(0, 8)} ${p.type}: ${p.cur.lat.toFixed(5)},${p.cur.lon.toFixed(5)} -> ${p.before.lat.toFixed(5)},${p.before.lon.toFixed(5)}  (${p.dist} m)`)
}
if (skipped > 0) console.log(`(ohitettu ${skipped})`)

if (!APPLY) {
  console.log('\nDRY RUN — ei kirjoitettu mitään. Lisää --apply.')
  process.exit(0)
}
if (plan.length === 0) {
  console.log('\nEi palautettavaa.')
  process.exit(0)
}

const now = new Date().toISOString()
// Atominen (V100/V153-linja): kaikki tai ei mitään.
db.transaction(() => {
  for (const p of plan) {
    // Jälki palautuksesta itsestään (V152): ennen-tila = nykyinen (väärä) sijainti,
    // jotta palautuskin on peruttavissa samalla työkalulla.
    db.run(
      'INSERT INTO marker_audit (id, marker_id, action, actor, actor_role, segment_code, created_at, payload_json) VALUES (?,?,?,?,?,?,?,?)',
      [crypto.randomUUID(), p.id, 'move', 'admin (undo-palautus)', 'admin', null, now,
        JSON.stringify({ lat: p.cur.lat, lon: p.cur.lon, distance_from_start: p.cur.distance_from_start, route_ids: JSON.parse(p.cur.route_ids) })],
    )
    // distance_by_route -> NULL: audit-payload ei sisällä sitä; NULL = legacy-fallback joka
    // lukee distance_from_start (V213). Väärään sijaintiin laskettu arvo olisi pahempi.
    db.run(
      'UPDATE markers SET lat = ?, lon = ?, distance_from_start = ?, route_ids = ?, distance_by_route = NULL, updated_at = ?, updated_by = ? WHERE id = ?',
      [p.before.lat, p.before.lon, p.before.distance_from_start, JSON.stringify(p.before.route_ids), now, 'admin (undo-palautus)', p.id],
    )
  }
})()

console.log(`\nPALAUTETTU: ${plan.length} merkkiä.`)
