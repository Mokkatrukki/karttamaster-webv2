import type { RoutePoint, SignMarker } from './types'
import { nearestPointCandidates } from './bearing'
import { SHARED_THRESHOLD_M } from './multi-route'

// T300/V212/B115: merkin km per reitti.
//
// Miksi: `SignMarker.distanceFromStart` on YKSI luku, mutta `routeIds` voi olla monta. Km
// mitattiin sijoitushetken lähimmästä reitistä; pätkäsuodatus (V140) vertaa sitä pätkän
// km-väliin joka on määritelty TOISTA reittiä vasten. Jaetulla osuudella (3 SMTB-reittiä
// ≤100 m) osumat olivat siis sattumaa. `lat/lon` on totuus, km on johdettu ∴ oikea km
// voidaan aina laskea uudelleen geometriasta — kantamigraatiota ei tarvita.

export interface RouteGeometry {
  id: string
  routePoints: RoutePoint[]
}

/**
 * Km jokaiselle reitille joka kulkee ≤threshold merkin ohi. Arvo on LISTA, ei luku (T302/V214):
 * lenkillä tai edestakaisella osuudella sama reitti ohittaa merkin useasti, jolloin km 12 ja
 * km 47 ovat molemmat tosia — yksi luku olisi arpa. Lähin ensin. Tyhjä objekti = orpo merkki
 * (ei minkään reitin varrella) — kutsuja päättää, tässä ei arvata mitään.
 */
export function computeDistanceByRoute(
  lat: number,
  lon: number,
  routes: RouteGeometry[],
  threshold = SHARED_THRESHOLD_M,
): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const route of routes) {
    if (route.routePoints.length === 0) continue
    const cands = nearestPointCandidates(route.routePoints, lat, lon, threshold)
    if (cands.length > 0) out[route.id] = cands.map(c => c.distanceFromStart)
  }
  return out
}

/**
 * KAIKKI km-ehdokkaat annetulla reitillä (T302/V214) — lenkillä useampi. Tätä pitää käyttää
 * jokaisessa km-VERTAILUSSA: riittää että YKSI ehdokas osuu pätkän väliin.
 * Fallback `distanceFromStart`iin = legacy-data jolle `distanceByRoute` ei ole täyttynyt
 * (V212 lazy backfill) → käytös on täsmälleen entinen, ei huonompi.
 */
export function distancesForRoute(
  marker: Pick<SignMarker, 'distanceByRoute' | 'distanceFromStart'>,
  routeId: string | undefined,
): number[] {
  if (routeId !== undefined) {
    const d = marker.distanceByRoute?.[routeId]
    if (d !== undefined && d.length > 0) return d
  }
  return [marker.distanceFromStart]
}

/** Yksi edustava km (lähin) — järjestykseen/näyttöön. Vertailuun käytä `distancesForRoute`. */
export function distanceForRoute(
  marker: Pick<SignMarker, 'distanceByRoute' | 'distanceFromStart'>,
  routeId: string | undefined,
): number {
  return distancesForRoute(marker, routeId)[0]
}

/**
 * T300/V212: lazy backfill — merkit joilta kenttä puuttuu saavat sen geometriasta kun GPX:t
 * ovat latautuneet. Palauttaa muutettujen merkkien määrän (0 = ei tehtävää).
 * Ei kirjoita kantaan: `lat/lon` on totuus, joten arvo on aina uudelleenlaskettavissa.
 */
export function backfillDistanceByRoute(
  markers: SignMarker[],
  routes: RouteGeometry[],
  threshold = SHARED_THRESHOLD_M,
): number {
  if (routes.length === 0) return 0
  let changed = 0
  for (const m of markers) {
    if (m.distanceByRoute !== undefined) continue
    const byRoute = computeDistanceByRoute(m.lat, m.lon, routes, threshold)
    if (Object.keys(byRoute).length === 0) continue
    m.distanceByRoute = byRoute
    changed++
  }
  return changed
}
