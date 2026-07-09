import { describe, it, expect } from 'vitest'
import { planSegmentZoom } from '../src/logic/segment-zoom'

describe('T224 (D) — planSegmentZoom', () => {
  it('lyhyt pätkä → fit koko pätkä', () => {
    const plan = planSegmentZoom(5000, 8000) // 3 km < 4 km
    expect(plan).toEqual({ mode: 'fit', startDist: 5000, endDist: 8000 })
  })

  it('täsmälleen maxFit → vielä fit (raja mukaan lukien)', () => {
    const plan = planSegmentZoom(0, 4000)
    expect(plan?.mode).toBe('fit')
    expect(plan?.endDist).toBe(4000)
  })

  it('pitkä pätkä → anchor alkupäähän, ikkuna = maxFit', () => {
    const plan = planSegmentZoom(10000, 30000) // 20 km >> 4 km
    expect(plan).toEqual({ mode: 'anchor', startDist: 10000, endDist: 14000 })
  })

  it('custom maxFitLengthM ohjaa rajaa', () => {
    const plan = planSegmentZoom(0, 3000, { maxFitLengthM: 2000 })
    expect(plan).toEqual({ mode: 'anchor', startDist: 0, endDist: 2000 })
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
