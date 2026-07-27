import type { Segment, SegmentStore } from './segments'
import { segmentPrimaryRouteId } from './segments'
import { deriveTrackFromBounds } from './segment-track'
import type { RoutePoint } from './types'

// T361/V258/V260: LEGACY-PÄTKÄ SAA JÄLJEN.
//
// Miksi client eikä migraatioskripti: reittigeometria elää selaimessa (GPX ladataan
// `public/`:sta), ⊥ kannassa. `scripts/`-skripti tarvitsisi oman kopionsa reittilistasta —
// juuri se virhe jonka T303/B117 korjasi (kopio jäi jälkeen kun 6. reitti lisättiin & migraatio
// ajettiin 5/6 reitillä tuotantoon). Sama laiska kuvio kuin `backfillDistanceByRoute`
// (T300/V212): totuus on johdettavissa geometriasta ∴ se johdetaan siellä missä geometria on.
//
// V260: ennen pushia serveri käyttää km-haaraa ∴ välitila on laillinen, ⊥ rikki.

export interface RouteGeometry {
  id: string
  routePoints: RoutePoint[]
}

/**
 * Johtaa jäljen jokaiselle pätkälle jolta se puuttuu. Palauttaa MUUTETUT pätkät — kutsuja
 * pushaa ne (⊥ tämä: puhdas logiikka ⊥ tunne verkkoa).
 *
 * Ohittaa: (a) pätkän jolla on jo jälki — backfill ⊥ ylikirjoita klik-klikillä piirrettyä
 * (T362) tai kentällä säädettyä (T363) geometriaa; (b) reitittömän tehtävän (V139) — sillä ⊥
 * ole akselia josta johtaa; (c) pätkän jonka reittiä ⊥ löydy (esim. GPX puuttuu) — arvaus olisi
 * pahempi kuin puuttuva jälki, koska legacy-haara toimii yhä.
 */
export function backfillSegmentTracks(store: SegmentStore, routes: RouteGeometry[]): Segment[] {
  const changed: Segment[] = []

  for (const seg of store.values()) {
    if (seg.track && seg.track.length > 0) continue
    if (seg.startDist === undefined || seg.endDist === undefined) continue

    const routeId = segmentPrimaryRouteId(seg)
    if (routeId === undefined) continue
    const route = routes.find(r => r.id === routeId)
    if (!route || route.routePoints.length === 0) continue

    const track = deriveTrackFromBounds(route.routePoints, seg.startDist, seg.endDist)
    // Tyhjä siivu (rajat reitin ulkopuolella / ristikkäin) → JÄTÄ jäljettömäksi. Tyhjä jälki
    // kannassa olisi huonompi kuin puuttuva: se näyttäisi migroidulta mutta ⊥ omistaisi mitään.
    if (track.length < 2) continue

    seg.track = track
    changed.push(seg)
  }

  return changed
}
