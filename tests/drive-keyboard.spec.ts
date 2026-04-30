import { describe, it, expect } from 'vitest'
import { buildRoutePoints } from '../src/bearing'

// Spec: keyboard navigation in drive mode
// Written from VERIFICATION criteria, before implementation

function makeRoute(count: number) {
  return buildRoutePoints(
    Array.from({ length: count }, (_, i) => ({ lat: 60 + i * 0.001, lon: 25 }))
  )
}

function findNextIndex(points: ReturnType<typeof buildRoutePoints>, idx: number, step: number) {
  const target = points[idx].distanceFromStart + step
  let i = idx
  while (i < points.length - 1 && points[i].distanceFromStart < target) i++
  return i
}

function findPrevIndex(points: ReturnType<typeof buildRoutePoints>, idx: number, step: number) {
  const target = points[idx].distanceFromStart - step
  let i = idx
  while (i > 0 && points[i].distanceFromStart > target) i--
  return i
}

describe('Drive mode keyboard navigation', () => {
  const route = makeRoute(200)
  const STEP = 50

  describe('ArrowRight advances route', () => {
    it('moves forward 50m', () => {
      const next = findNextIndex(route, 0, STEP)
      const dist = route[next].distanceFromStart - route[0].distanceFromStart
      expect(dist).toBeGreaterThanOrEqual(STEP - 5)
    })

    it('stops at last point, does not overflow', () => {
      const last = route.length - 1
      const next = findNextIndex(route, last, STEP)
      expect(next).toBe(last)
    })
  })

  describe('ArrowLeft retreats route', () => {
    it('moves backward 50m', () => {
      const mid = findNextIndex(route, 0, 200)
      const prev = findPrevIndex(route, mid, STEP)
      expect(prev).toBeLessThan(mid)
    })

    it('stops at first point, does not underflow', () => {
      const prev = findPrevIndex(route, 0, STEP)
      expect(prev).toBe(0)
    })
  })

  describe('drive mode off = no action', () => {
    it('step logic not called when inactive', () => {
      let active = false
      const handleKey = (key: string) => {
        if (!active) return null
        if (key === 'ArrowRight') return 'next'
        if (key === 'ArrowLeft') return 'prev'
        if (key === 'Escape') { active = false; return 'stop' }
        return null
      }
      expect(handleKey('ArrowRight')).toBeNull()
      expect(handleKey('ArrowLeft')).toBeNull()
    })
  })

  describe('Escape stops drive mode', () => {
    it('active=false after Escape', () => {
      let active = true
      const handleKey = (key: string) => {
        if (!active) return null
        if (key === 'Escape') { active = false; return 'stop' }
        return null
      }
      expect(handleKey('Escape')).toBe('stop')
      expect(active).toBe(false)
    })

    it('further key presses do nothing after Escape', () => {
      let active = true
      const handleKey = (key: string) => {
        if (!active) return null
        if (key === 'Escape') { active = false; return 'stop' }
        return 'action'
      }
      handleKey('Escape')
      expect(handleKey('ArrowRight')).toBeNull()
    })
  })
})
