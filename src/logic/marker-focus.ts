import type { SignMarker } from './types'
import { resolveTaskMarkers, type TaskMarkerSource } from './task-markers'

// V243: kartan fokus-tila HIMMENTÄÄ, ⊥ piilota. Tämä moduuli päättää VAIN kumpaan joukkoon
// merkki kuuluu — himmennyksen visuaalinen toteutus on src/map/ + src/style.css.
export type FocusState = 'focus' | 'dim'

// V140: jäsenyys tulee kanonisesta resolveTaskMarkers:ista — ⊥ omaa jäsenyyssääntöä tänne.
// Oma sääntö on B114–B129:n juurisyy yhdeksän kertaa: reittifiltteri, linkedMarkerIds ja
// markerTypeFilter elävät yhdessä paikassa tai eivät missään.
//
// `focusSegment === undefined` ⇒ ei fokusta ⇒ ∀ merkki 'focus' (sama haara kuin
// `contextSegmentStyle`in `contextOwnId === undefined`). Tyhjä pätkä ⇒ kaikki 'dim' — se on
// rehellinen tila (pätkällä ei ole merkkejä), ⊥ virhe.
export function focusState(
  markers: SignMarker[],
  focusSegment: TaskMarkerSource | undefined,
): Map<string, FocusState> {
  const state = new Map<string, FocusState>()
  if (focusSegment === undefined) {
    for (const m of markers) state.set(m.id, 'focus')
    return state
  }
  const focused = new Set(resolveTaskMarkers(focusSegment, markers).map(m => m.id))
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
