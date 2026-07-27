import type { Segment, SegmentStore } from './segments'
import { segmentPrimaryRouteId } from './segments'
import { deriveTrackFromBounds } from './segment-track'
import type { SegmentTrack } from './segment-track'
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
    // T363: `deriveTrackFromBounds` heittää ristikkäisistä rajoista ∴ tarkista ENNEN kutsua.
    // Rikkinäinen legacy-rivi ⊥ saa kaataa koko backfilliä — se jää V260-km-haaraan.
    if (seg.startDist >= seg.endDist) continue

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

/**
 * T363/V258: rajojen muutos → uusi jälki SAMASTA johtofunktiosta kuin backfill & legacy-migraatio.
 * V258 vaatii yhden johtotavan: kolme kopiota ajautuisi erilleen & pätkän maasto riippuisi siitä
 * kuka sen viimeksi tallensi.
 *
 * Palauttaa patchin jonka kutsuja antaa `updateSegment`ille & serverille SELLAISENAAN — jälki ⊥
 * saa jäädä pois kummastakaan, muuten jäsenyys (V259) vastaisi rajaa jota ⊥ enää ole.
 * `track: undefined` = reittiä ⊥ löydy tai siivu on liian lyhyt → pätkä jää V260-km-haaraan
 * (⊥ tyhjää jälkeä kantaan: se näyttäisi migroidulta muttei omistaisi mitään).
 */
export function boundsPatch(
  segment: Pick<Segment, 'routeIds' | 'primaryRouteId'>,
  routes: RouteGeometry[],
  startDist: number,
  endDist: number,
): { startDist: number; endDist: number; track?: SegmentTrack } {
  const base = { startDist, endDist }
  if (startDist >= endDist) return base

  const routeId = segmentPrimaryRouteId(segment)
  if (routeId === undefined) return base
  const route = routes.find(r => r.id === routeId)
  if (!route || route.routePoints.length === 0) return base

  const track = deriveTrackFromBounds(route.routePoints, startDist, endDist)
  return track.length < 2 ? base : { ...base, track }
}
