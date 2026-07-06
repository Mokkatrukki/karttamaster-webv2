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

// DriveMode.jumpTo — clamp-logiikka eristetty puhtaana funktiona (kuten drive.test.ts),
// ei importoida DriveMode-luokkaa jotta vältetään Leaflet-riippuvuus (src/map/ → Playwright).
function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1))
}

describe('DriveMode.jumpTo — index clamping (src/map/drive.ts:34)', () => {
  // stop()-resetointi 0km:aan katettu e2e/critical-paths.spec.ts:n Escape-testissä.
  // jumpTo(index) aktivoi ajotilan aina (active=true) — sivuvaikutus vaatii DOM/Leaflet-mapin, ks. e2e.
  it('jumpTo(index) moves currentKm to that route point', () => {
    const idx = clampIndex(2, ROUTE.length)
    expect(ROUTE[idx].distanceFromStart).toBe(ROUTE[2].distanceFromStart)
  })

  it('jumpTo clamps negative index to 0', () => {
    expect(clampIndex(-5, ROUTE.length)).toBe(0)
  })

  it('jumpTo clamps out-of-range index to last point', () => {
    expect(clampIndex(999, ROUTE.length)).toBe(ROUTE.length - 1)
  })
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
