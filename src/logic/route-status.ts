import type { SignMarker, MarkerStatus } from './types'

export interface RouteStatusSummary {
  routeId: string
  total: number
  byStatus: Record<MarkerStatus, number>
  completionPercent: number  // (non-suunniteltu) / total * 100, or 100 if total=0
}

const ALL_STATUSES: MarkerStatus[] = ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen']

export function calcRouteStatus(markers: SignMarker[], routeId: string): RouteStatusSummary {
  const routeMarkers = markers.filter(m => m.routeIds.includes(routeId))
  const total = routeMarkers.length

  const byStatus = Object.fromEntries(ALL_STATUSES.map(s => [s, 0])) as Record<MarkerStatus, number>
  for (const m of routeMarkers) {
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1
  }

  const done = total - byStatus['suunniteltu']
  const completionPercent = total === 0 ? 100 : Math.round((done / total) * 100)

  return { routeId, total, byStatus, completionPercent }
}

export function calcAllRouteStatus(markers: SignMarker[], routeIds: string[]): RouteStatusSummary[] {
  return routeIds.map(id => calcRouteStatus(markers, id))
}
