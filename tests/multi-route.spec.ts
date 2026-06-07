import { describe, it, expect } from 'vitest'
import { assignRoutesToMarker } from '../src/logic/multi-route'
import { buildRoutePoints } from '../src/logic/bearing'

// Route A: lat 65.0, lon 27.00→27.10 (shared segment 27.00–27.05, then own)
// Route B: lat 65.0, lon 27.00→27.05 then lat 65.01 lon 27.06→27.10 (diverges)
const sharedCoords = Array.from({ length: 6 }, (_, i) => ({ lat: 65.0, lon: 27.0 + i * 0.01 }))
const routeAOwn   = Array.from({ length: 5 }, (_, i) => ({ lat: 65.0,  lon: 27.06 + i * 0.01 }))
const routeBOwn   = Array.from({ length: 5 }, (_, i) => ({ lat: 65.01, lon: 27.06 + i * 0.01 }))

const routeA = { id: 'A', routePoints: buildRoutePoints([...sharedCoords, ...routeAOwn]) }
const routeB = { id: 'B', routePoints: buildRoutePoints([...sharedCoords, ...routeBOwn]) }

describe('assignRoutesToMarker', () => {
  it('shared segment — within 100m of both routes → both ids returned', () => {
    // lon 27.02 is on the shared segment — both routes pass through here
    const ids = assignRoutesToMarker(65.0, 27.02, [routeA, routeB])
    expect(ids).toContain('A')
    expect(ids).toContain('B')
  })

  it('route A own segment — far from route B → only A', () => {
    // lat 65.0, lon 27.08 is on route A's own path
    // route B diverges to lat 65.01 here — ~1.1 km apart
    const ids = assignRoutesToMarker(65.0, 27.08, [routeA, routeB])
    expect(ids).toContain('A')
    expect(ids).not.toContain('B')
  })

  it('route B own segment — far from route A → only B', () => {
    // lat 65.01, lon 27.08 is on route B's own path
    const ids = assignRoutesToMarker(65.01, 27.08, [routeA, routeB])
    expect(ids).toContain('B')
    expect(ids).not.toContain('A')
  })

  it('custom tight threshold — excludes routes that are too far', () => {
    // Point slightly off-route (~55m north of shared segment)
    // Both routes are ~55m away, so default 100m threshold includes both
    // but 10m threshold includes neither
    const offRoute = { lat: 65.0005, lon: 27.02 }
    const defaultIds = assignRoutesToMarker(offRoute.lat, offRoute.lon, [routeA, routeB])
    expect(defaultIds.length).toBe(2) // both within 100m
    const strictIds = assignRoutesToMarker(offRoute.lat, offRoute.lon, [routeA, routeB], 10)
    expect(strictIds.length).toBe(0) // neither within 10m
  })

  it('empty routes array → empty result', () => {
    expect(assignRoutesToMarker(65.0, 27.02, [])).toEqual([])
  })
})

// Manual verification required (DOM/Leaflet):
it.todo('Both routes visible as colored polylines on page load')
it.todo('Route visibility toggle hides polyline and exclusive markers')
it.todo('Shared marker visible when only one of its routes is active')
it.todo('Drive mode pans to active route GPS points')
it.todo('Switching active drive route resets progress to 0 on new route')
it.todo('Route selector usable at 375px viewport width (44px touch targets)')
it.todo('Progress bar km/total reflect active drive route')
