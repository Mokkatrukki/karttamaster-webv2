/**
 * E2E-fixtureiden koordinaattilähde — LUE OIKEA GPX, älä arpo lat/lon-ruudukkoa.
 *
 * Miksi (B167): T391/V283 toi pätkäjäsenyyteen 200 m kynnyksen (`MEMBERSHIP_THRESHOLD_M`).
 * Sitä ennen jäsenyys oli kynnyksetön ("lähin jälki voittaa") ∴ mikä tahansa keksitty
 * koordinaatti kelpasi pätkän merkiksi & fixturet käyttivät ruudukkoa tyyliin
 * `lat: 65.6 + i * 0.001`. Kynnyksen jälkeen ne ovat ~1.2 km jäljestä → pätkä ei omista niitä
 * → hero, merkkilista & raahaus eivät renderöi mitään. Tuote toimii oikein; fixture ei.
 *
 * Sääntö: pätkämerkin koordinaatti ! tulla samasta geometriasta jonka appi lataa. Tiedosto
 * luetaan ajossa ∴ reittipäivitys (uusi GPX) siirtää fixturet mukanaan eikä jätä kovakoodattuja
 * lukuja mätänemään. Sama opetus kuin E2E-NOTES §4: älä koodaa kartan geometriaa testiin.
 */
import { readFileSync } from 'node:fs'

export type LatLon = [number, number]

const R = 6371000
const rad = (d: number): number => (d * Math.PI) / 180

function haversineM(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

const cache = new Map<string, LatLon[]>()

/** Reitin pisteet GPX:stä siinä järjestyksessä kuin appi ne piirtää. */
export function routePoints(file = 'public/smtb-2026-30km.gpx'): LatLon[] {
  const hit = cache.get(file)
  if (hit) return hit
  const xml = readFileSync(file, 'utf8')
  const pts: LatLon[] = []
  for (const m of xml.matchAll(/lat="([-\d.]+)"\s+lon="([-\d.]+)"/g)) pts.push([+m[1], +m[2]])
  if (pts.length === 0) throw new Error(`route-points: ${file} ei sisältänyt yhtään pistettä`)
  cache.set(file, pts)
  return pts
}

/**
 * `n` tasavälistä pistettä reitiltä (indeksiväli, ei metriväli — riittää fixturelle joka
 * haluaa vain "merkkejä pitkin reittiä"). Aina reitin jäljellä ∴ 200 m kynnys ei pudota niitä.
 */
export function pointsAlongRoute(n: number, file?: string): LatLon[] {
  const pts = routePoints(file)
  if (n <= 1) return [pts[0]]
  const step = (pts.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => pts[Math.round(i * step)])
}

/**
 * Piste `meters` päässä reitin alusta. Yli reitin pituuden menevä arvo clampaa loppupisteeseen —
 * fixturet käyttävät pyöreitä `distance_from_start`-lukuja jotka voivat ylittää testireitin
 * pituuden, & clamp pitää merkin jäljellä sen sijaan että heittäisi.
 */
export function pointAtDistance(meters: number, file?: string): LatLon {
  const pts = routePoints(file)
  let cum = 0
  for (let i = 1; i < pts.length; i++) {
    cum += haversineM(pts[i - 1], pts[i])
    if (cum >= meters) return pts[i]
  }
  return pts[pts.length - 1]
}
