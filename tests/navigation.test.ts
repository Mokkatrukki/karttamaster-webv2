import { describe, it, expect } from 'vitest'
import { nearestUnsetMarker, distanceToNext } from '../src/logic/navigation'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker>): SignMarker {
  return {
    id: 'test-id',
    type: 'right',
    lat: 0, lon: 0,
    bearing: 0,
    distanceFromStart: 0,
    routeIds: ['r1'],
    status: 'suunniteltu',
    ...overrides,
  }
}

const m1 = makeMarker({ id: 'm1', distanceFromStart: 100, routeIds: ['r1'] })
const m2 = makeMarker({ id: 'm2', distanceFromStart: 300, routeIds: ['r1'] })
const m3 = makeMarker({ id: 'm3', distanceFromStart: 500, routeIds: ['r1'], status: 'asetettu' })
const m4 = makeMarker({ id: 'm4', distanceFromStart: 200, routeIds: ['r2'] })

describe('nearestUnsetMarker', () => {
  it('palauttaa lähimmän suunniteltu-merkin', () => {
    const result = nearestUnsetMarker([m1, m2, m3], 250, 'r1')
    expect(result?.id).toBe('m2')
  })

  it('ohittaa asetettu/ei-suunniteltu statukset', () => {
    const result = nearestUnsetMarker([m3], 500, 'r1')
    expect(result).toBeNull()
  })

  it('ohittaa väärän reitin merkit', () => {
    const result = nearestUnsetMarker([m4], 200, 'r1')
    expect(result).toBeNull()
  })

  it('palauttaa null kun lista tyhjä', () => {
    expect(nearestUnsetMarker([], 0, 'r1')).toBeNull()
  })

  it('toimii kun currentDist on ennen ensimmäistä merkkiä', () => {
    const result = nearestUnsetMarker([m1, m2], 0, 'r1')
    expect(result?.id).toBe('m1')
  })

  it('toimii kun currentDist on jälkeen viimeisen merkin', () => {
    const result = nearestUnsetMarker([m1, m2], 1000, 'r1')
    expect(result?.id).toBe('m2')
  })

  it('yksi merkki — palauttaa se aina (V9)', () => {
    expect(nearestUnsetMarker([m1], 999, 'r1')?.id).toBe('m1')
  })

  it('tasa-arvo — palauttaa ensimmäisen kandidaatin', () => {
    const a = makeMarker({ id: 'a', distanceFromStart: 100, routeIds: ['r1'] })
    const b = makeMarker({ id: 'b', distanceFromStart: 100, routeIds: ['r1'] })
    const result = nearestUnsetMarker([a, b], 100, 'r1')
    expect(['a', 'b']).toContain(result?.id)
  })
})

describe('distanceToNext', () => {
  it('palauttaa etäisyyden metreinä lähimpään suunniteltu-merkkiin', () => {
    expect(distanceToNext([m1, m2], 0, 'r1')).toBe(100)
  })

  it('palauttaa null jos ei suunniteltu-merkkejä reitillä', () => {
    expect(distanceToNext([m3], 0, 'r1')).toBeNull()
  })

  it('etäisyys on absoluuttinen — toimii myös taaksepäin', () => {
    expect(distanceToNext([m1], 200, 'r1')).toBe(100)
  })

  it('nolla-etäisyys kun currentDist === merkin distanceFromStart', () => {
    expect(distanceToNext([m1], 100, 'r1')).toBe(0)
  })

  it('palauttaa null kun markers tyhjä', () => {
    expect(distanceToNext([], 0, 'r1')).toBeNull()
  })
})
