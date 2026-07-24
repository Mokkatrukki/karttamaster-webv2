import { describe, it, expect } from 'vitest'
import { bearingDeg, directionArrowPlacements } from '../src/logic/bearing'
import type { RoutePoint } from '../src/logic/types'

describe('T286 — bearingDeg', () => {
  it('pohjoinen ≈ 0°', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 1)
  })
  it('itä ≈ 90°', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 1)
  })
  it('etelä ≈ 180°', () => {
    expect(bearingDeg({ lat: 1, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(180, 1)
  })
  it('länsi ≈ 270°', () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })).toBeCloseTo(270, 1)
  })
})

describe('T286 — directionArrowPlacements', () => {
  function line(n: number): RoutePoint[] {
    // suora pohjoiseen, 100 m välein
    return Array.from({ length: n }, (_, i) => ({ lat: i * 0.001, lon: 0, distanceFromStart: i * 100 }))
  }

  it('tyhjä / yhden pisteen reitti → ei nuolia', () => {
    expect(directionArrowPlacements([], 800)).toEqual([])
    expect(directionArrowPlacements([{ lat: 0, lon: 0, distanceFromStart: 0 }], 800)).toEqual([])
  })

  it('nolla-pituinen reitti → ei nuolia', () => {
    const pts: RoutePoint[] = [
      { lat: 0, lon: 0, distanceFromStart: 0 },
      { lat: 0, lon: 0, distanceFromStart: 0 },
    ]
    expect(directionArrowPlacements(pts, 800)).toEqual([])
  })

  it('kiinteä väli → ~total/spacing nuolta (10 km reitti, 1 km väli → ~10)', () => {
    const placements = directionArrowPlacements(line(101), 1000) // 10 km reitti
    expect(placements.length).toBe(10)
  })

  it('tiheämpi väli → enemmän nuolia (sama reitti)', () => {
    const sparse = directionArrowPlacements(line(101), 2000)
    const dense = directionArrowPlacements(line(101), 500)
    expect(dense.length).toBeGreaterThan(sparse.length)
  })

  it('maxArrows-katto rajoittaa määrän', () => {
    expect(directionArrowPlacements(line(101), 50, 5).length).toBe(5)
  })

  it('nuolen bearing seuraa kulkusuuntaa (pohjoinen ≈ 0°)', () => {
    const placements = directionArrowPlacements(line(101), 1000)
    for (const p of placements) expect(p.bearing).toBeCloseTo(0, 0)
  })
})
