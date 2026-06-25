import type { SignMarker, MarkerType, MarkerStatus } from './types'

interface ServerMarker {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  distance_from_start: number
  route_ids: string[]
  status: string
  location_note: string | null
  color: string | null
  short_label: string | null
  bearing_manual: number
}

function fromServer(row: ServerMarker): SignMarker {
  return {
    id: row.id,
    type: row.type as MarkerType,
    lat: row.lat,
    lon: row.lon,
    bearing: row.bearing,
    bearingManual: row.bearing_manual === 1,
    distanceFromStart: row.distance_from_start,
    routeIds: row.route_ids,
    status: row.status as MarkerStatus,
    ...(row.location_note != null ? { locationNote: row.location_note } : {}),
    ...(row.color != null ? { color: row.color } : {}),
    ...(row.short_label != null ? { shortLabel: row.short_label } : {}),
  }
}

export async function fetchMarkers(): Promise<SignMarker[]> {
  try {
    const res = await fetch('/api/markers')
    if (!res.ok) return []
    const rows = await res.json() as ServerMarker[]
    return rows.map(fromServer)
  } catch {
    return []
  }
}
