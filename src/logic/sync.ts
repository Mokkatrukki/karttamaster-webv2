import type { SignMarker, MarkerType, MarkerStatus } from './types'
import type { SignPart } from './sign-library'

interface ServerMarker {
  id: string
  type: string
  lat: number
  lon: number
  distance_from_start: number
  route_ids: string[]
  status: string
  location_note: string | null
  color: string | null
  label: string | null
  icon_id: string | null
  parts_json: string | null
  description: string | null
  images: string[]
}

// T172/V107: parts_json on greenfield-data — malformed sisältö ei saa kaataa fetchMarkersia (V14-pattern)
function parsePartsJson(raw: string | null): SignPart[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as SignPart[] : undefined
  } catch {
    return undefined
  }
}

function fromServer(row: ServerMarker): SignMarker {
  return {
    id: row.id,
    type: row.type as MarkerType,
    lat: row.lat,
    lon: row.lon,
    distanceFromStart: row.distance_from_start,
    routeIds: row.route_ids,
    status: row.status as MarkerStatus,
    ...(row.location_note != null ? { locationNote: row.location_note } : {}),
    ...(row.color != null ? { color: row.color } : {}),
    ...(row.label != null ? { label: row.label } : {}),
    ...(row.icon_id != null ? { iconId: row.icon_id } : {}),
    ...(parsePartsJson(row.parts_json) ? { parts: parsePartsJson(row.parts_json) } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.images && row.images.length > 0 ? { images: row.images } : {}),
  }
}

// T184/V118: erottele "0 merkkiä" ja "lataus epäonnistui". Hiljainen []-paluu
// piilotti verkko-/HTTP-virheen → tyhjä kartta luultiin todeksi → duplikaatit,
// ja re-fetch (GPKG-tuonti, role-view) ylikirjoitti olemassa olevat merkit tyhjällä.
export type MarkersResult =
  | { ok: true; markers: SignMarker[] }
  | { ok: false; error: 'http' | 'network' }

export async function fetchMarkers(): Promise<MarkersResult> {
  try {
    const res = await fetch('/api/markers')
    if (!res.ok) return { ok: false, error: 'http' }
    const rows = await res.json() as ServerMarker[]
    return { ok: true, markers: rows.map(fromServer) }
  } catch {
    return { ok: false, error: 'network' }
  }
}
