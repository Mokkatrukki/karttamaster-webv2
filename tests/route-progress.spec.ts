import { describe, it, expect } from 'vitest'
import { buildRoutePoints, routePositionPct } from '../src/logic/bearing'

const ROUTE = buildRoutePoints([
  { lat: 65.62, lon: 27.62 },
  { lat: 65.63, lon: 27.63 },
  { lat: 65.64, lon: 27.64 },
  { lat: 65.65, lon: 27.65 },
  { lat: 65.66, lon: 27.66 },
])

describe('Progress bar — position calculation', () => {
  it('sign at start = 0% position on bar', () => {
    const total = ROUTE[ROUTE.length - 1].distanceFromStart
    expect(routePositionPct(0, total)).toBe(0)
  })

  it('sign at end = 100% position on bar', () => {
    const total = ROUTE[ROUTE.length - 1].distanceFromStart
    expect(routePositionPct(total, total)).toBe(100)
  })

  it('sign at midpoint ≈ 50% position on bar', () => {
    const total = ROUTE[ROUTE.length - 1].distanceFromStart
    const mid = ROUTE[2].distanceFromStart
    const pct = routePositionPct(mid, total)
    expect(pct).toBeGreaterThan(40)
    expect(pct).toBeLessThan(60)
  })

  it('clamps to 0 when distance negative', () => {
    const total = ROUTE[ROUTE.length - 1].distanceFromStart
    expect(routePositionPct(-100, total)).toBe(0)
  })

  it('clamps to 100 when distance exceeds total', () => {
    const total = ROUTE[ROUTE.length - 1].distanceFromStart
    expect(routePositionPct(total + 9999, total)).toBe(100)
  })
})

describe('DriveMode.jumpTo', () => {
  it.todo('jumpTo(index) moves currentKm to that route point')
  it.todo('jumpTo activates drive mode if not already active')
  it.todo('jumpTo clamps to valid index range (0 .. routePoints.length-1)')
  it.todo('stop() after jumpTo resets position to 0km')
})

describe('Progress bar UI', () => {
  it.todo('progress bar element is visible in DOM on page load')
  it.todo('clicking progress bar at 50% width navigates to ~midpoint km')
  it.todo('dragging handle updates map position in real-time')
  it.todo('sign markers appear as dots at correct percentage positions')
  it.todo('hovering sign dot shows tooltip with km and type (V/O)')
})

describe('GPX line click', () => {
  it.todo('clicking polyline on map activates drive mode at nearest route point')
  it.todo('clicking polyline mid-route does not jump to index 0')
})

describe('Layout — drive controls and marker list', () => {
  it.todo('◀ ▶ stop buttons render inside bottom bar, not toolbar')
  it.todo('marker list opens as map overlay modal, not side panel')
  it.todo('Escape closes marker modal without stopping drive mode')
  it.todo('outside click closes marker modal')
})
