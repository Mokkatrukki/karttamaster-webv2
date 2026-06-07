import { describe, it, expect } from 'vitest'
import { calcBearing, haversineDistance, buildRoutePoints, nearestPointIndex, bearingAtIndex } from '../src/logic/bearing'

describe('calcBearing', () => {
  it('north', () => {
    const b = calcBearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
    expect(b).toBeCloseTo(0, 0)
  })

  it('east', () => {
    const b = calcBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    expect(b).toBeCloseTo(90, 0)
  })

  it('south', () => {
    const b = calcBearing({ lat: 1, lon: 0 }, { lat: 0, lon: 0 })
    expect(b).toBeCloseTo(180, 0)
  })

  it('west', () => {
    const b = calcBearing({ lat: 0, lon: 1 }, { lat: 0, lon: 0 })
    expect(b).toBeCloseTo(270, 0)
  })
})

describe('haversineDistance', () => {
  it('same point = 0', () => {
    expect(haversineDistance({ lat: 65, lon: 27 }, { lat: 65, lon: 27 })).toBe(0)
  })

  it('~111km per degree latitude', () => {
    const d = haversineDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })
})

describe('buildRoutePoints', () => {
  it('first point distance = 0', () => {
    const pts = buildRoutePoints([{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }])
    expect(pts[0].distanceFromStart).toBe(0)
  })

  it('cumulative distance increases', () => {
    const pts = buildRoutePoints([
      { lat: 0, lon: 0 },
      { lat: 0.01, lon: 0 },
      { lat: 0.02, lon: 0 },
    ])
    expect(pts[1].distanceFromStart).toBeGreaterThan(0)
    expect(pts[2].distanceFromStart).toBeGreaterThan(pts[1].distanceFromStart)
  })
})

describe('nearestPointIndex', () => {
  const pts = buildRoutePoints([
    { lat: 60, lon: 25 },
    { lat: 61, lon: 25 },
    { lat: 62, lon: 25 },
  ])

  it('finds exact match', () => {
    expect(nearestPointIndex(pts, 61, 25)).toBe(1)
  })

  it('finds nearest when off-route', () => {
    expect(nearestPointIndex(pts, 60.1, 25)).toBe(0)
  })
})

describe('bearingAtIndex', () => {
  const northPts = buildRoutePoints([
    { lat: 60, lon: 25 },
    { lat: 61, lon: 25 },
    { lat: 62, lon: 25 },
  ])

  it('first point goes north', () => {
    expect(bearingAtIndex(northPts, 0)).toBeCloseTo(0, 0)
  })

  it('last point goes north', () => {
    expect(bearingAtIndex(northPts, 2)).toBeCloseTo(0, 0)
  })

  it('single-point route returns 0', () => {
    const pts = buildRoutePoints([{ lat: 60, lon: 25 }])
    expect(bearingAtIndex(pts, 0)).toBe(0)
  })
})
