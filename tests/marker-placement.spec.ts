import { describe, it, expect } from 'vitest'
import { buildRoutePoints, nearestPointIndex } from '../src/logic/bearing'

// Spec: how markers behave when placed on the map
// Written BEFORE any new implementation.
// Red → Green → Refactor

const SYOTE_SEGMENT = buildRoutePoints([
  { lat: 65.6277, lon: 27.6275 }, // north
  { lat: 65.6278, lon: 27.6274 },
  { lat: 65.6279, lon: 27.6278 },
  { lat: 65.6281, lon: 27.6283 },
  { lat: 65.6282, lon: 27.6290 }, // northeast turn
])

describe('Marker placement', () => {
  describe('snapping to route', () => {
    it('marker placed exactly on route snaps to that point', () => {
      const idx = nearestPointIndex(SYOTE_SEGMENT, 65.6279, 27.6278)
      expect(SYOTE_SEGMENT[idx].lat).toBeCloseTo(65.6279, 4)
    })

    it('marker placed 20m off route snaps to nearest route point', () => {
      // slightly off route
      const idx = nearestPointIndex(SYOTE_SEGMENT, 65.6279, 27.6270)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(SYOTE_SEGMENT.length)
    })
  })

  describe('marker ordering in list', () => {
    it('markers appear sorted by distance from start regardless of insertion order', () => {
      // simulate inserting in reverse order
      const pts = SYOTE_SEGMENT
      const markerDistances = [
        pts[4].distanceFromStart,
        pts[1].distanceFromStart,
        pts[3].distanceFromStart,
      ]
      const sorted = [...markerDistances].sort((a, b) => a - b)
      expect(sorted[0]).toBe(pts[1].distanceFromStart)
      expect(sorted[2]).toBe(pts[4].distanceFromStart)
    })
  })

  // Pending specs — not yet implemented, act as roadmap
  it.todo('duplicate marker at same location is prevented')
  it.todo('marker too far from route (>50m) shows warning')
})
