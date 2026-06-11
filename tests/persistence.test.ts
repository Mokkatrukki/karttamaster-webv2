import { describe, it, expect } from 'vitest'
import { saveMarkers, loadMarkers } from '../src/logic/persistence'
import type { SignMarker } from '../src/logic/types'

const MARKER: SignMarker = {
  id: 'test-id',
  type: 'right',
  lat: 61.0,
  lon: 25.0,
  bearing: 90,
  distanceFromStart: 1000,
  routeIds: ['35km'],
  status: 'suunniteltu',
}

// DB is the source of truth — persistence.ts is now a no-op layer.
describe('saveMarkers', () => {
  it('does not throw', () => {
    expect(() => saveMarkers([MARKER])).not.toThrow()
  })

  it('does not throw on empty array', () => {
    expect(() => saveMarkers([])).not.toThrow()
  })
})

describe('loadMarkers', () => {
  it('always returns [] — DB is source of truth', () => {
    expect(loadMarkers()).toEqual([])
  })
})
