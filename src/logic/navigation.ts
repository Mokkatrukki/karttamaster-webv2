import type { SignMarker } from './types'

export function nearestUnsetMarker(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): SignMarker | null {
  const candidates = markers.filter(
    (m) => m.status === 'suunniteltu' && m.routeIds.includes(routeId),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, m) =>
    Math.abs(m.distanceFromStart - currentDist) < Math.abs(best.distanceFromStart - currentDist)
      ? m
      : best,
  )
}

export function distanceToNext(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): number | null {
  const nearest = nearestUnsetMarker(markers, currentDist, routeId)
  if (!nearest) return null
  return Math.abs(nearest.distanceFromStart - currentDist)
}
