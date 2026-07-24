import { describe, it, expect } from 'vitest'
import { calcRouteStatus, calcAllRouteStatus } from '../src/logic/route-status'
import type { SignMarker } from '../src/logic/types'

function marker(id: string, status: SignMarker['status'], routeIds: string[]): SignMarker {
  return { id, type: 'right', lat: 0, lon: 0, distanceFromStart: 0, routeIds, status }
}

describe('calcRouteStatus', () => {
  it('returns 0% completion when no markers', () => {
    const result = calcRouteStatus([], 'smtb-30')
    expect(result.total).toBe(0)
    expect(result.completionPercent).toBe(0)
  })

  it('V9: all suunniteltu → 0% completion', () => {
    const markers = [
      marker('a', 'suunniteltu', ['smtb-30']),
      marker('b', 'suunniteltu', ['smtb-30']),
    ]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.total).toBe(2)
    expect(result.completionPercent).toBe(0)
    expect(result.byStatus.suunniteltu).toBe(2)
  })

  it('V9: mixed statuses — completion = non-suunniteltu / total', () => {
    const markers = [
      marker('a', 'suunniteltu', ['smtb-30']),
      marker('b', 'asetettu', ['smtb-30']),
      marker('c', 'tarkistettu', ['smtb-30']),
      marker('d', 'kerätty', ['smtb-30']),
    ]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.total).toBe(4)
    expect(result.completionPercent).toBe(75) // 3/4
    expect(result.byStatus.asetettu).toBe(1)
    expect(result.byStatus.tarkistettu).toBe(1)
    expect(result.byStatus.kerätty).toBe(1)
  })

  it('V9: ei_tarpeen counts as done', () => {
    const markers = [
      marker('a', 'ei_tarpeen', ['smtb-30']),
      marker('b', 'suunniteltu', ['smtb-30']),
    ]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.completionPercent).toBe(50)
    expect(result.byStatus.ei_tarpeen).toBe(1)
  })

  it('filters by routeId — ignores markers on other routes', () => {
    const markers = [
      marker('a', 'asetettu', ['smtb-30']),
      marker('b', 'suunniteltu', ['smtb-55']),
    ]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.total).toBe(1)
    expect(result.completionPercent).toBe(100)
  })

  it('multi-route marker counted for each route it belongs to', () => {
    const m = marker('shared', 'asetettu', ['smtb-30', 'smtb-55'])
    expect(calcRouteStatus([m], 'smtb-30').total).toBe(1)
    expect(calcRouteStatus([m], 'smtb-55').total).toBe(1)
  })

  it('100% when all markers are terminal statuses', () => {
    const markers = [
      marker('a', 'kerätty', ['smtb-30']),
      marker('b', 'ei_tarpeen', ['smtb-30']),
    ]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.completionPercent).toBe(100)
  })

  it('byStatus has zero counts for missing statuses', () => {
    const markers = [marker('a', 'asetettu', ['smtb-30'])]
    const result = calcRouteStatus(markers, 'smtb-30')
    expect(result.byStatus.suunniteltu).toBe(0)
    expect(result.byStatus.tarkistettu).toBe(0)
    expect(result.byStatus.kerätty).toBe(0)
  })
})

describe('calcAllRouteStatus', () => {
  it('returns summary for each routeId', () => {
    const markers = [
      marker('a', 'asetettu', ['smtb-30']),
      marker('b', 'suunniteltu', ['smtb-55']),
    ]
    const results = calcAllRouteStatus(markers, ['smtb-30', 'smtb-55'])
    expect(results).toHaveLength(2)
    expect(results[0].routeId).toBe('smtb-30')
    expect(results[0].completionPercent).toBe(100)
    expect(results[1].routeId).toBe('smtb-55')
    expect(results[1].completionPercent).toBe(0)
  })

  it('empty routeIds → empty array', () => {
    expect(calcAllRouteStatus([], [])).toEqual([])
  })
})
