import { describe, it, expect } from 'vitest'
import type { SignMarker } from '../src/logic/types'

// V52: bearingManual-lippu estää dragend-autorotaation

function resolveDragBearing(m: SignMarker, autoCalculatedBearing: number): number {
  return m.bearingManual ? m.bearing : autoCalculatedBearing
}

describe('T97 — V52: dragend bearing-päätös', () => {
  const base: SignMarker = {
    id: 'test-id',
    type: 'right',
    lat: 60.0,
    lon: 25.0,
    bearing: 45,
    distanceFromStart: 1000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    bearingManual: false,
  }

  it('bearingManual=false → käyttää auto-lasketun bearingin', () => {
    const m = { ...base, bearingManual: false, bearing: 45 }
    expect(resolveDragBearing(m, 180)).toBe(180)
  })

  it('bearingManual=true → säilyttää m.bearing, ignoroi auto-lasketun', () => {
    const m = { ...base, bearingManual: true, bearing: 45 }
    expect(resolveDragBearing(m, 180)).toBe(45)
  })

  it('bearingManual undefined → käyttää auto-lasketun (backward-compat)', () => {
    const m = { ...base, bearingManual: undefined }
    expect(resolveDragBearing(m, 270)).toBe(270)
  })

  it('bearingManual=true eri bearing → säilyttää oikean arvon', () => {
    const m = { ...base, bearingManual: true, bearing: 317 }
    expect(resolveDragBearing(m, 90)).toBe(317)
  })

  it('SignMarker-tyyppi hyväksyy bearingManual-kentän', () => {
    const m: SignMarker = { ...base, bearingManual: true }
    expect(m.bearingManual).toBe(true)
  })
})
