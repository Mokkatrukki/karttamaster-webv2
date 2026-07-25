import type { RoutePoint, SignMarker } from './types'
import { nearestPointCandidates, nearestPointIndex, haversineDistance } from './bearing'
import { SHARED_THRESHOLD_M, assignRoutesToMarker } from './multi-route'
import { ensureRouteIds } from './marker-assign'

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

// ─── T309/V220/V221 — merkin siirto (sijoitus & rollback) ────────────────────────────────
//
// B121: dragend valitsi km-akselin = LÄHIN reitti yli KAIKKIEN reittien ja kirjoitti sen
// `distanceFromStart`iin. Jaetulla osuudella (3 SMTB-reittiä ≤100 m) metrien snap-ero ratkaisi
// akselin ∴ merkin km hyppäsi toisen reitin lukemaan → merkki putosi oman pätkän
// [startDist,endDist]-rangesta liikkumatta käytännössä minnekään (sama B114/B117/B120-suku).
// Sääntö nyt: akseli on PÄTKÄN primary-reitti kun se tunnetaan (sama akseli kuin serverin
// `markerInOwnSegment`/`distsOnSegmentAxis`, V213/B100-oppi), muuten merkin ENTINEN akseli
// niin kauan kuin se on yhä reitin varrella — vasta viimeisenä lähin reitti.

/** Merkin sijaintikentät jotka siirto muuttaa (V220-snapshot). */
export interface MarkerPositionSnapshot {
  lat: number
  lon: number
  distanceFromStart: number
  distanceByRoute?: Record<string, number[]>
  routeIds: string[]
}

export type PositionedMarker = Pick<
  SignMarker,
  'lat' | 'lon' | 'distanceFromStart' | 'distanceByRoute' | 'routeIds'
>

/** Snapshot ENNEN mutaatiota — rollbackin (V220) ainoa totuus siitä mihin palataan. */
export function snapshotMarkerPosition(m: PositionedMarker): MarkerPositionSnapshot {
  return {
    lat: m.lat,
    lon: m.lon,
    distanceFromStart: m.distanceFromStart,
    // kopio: alkuperäinen objekti ei jää jaettuun viittaukseen jota uusi arvo voisi mutatoida
    ...(m.distanceByRoute ? { distanceByRoute: { ...m.distanceByRoute } } : {}),
    routeIds: [...m.routeIds],
  }
}

/** Kirjoita sijaintikentät merkkiin (sekä optimistinen siirto että rollback käyttävät tätä). */
export function applyMarkerPosition(m: PositionedMarker, pos: MarkerPositionSnapshot): void {
  m.lat = pos.lat
  m.lon = pos.lon
  m.distanceFromStart = pos.distanceFromStart
  m.distanceByRoute = pos.distanceByRoute ? { ...pos.distanceByRoute } : undefined
  m.routeIds = [...pos.routeIds]
}

/**
 * Millä reitillä merkin nykyinen `distanceFromStart` on mitattu. Ei omaa kenttää (types.ts:n
 * `distanceByRoute` on Record) ∴ päätellään: se reitti jonka km-ehdokkaista löytyy nykyinen
 * `distanceFromStart`. Jaetulla osuudella lukemat eroavat kilometreillä (5.0 vs 45.0) ∴
 * osuma on käytännössä yksikäsitteinen. `routeIds`-järjestys ratkaisee tasapelin (determinismi).
 */
export function inferKmAxisRouteId(m: PositionedMarker, tolM = 1): string | undefined {
  const byRoute = m.distanceByRoute
  if (!byRoute) return undefined
  const ids = [...m.routeIds, ...Object.keys(byRoute).filter((id) => !m.routeIds.includes(id))]
  for (const id of ids) {
    const cands = byRoute[id]
    if (cands?.some((d) => Math.abs(d - m.distanceFromStart) <= tolM)) return id
  }
  return undefined
}

export interface MoveAssignment extends MarkerPositionSnapshot {
  distanceByRoute: Record<string, number[]>
  /** Reitti jota `distanceFromStart` mittaa. undefined = orpo (ei reittiä ≤threshold). */
  kmAxisRouteId?: string
  /** Etäisyys lähimpään reittiin metreinä — kutsuja päättää FAR_FROM_ROUTE_M-varoituksesta. */
  distFromNearestRouteM: number
}

/**
 * V221: uudet sijaintikentät siirretylle merkille. Km-akselin valinta järjestyksessä:
 *   1. `preferRouteId` (pätkän `primaryRouteId`) jos merkki on yhä sen reitin varrella
 *   2. `fallbackAxisRouteId` (merkin ENTINEN akseli, `inferKmAxisRouteId`) jos yhä varrella
 *   3. lähin reitti
 * ⊥ arvo "lähin yli kaikkien reittien" ehdoitta: se vaihtaa akselia jaetulla osuudella
 * metrien snap-erosta ja pudottaa merkin pätkästä (B121).
 */
export function resolveMoveAssignment(
  lat: number,
  lon: number,
  routes: RouteGeometry[],
  opts: { preferRouteId?: string; fallbackAxisRouteId?: string; threshold?: number } = {},
): MoveAssignment {
  const threshold = opts.threshold ?? SHARED_THRESHOLD_M
  const distanceByRoute = computeDistanceByRoute(lat, lon, routes, threshold)

  let nearestId: string | undefined
  let nearestDistFromStart = 0
  let nearestM = Infinity
  for (const r of routes) {
    if (r.routePoints.length === 0) continue
    const idx = nearestPointIndex(r.routePoints, lat, lon)
    const d = haversineDistance(r.routePoints[idx], { lat, lon })
    if (d < nearestM) {
      nearestM = d
      nearestId = r.id
      nearestDistFromStart = r.routePoints[idx].distanceFromStart
    }
  }

  const onRoute = (id: string | undefined): boolean =>
    id !== undefined && (distanceByRoute[id]?.length ?? 0) > 0
  const kmAxisRouteId = [opts.preferRouteId, opts.fallbackAxisRouteId, nearestId].find(onRoute)

  return {
    lat,
    lon,
    distanceFromStart: kmAxisRouteId
      ? distanceByRoute[kmAxisRouteId][0]
      : nearestDistFromStart,
    distanceByRoute,
    // Jäsenyys (V25) = kaikki reitit ≤threshold; orvolle merkille fallback lähin reitti
    // (ensureRouteIds, V21/B1: tyhjä routeIds = merkki katoaa hiljaa kartalta).
    routeIds: nearestId
      ? ensureRouteIds(assignRoutesToMarker(lat, lon, routes, threshold), nearestId)
      : [],
    ...(kmAxisRouteId ? { kmAxisRouteId } : {}),
    distFromNearestRouteM: nearestM,
  }
}

/**
 * V220: hylkäsikö serveri kirjoituksen PYSYVÄSTI (⊥ vain "ei mennyt vielä läpi")?
 * Vain tämä oikeuttaa optimistisen tilan rollbackin. Peilaa `write-outbox.ts:isPermanent`ia:
 * verkkovirhe (`null` = offline), 5xx, 401 (uudelleenauth) ja 408/425/429 jäävät JONOON →
 * ne ovat laillinen pending-tila, ⊥ hylkäys ∴ rollback niissä hävittäisi käyttäjän työn.
 */
export function isServerRejection(status: number | null): boolean {
  if (status === null) return false
  if (status === 401 || status === 408 || status === 425 || status === 429) return false
  return status >= 400 && status < 500
}
