import { describe, it, expect } from 'vitest'
import { ensureRouteIds, FAR_FROM_ROUTE_M } from '../src/logic/marker-assign'

describe('T44 — V21: ensureRouteIds', () => {
  it('returns routeIds as-is when non-empty', () => {
    expect(ensureRouteIds(['35km', '55km'], '35km')).toEqual(['35km', '55km'])
  })

  it('returns [fallbackId] when routeIds is empty', () => {
    expect(ensureRouteIds([], '35km')).toEqual(['35km'])
  })

  it('returns [fallbackId] when routeIds is empty — other route', () => {
    expect(ensureRouteIds([], '55km')).toEqual(['55km'])
  })

  it('single route in list — returned as-is', () => {
    expect(ensureRouteIds(['55km'], '35km')).toEqual(['55km'])
  })

  it('FAR_FROM_ROUTE_M threshold is 500', () => {
    expect(FAR_FROM_ROUTE_M).toBe(500)
  })
})
