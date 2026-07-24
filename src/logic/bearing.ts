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

/** Kompassisuunta a→b asteina (0 = pohjoinen, kasvaa myötäpäivään). */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const φ1 = toRad(a.lat)
  const φ2 = toRad(b.lat)
  const Δλ = toRad(b.lon - a.lon)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * T286: suuntanuolten sijainnit reitin varrella — yksi nuoli joka `spacingM` metri.
 * Kiinteä väli → tasainen tiheys/km riippumatta reitin pituudesta (lyhyt ja pitkä reitti
 * näyttävät samalta zoomattaessa). Nuolet paljastetaan vasta lähizoomissa (main.ts), joten
 * kiinteä tiheä väli ei sotke yleiskuvaa. `maxArrows` = turvakatto.
 */
export function directionArrowPlacements(
  points: RoutePoint[],
  spacingM = 800,
  maxArrows = 500,
): Array<{ lat: number; lon: number; bearing: number }> {
  if (points.length < 2 || spacingM <= 0) return []
  const total = points[points.length - 1].distanceFromStart
  if (total <= 0) return []
  const out: Array<{ lat: number; lon: number; bearing: number }> = []
  let next = spacingM
  for (let i = 1; i < points.length && out.length < maxArrows; i++) {
    if (points[i].distanceFromStart >= next) {
      out.push({
        lat: points[i].lat,
        lon: points[i].lon,
        bearing: bearingDeg(points[i - 1], points[i]),
      })
      next += spacingM
    }
  }
  return out
}
