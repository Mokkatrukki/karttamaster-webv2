// T334/V243 — fokus-valinta puhtaana logiikkana. Taso 1 Vitest-pure: ei DOM:ia, ei Leafletia.
import { describe, it, expect } from 'vitest'
import { focusState, isFocused } from '../src/logic/marker-focus'
import type { SignMarker } from '../src/logic/types'
import type { TaskMarkerSource } from '../src/logic/task-markers'

function makeMarker(
  id: string,
  routeIds: string[],
  dist: number,
  templateId?: string,
): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: dist,
    routeIds,
    status: 'suunniteltu',
    ...(templateId ? { templateId } : {}),
  }
}

const markers = [
  makeMarker('a', ['smtb-30'], 2000),
  makeMarker('b', ['smtb-30'], 8000),
  makeMarker('c', ['smtb-60'], 2000, 'huolto'),
]

const routedSegment: TaskMarkerSource = {
  routeIds: ['smtb-30'],
  primaryRouteId: 'smtb-30',
  startDist: 1000,
  endDist: 5000,
}

describe('focusState (T334/V243)', () => {
  it('ei fokusta (undefined) → jokainen merkki fokuksessa', () => {
    const state = focusState(markers, undefined)
    expect([...state.values()]).toEqual(['focus', 'focus', 'focus'])
  })

  it('reitillinen pätkä → vain jäsenet fokuksessa, muut dim (⊥ pois)', () => {
    const state = focusState(markers, routedSegment)
    expect(state.get('a')).toBe('focus')
    expect(state.get('b')).toBe('dim')
    expect(state.get('c')).toBe('dim')
    // V243: himmennetty ≠ poistettu — jokaisella merkillä on tila
    expect(state.size).toBe(markers.length)
  })

  it('reititön markerTypeFilter-tehtävä (V139/V143) → tyyppiosumat fokuksessa', () => {
    const state = focusState(markers, { markerTypeFilter: 'huolto' })
    expect(state.get('c')).toBe('focus')
    expect(state.get('a')).toBe('dim')
    expect(state.get('b')).toBe('dim')
  })

  it('linkedMarkerIds poimii jäsenen ilman reittiä (V140-unioni)', () => {
    const state = focusState(markers, { linkedMarkerIds: ['b'] })
    expect(state.get('b')).toBe('focus')
    expect(state.get('a')).toBe('dim')
  })

  it('tyhjä pätkä ⊥ heitä — kaikki dim', () => {
    const state = focusState(markers, { routeIds: [], startDist: 0, endDist: 0 })
    expect([...state.values()]).toEqual(['dim', 'dim', 'dim'])
  })

  it('tyhjä merkkilista → tyhjä tila, ⊥ heitä', () => {
    expect(focusState([], routedSegment).size).toBe(0)
    expect(focusState([], undefined).size).toBe(0)
  })
})

describe('isFocused (T334)', () => {
  it('sama sääntö kuin focusState — dim on ainoa ei-fokus', () => {
    const state = focusState(markers, routedSegment)
    expect(isFocused(state, 'a')).toBe(true)
    expect(isFocused(state, 'b')).toBe(false)
  })

  it('tuntematon merkki-id → fokuksessa (⊥ himmennä sitä mitä ⊥ tunneta)', () => {
    expect(isFocused(focusState(markers, routedSegment), 'ei-ole')).toBe(true)
  })
})
