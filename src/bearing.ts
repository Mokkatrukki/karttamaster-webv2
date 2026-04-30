import type { RoutePoint } from './types'

export function calcBearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const dLon = toRad(to.lon - from.lon)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

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

/** Bearing at a route point (average of prev→point and point→next) */
export function bearingAtIndex(points: RoutePoint[], index: number): number {
  if (points.length < 2) return 0
  if (index === 0) return calcBearing(points[0], points[1])
  if (index >= points.length - 1) return calcBearing(points[points.length - 2], points[points.length - 1])
  const b1 = calcBearing(points[index - 1], points[index])
  const b2 = calcBearing(points[index], points[index + 1])
  // circular average
  const avg = Math.atan2(
    (Math.sin((b1 * Math.PI) / 180) + Math.sin((b2 * Math.PI) / 180)) / 2,
    (Math.cos((b1 * Math.PI) / 180) + Math.cos((b2 * Math.PI) / 180)) / 2,
  )
  return ((avg * 180) / Math.PI + 360) % 360
}
