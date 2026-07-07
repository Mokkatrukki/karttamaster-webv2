import { describe, it, expect } from 'vitest'
import { markerScaleForZoom, MARKER_SCALE_ZOOM_MIN, MARKER_SCALE_ZOOM_MAX, MARKER_SCALE_MIN, MARKER_SCALE_MAX } from '../src/logic/marker-scale'

describe('markerScaleForZoom (T175/V109)', () => {
  it('clamps to MIN at/below zoom min', () => {
    expect(markerScaleForZoom(MARKER_SCALE_ZOOM_MIN)).toBe(MARKER_SCALE_MIN)
    expect(markerScaleForZoom(0)).toBe(MARKER_SCALE_MIN)
    expect(markerScaleForZoom(MARKER_SCALE_ZOOM_MIN - 5)).toBe(MARKER_SCALE_MIN)
  })

  it('clamps to MAX at/above zoom max', () => {
    expect(markerScaleForZoom(MARKER_SCALE_ZOOM_MAX)).toBe(MARKER_SCALE_MAX)
    expect(markerScaleForZoom(19)).toBe(MARKER_SCALE_MAX)
  })

  it('interpolates linearly at midpoint', () => {
    const mid = (MARKER_SCALE_ZOOM_MIN + MARKER_SCALE_ZOOM_MAX) / 2
    expect(markerScaleForZoom(mid)).toBeCloseTo((MARKER_SCALE_MIN + MARKER_SCALE_MAX) / 2, 5)
  })

  it('monotonically increases with zoom', () => {
    let prev = markerScaleForZoom(MARKER_SCALE_ZOOM_MIN)
    for (let z = MARKER_SCALE_ZOOM_MIN + 0.5; z <= MARKER_SCALE_ZOOM_MAX; z += 0.5) {
      const s = markerScaleForZoom(z)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
})
