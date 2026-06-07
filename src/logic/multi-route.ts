import type { RoutePoint } from './types'
import { haversineDistance, nearestPointIndex } from './bearing'

export interface RouteConfig {
  id: string
  label: string
  color: string
  file: string
  routePoints: RoutePoint[]
}

export const SHARED_THRESHOLD_M = 100

export function assignRoutesToMarker(
  lat: number,
  lon: number,
  routes: Array<{ id: string; routePoints: RoutePoint[] }>,
  threshold = SHARED_THRESHOLD_M,
): string[] {
  return routes
    .filter((r) => {
      if (r.routePoints.length === 0) return false
      const idx = nearestPointIndex(r.routePoints, lat, lon)
      const dist = haversineDistance(r.routePoints[idx], { lat, lon })
      return dist <= threshold
    })
    .map((r) => r.id)
}
