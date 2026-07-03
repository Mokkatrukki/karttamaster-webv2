import { describe, it, expect } from 'vitest'
import { createSegmentStore, createSegment, getSegmentProgress } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'
import type { MarkerStatus } from '../src/logic/types'

const baseSegment = {
  routeIds: ['r1'],
  startDist: 0,
  endDist: 10000,
  equipment: [],
  phase: 'asettaminen' as const,
}

function makeMarker(id: string, status: MarkerStatus, dist: number = 5000): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: dist,
    routeIds: ['r1'],
    status,
  }
}

describe('T95 — getSegmentProgress (V9, T13, T25)', () => {
  it('tyhjä pätkä (ei merkkejä) → 0%', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    expect(getSegmentProgress(seg, [])).toBe(0)
  })

  it('kaikki suunniteltu → 0%', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [makeMarker('m1', 'suunniteltu'), makeMarker('m2', 'suunniteltu')]
    expect(getSegmentProgress(seg, markers)).toBe(0)
  })

  it('osa asetettu → oikea prosentti', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [
      makeMarker('m1', 'asetettu'),
      makeMarker('m2', 'suunniteltu'),
    ]
    expect(getSegmentProgress(seg, markers)).toBe(50)
  })

  it('kaikki asetettu → 100%', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [makeMarker('m1', 'asetettu'), makeMarker('m2', 'asetettu')]
    expect(getSegmentProgress(seg, markers)).toBe(100)
  })

  it('tarkistettu lasketaan mukaan', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [
      makeMarker('m1', 'tarkistettu'),
      makeMarker('m2', 'suunniteltu'),
    ]
    expect(getSegmentProgress(seg, markers)).toBe(50)
  })

  it('kerätty lasketaan mukaan', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [
      makeMarker('m1', 'kerätty'),
      makeMarker('m2', 'suunniteltu'),
    ]
    expect(getSegmentProgress(seg, markers)).toBe(50)
  })

  it('ei_tarpeen ei laske edistyneeksi', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [makeMarker('m1', 'ei_tarpeen'), makeMarker('m2', 'suunniteltu')]
    expect(getSegmentProgress(seg, markers)).toBe(0)
  })

  it('pyöristää kokonaislukuun', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, baseSegment)
    const markers = [
      makeMarker('m1', 'asetettu'),
      makeMarker('m2', 'suunniteltu'),
      makeMarker('m3', 'suunniteltu'),
    ]
    // 1/3 = 33.33... → 33
    expect(getSegmentProgress(seg, markers)).toBe(33)
  })

  it('huomioi vain pätkän sisällä olevat merkit', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { ...baseSegment, startDist: 2000, endDist: 8000 })
    const markers = [
      makeMarker('inside', 'asetettu', 5000),
      makeMarker('outside', 'suunniteltu', 1000),  // before startDist
    ]
    // Only 'inside' counts → 1/1 = 100%
    expect(getSegmentProgress(seg, markers)).toBe(100)
  })
})
