import { describe, it, expect, vi } from 'vitest'
import { buildRoutePoints } from '../src/bearing'

// Test DriveMode logic in isolation (no Leaflet)
// We extract the pure step logic here to test without DOM/map

function makeRoute(count: number, stepMeters = 100) {
  const coords = Array.from({ length: count }, (_, i) => ({
    lat: 60 + i * 0.001,
    lon: 25,
  }))
  return buildRoutePoints(coords)
}

function findNextIndex(points: ReturnType<typeof buildRoutePoints>, currentIndex: number, stepMeters: number): number {
  const targetDist = points[currentIndex].distanceFromStart + stepMeters
  let i = currentIndex
  while (i < points.length - 1 && points[i].distanceFromStart < targetDist) i++
  return i
}

function findPrevIndex(points: ReturnType<typeof buildRoutePoints>, currentIndex: number, stepMeters: number): number {
  const targetDist = points[currentIndex].distanceFromStart - stepMeters
  let i = currentIndex
  while (i > 0 && points[i].distanceFromStart > targetDist) i--
  return i
}

describe('drive mode step logic', () => {
  const route = makeRoute(100)

  it('next advances index', () => {
    const next = findNextIndex(route, 0, 50)
    expect(next).toBeGreaterThan(0)
  })

  it('next stops at last point', () => {
    const last = route.length - 1
    const next = findNextIndex(route, last, 50)
    expect(next).toBe(last)
  })

  it('prev retreats index', () => {
    const next = findNextIndex(route, 0, 50)
    const back = findPrevIndex(route, next, 50)
    expect(back).toBeLessThan(next)
  })

  it('prev stops at first point', () => {
    const prev = findPrevIndex(route, 0, 50)
    expect(prev).toBe(0)
  })

  it('round trip lands near start', () => {
    let idx = 0
    for (let i = 0; i < 5; i++) idx = findNextIndex(route, idx, 50)
    for (let i = 0; i < 5; i++) idx = findPrevIndex(route, idx, 50)
    expect(idx).toBeLessThanOrEqual(2)
  })
})
