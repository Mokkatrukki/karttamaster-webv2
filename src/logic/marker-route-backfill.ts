import type { SignMarker, RoutePoint } from './types'
import { nearestRouteByPath } from './multi-route'

// T392/V284: MERKKI SAA LÄHIMMÄN REITTINSÄ.
//
// Miksi client eikä migraatioskripti: reittigeometria elää selaimessa (GPX ladataan
// `public/`:sta), ⊥ kannassa — sama peruste kuin `backfillSegmentTracks` (T361) &
// `backfillDistanceByRoute` (T300). `scripts/`-skripti tarvitsisi oman kopionsa reittilistasta,
// & juuri se kopio jäi jälkeen T303/B117:ssä (migraatio ajettiin 5/6 reitillä tuotantoon).
//
// Välitila on laillinen: kenttä puuttuu → jäsenyys ⊥ sovella V284-sääntöä ∴ käytös on entinen.

export interface RouteGeometry {
  id: string
  routePoints: RoutePoint[]
}

/**
 * Laskee `nearestRouteId`/`nearestRouteDistM` jokaiselle merkille jolta ne puuttuvat.
 * MUTATOI merkit & palauttaa muutetut — kutsuja pushaa ne (puhdas logiikka ⊥ tunne verkkoa).
 *
 * Ohittaa merkin jolla arvo on jo — backfill ⊥ ylikirjoita luonti-/siirtohetkellä laskettua
 * (se on tuoreempi & mitattu samasta geometriasta).
 */
export function backfillNearestRoute(markers: SignMarker[], routes: RouteGeometry[]): SignMarker[] {
  const changed: SignMarker[] = []
  for (const m of markers) {
    if (m.nearestRouteDistM !== undefined) continue
    const nearest = nearestRouteByPath(m.lat, m.lon, routes)
    // Reitittömiä (⊥ yhtään GPX:ää ladattu) ⊥ merkitä: Infinity-etäisyys tekisi säännöstä
    // ohittamattoman & pudottaisi merkin jokaisesta pätkästä.
    if (!nearest) continue
    m.nearestRouteId = nearest.routeId
    m.nearestRouteDistM = nearest.distM
    changed.push(m)
  }
  return changed
}
