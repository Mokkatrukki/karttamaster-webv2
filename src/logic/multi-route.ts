import type { RoutePoint } from './types'
import { haversineDistance, nearestPointIndex } from './bearing'
import { distanceToPathM } from './segment-track'

export interface RouteConfig {
  id: string
  label: string
  color: string
  /** T304/V216: 2. kanava — viivakuvio erottaa reitit myös akromaattisesti & paljastaa
   *  jaetulla osuudella alla kulkevan reitin. undefined = ehjä viiva. */
  dashArray?: string
  file: string
  /** T286: tapahtuman nimi ryhmittelyä varten reittivalitsimessa (esim. "SyöteMTB"). */
  event?: string
  routePoints: RoutePoint[]
}

export const SHARED_THRESHOLD_M = 100

export function assignRoutesToMarker(
  lat: number,
  lon: number,
  routes: Array<{ id: string; routePoints: RoutePoint[] }>,
  threshold = SHARED_THRESHOLD_M,
): string[] {
  return routes
    .filter((r) => {
      if (r.routePoints.length === 0) return false
      const idx = nearestPointIndex(r.routePoints, lat, lon)
      const dist = haversineDistance(r.routePoints[idx], { lat, lon })
      return dist <= threshold
    })
    .map((r) => r.id)
}

/**
 * T392/V284: merkin LÄHIN reitti kohtisuoralla mitalla. Tämä on jäsenyyden vertailukohta —
 * pätkä ⊥ omista merkkiä joka on selvästi lähempänä toista reittiä. ⊥ käytä
 * `nearestPointIndex`iä (kärkipiste): se on eri mittari kuin `distanceToTrackM` jolla jälki
 * mitataan, & ero (V261: jopa 41.9 m) ylittäisi koko toleranssin.
 *
 * Tulos tallennetaan merkille luontihetkellä ∴ jäsenyyslogiikan ⊥ tarvitse tuntea
 * reittigeometriaa (V284: 29 kutsupaikkaa, joista yksikin unohdettu palauttaisi vanhan käytöksen).
 */
export function nearestRouteByPath(
  lat: number,
  lon: number,
  routes: Array<{ id: string; routePoints: RoutePoint[] }>,
): { routeId: string; distM: number } | null {
  let best: { routeId: string; distM: number } | null = null
  for (const r of routes) {
    if (r.routePoints.length === 0) continue
    const distM = distanceToPathM(r.routePoints, lat, lon)
    if (!best || distM < best.distM) best = { routeId: r.id, distM }
  }
  return best
}
