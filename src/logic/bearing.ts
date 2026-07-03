import type { RoutePoint } from './types'

export function haversineDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const a2 = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2))
}

/** Build RoutePoints with cumulative distance from raw lat/lon array */
export function buildRoutePoints(coords: Array<{ lat: number; lon: number }>): RoutePoint[] {
  const points: RoutePoint[] = []
  let dist = 0
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) dist += haversineDistance(coords[i - 1], coords[i])
    points.push({ lat: coords[i].lat, lon: coords[i].lon, distanceFromStart: dist })
  }
  return points
}

/** Find nearest RoutePoint index to given lat/lon */
export function nearestPointIndex(points: RoutePoint[], lat: number, lon: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = haversineDistance(points[i], { lat, lon })
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

/** Position of a distance along a route as percentage 0–100 */
export function routePositionPct(distanceFromStart: number, totalDistance: number): number {
  if (totalDistance <= 0) return 0
  return Math.min(100, Math.max(0, (distanceFromStart / totalDistance) * 100))
}
