import type { SignMarker } from './types'
import { type TaskMarkerSource } from './task-markers'
import { markersForSegment, type MembershipSegment } from './segment-membership'

// V243: kartan fokus-tila HIMMENTÄÄ, ⊥ piilota. Tämä moduuli päättää VAIN kumpaan joukkoon
// merkki kuuluu — himmennyksen visuaalinen toteutus on src/map/ + src/style.css.
export type FocusState = 'focus' | 'dim'

// V140/V259: jäsenyys tulee KANONISESTA lähteestä — ⊥ omaa jäsenyyssääntöä tänne. Oma sääntö
// on B114–B129:n juurisyy yhdeksän kertaa: reittifiltteri, linkedMarkerIds ja markerTypeFilter
// elävät yhdessä paikassa tai eivät missään.
//
// T359 SIIRSI kanonisen lähteen `resolveTaskMarkers`ista `markersForSegment`iin (eksklusiivinen,
// V259). Tämä moduuli jäi osoittamaan vanhaan ∴ kartan korostus näytti pätkälle merkkejä joita
// sen oma lista ⊥ näytä (ck:check-löydös). `peers` = saman vaiheen pätkät; tyhjä → legacy-sääntö,
// eli sama konservatiivinen haara kuin ennen T359:ää.
//
// `focusSegment === undefined` ⇒ ei fokusta ⇒ ∀ merkki 'focus' (sama haara kuin
// `contextSegmentStyle`in `contextOwnId === undefined`). Tyhjä pätkä ⇒ kaikki 'dim' — se on
// rehellinen tila (pätkällä ei ole merkkejä), ⊥ virhe.
export function focusState(
  markers: SignMarker[],
  focusSegment: TaskMarkerSource | undefined,
  peers: MembershipSegment[] = [],
): Map<string, FocusState> {
  const state = new Map<string, FocusState>()
  if (focusSegment === undefined) {
    for (const m of markers) state.set(m.id, 'focus')
    return state
  }
  const focused = new Set(markersForSegment(focusSegment as MembershipSegment, markers, peers).map(m => m.id))
  for (const m of markers) state.set(m.id, focused.has(m.id) ? 'focus' : 'dim')
  return state
}

// Kartan renderöinti kysyy merkki kerrallaan (`getElement()?.classList.toggle`) ∴ predikaatti
// on siellä luontevampi kuin Map-lookup. Sama sääntö, ⊥ kahta toteutusta: Map on lähde.
export function isFocused(
  state: Map<string, FocusState>,
  markerId: string,
): boolean {
  return state.get(markerId) !== 'dim'
}
