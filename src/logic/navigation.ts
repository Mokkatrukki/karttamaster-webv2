import type { SignMarker } from './types'

// V3/V143 (B-lista2): pätkän ENSIMMÄINEN asettamaton merkki — pienin distanceFromStart jolla
// status==='suunniteltu'. Tämä on "Aseta seuraava" -ohjauksen valinta talkoolaiselle: se etenee
// pätkän merkit järjestyksessä alusta loppuun, EI lähimpään kursorin/GPS-sijainnin merkkiin.
// Anna `markers` valmiiksi pätkälle rajattuna (getMarkersForSegment) — funktio ei tunne pätkää.
export function firstUnsetMarker(markers: SignMarker[]): SignMarker | null {
  let best: SignMarker | null = null
  for (const m of markers) {
    if (m.status !== 'suunniteltu') continue
    if (best === null || m.distanceFromStart < best.distanceFromStart) best = m
  }
  return best
}

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
