import { describe, it, expect } from 'vitest'
import { planSegmentZoom } from '../src/logic/segment-zoom'

describe('T224 (D) / T265 (B107) — planSegmentZoom (aina fit koko pätkä, V185)', () => {
  it('lyhyt pätkä → fit koko pätkä', () => {
    const plan = planSegmentZoom(5000, 8000) // 3 km
    expect(plan).toEqual({ mode: 'fit', startDist: 5000, endDist: 8000 })
  })

  it('T265/B107: pitkä pätkä → EDELLEEN fit koko väli (ei anchor-clamppia)', () => {
    const plan = planSegmentZoom(10000, 30000) // 20 km
    expect(plan).toEqual({ mode: 'fit', startDist: 10000, endDist: 30000 })
  })

  it('T265/B107: hyvin pitkä pätkä → koko väli, endDist = todellinen loppu', () => {
    const plan = planSegmentZoom(0, 55000) // 55 km
    expect(plan).toEqual({ mode: 'fit', startDist: 0, endDist: 55000 })
  })

  it('reititön / puuttuvat rajat → null (kutsuja fallback)', () => {
    expect(planSegmentZoom(undefined, undefined)).toBeNull()
    expect(planSegmentZoom(5000, undefined)).toBeNull()
    expect(planSegmentZoom(undefined, 5000)).toBeNull()
  })

  it('epäkelpo väli (loppu <= alku) → null', () => {
    expect(planSegmentZoom(8000, 5000)).toBeNull()
    expect(planSegmentZoom(5000, 5000)).toBeNull()
  })

  it('NaN → null', () => {
    expect(planSegmentZoom(NaN, 5000)).toBeNull()
  })
})
