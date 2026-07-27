import type { Segment } from './segments'
import { segmentPrimaryRouteId } from './segments'
import { distancesForRoute } from './marker-distance'
import { kmAlongTrackM } from './segment-track'
import type { SignMarker } from './types'

// T328/V237/V238: PÄTKÄ OMISTAA KM-AKSELIN.
//
// Miksi tämä tiedosto on olemassa: km-akseli kulki aiemmin erillisenä `routeId`-parametrina
// jokaisessa järjestys-/näyttökutsussa (V235/T327). Parametri on vapausaste jonka kutsuja voi
// unohtaa → hiljainen fallback `m.distanceFromStart`-skalaariin → väärä järjestys (B126) ja
// väärä lukema (B129) samasta juuresta. Konteksti joka näyttää pätkän merkkejä TUNTEE pätkän
// jo ∴ akseli otetaan pätkästä eikä sitä voi unohtaa.
//
// Merkin paikka pätkässä on SUHDE, ei merkin kenttä: sama merkki kuuluu useaan pätkään
// (jaettu osuus V25, `linkedMarkerIds` V140, `markerTypeFilter` V143) ∴ "järjestyslukua" ei
// ole olemassa globaalisti eikä sitä saa tallentaa merkkiin.

/** Sama ε kuin serverin `markerInOwnSegment` (`server/marker-audit.ts`) — kerrokset ⊥ eri mieltä. */
export const RANGE_EPS_M = 50

/** Pätkän km-akselille osuvat merkit + ne jotka eivät osu (V238: "ei reitillä"). */
export interface SegmentOrder {
  onRoute: SignMarker[]
  offRoute: SignMarker[]
}

// V238: suunta on phasen funktio, ei vakio. Purku ajetaan reittiä VASTAAN ∴ lopusta alkuun.
// Lookup-taulu (ei if-ketju, V91-kuvio) jotta uusi phase on helppo lisätä.
const PHASE_DIRECTION: Record<Segment['phase'], 1 | -1> = {
  asettaminen: 1,
  tarkastus: 1,
  purku: -1,
}

/**
 * V237: merkin km PÄTKÄN akselilla — se ehdokas joka osuu `[startDist−ε, endDist+ε]`:iin.
 * `null` = merkki ei ole pätkän km-välillä (reititön pätkä, tai merkki joka on mukana
 * `linkedMarkerIds`/`markerTypeFilter`-kautta ilman km-osumaa) → kutsuja näyttää sen
 * "ei reitillä" -ryhmässä, EI arvaa sille paikkaa järjestyksestä.
 *
 * Lenkki (V214/B116): sama reitti ohittaa merkin useasti ∴ ehdokkaita on monta. Pätkän väli
 * VALITSEE oikean — aiempi "pienin ehdokas" oli arvaus joka osui väärään kierrokseen.
 */
export function segmentKm(
  marker: Pick<SignMarker, 'distanceByRoute' | 'distanceFromStart' | 'lat' | 'lon'>,
  segment: Pick<Segment, 'primaryRouteId' | 'routeIds' | 'startDist' | 'endDist' | 'track'>,
): number | null {
  // T359/V259: jälki on akseli kun se on. Lukema = matka pätkän OMAA jälkeä pitkin ∴ se on
  // samasta lähteestä kuin jäsenyys (V259 lähin-voittaa) — ennen tätä järjestys luki reitin
  // km-akselia & jäsenyys jälkeä, mikä on B129:n suku (näyttö & järjestys eri akselilta).
  // Merkin lat/lon on totuus (V212) ∴ ehdokaslistoja ⊥ tarvita: jäljellä on vain yksi lähin kohta.
  if (segment.track && segment.track.length > 0) {
    return kmAlongTrackM(segment.track, marker.lat, marker.lon)
  }

  // V139: reititön pätkä (aluetehtävä) — ei km-akselia, ei järjestystä.
  if (segment.startDist === undefined || segment.endDist === undefined) return null

  const start = segment.startDist - RANGE_EPS_M
  const end = segment.endDist + RANGE_EPS_M
  const axis = segmentPrimaryRouteId(segment)

  let best: number | null = null
  for (const d of distancesForRoute(marker, axis)) {
    if (d < start || d > end) continue
    // Useampi ehdokas saman pätkän sisällä (tiukka lenkki): lähin pätkän alkua.
    if (best === null || d < best) best = d
  }
  return best
}

/**
 * V237/V238: pätkän merkit kulkusuunnassa. `onRoute` = km-akselille osuvat, järjestettynä
 * phasen suunnan mukaan (asettaminen/tarkastus alusta loppuun, purku lopusta alkuun).
 * `offRoute` = loput OMALLA skalaarillaan järjestettynä — ne eivät katoa eivätkä sekoitu
 * akselijärjestykseen (V238: kutsuja renderöi ne omana "ei reitillä" -ryhmänä listan alkuun).
 * Skalaari on niille ainoa km joka on olemassa; se on myös reitittömän tehtävän (V139
 * keräyskasa, T218) entinen järjestys ∴ käytös säilyy siellä missä pätkällä ei ole akselia.
 */
export function orderMarkersInSegment(
  markers: SignMarker[],
  segment: Pick<Segment, 'primaryRouteId' | 'routeIds' | 'startDist' | 'endDist' | 'phase' | 'track'> | null,
): SegmentOrder {
  const byScalar = (a: SignMarker, b: SignMarker): number => a.distanceFromStart - b.distanceFromStart
  if (segment === null) return { onRoute: [], offRoute: [...markers].sort(byScalar) }

  const dir = PHASE_DIRECTION[segment.phase] ?? 1
  const onRoute: Array<{ m: SignMarker; km: number }> = []
  const offRoute: SignMarker[] = []

  for (const m of markers) {
    const km = segmentKm(m, segment)
    if (km === null) offRoute.push(m)
    else onRoute.push({ m, km })
  }

  onRoute.sort((a, b) => (a.km - b.km) * dir)
  offRoute.sort(byScalar)
  return { onRoute: onRoute.map(x => x.m), offRoute }
}

/**
 * Näyttöä varten: merkin km pätkän akselilla, fallback merkin omaan skalaariin kun merkki ei
 * ole pätkän välillä (V139-reititön / "ei reitillä" -ryhmä). Näin lukema on AINA samalta
 * akselilta kuin järjestys — B129: hero eteni oikein mutta näytti 0.0 km merkille joka on
 * 25.18 km kohdalla, koska näyttö luki skalaarin ja järjestys akselin.
 */
export function displayKm(
  marker: Pick<SignMarker, 'distanceByRoute' | 'distanceFromStart' | 'lat' | 'lon'>,
  segment: Pick<Segment, 'primaryRouteId' | 'routeIds' | 'startDist' | 'endDist' | 'track'> | null,
): number {
  if (segment === null) return marker.distanceFromStart
  return segmentKm(marker, segment) ?? marker.distanceFromStart
}
