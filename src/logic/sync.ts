import type { SignMarker, MarkerType, MarkerStatus } from './types'
import type { SignPart } from './sign-library'

interface ServerMarker {
  id: string
  type: string
  lat: number
  lon: number
  distance_from_start: number
  // T300/V212/B115: km per reitti. NULL/puuttuu = legacy → distanceForRoute fallbackaa.
  distance_by_route?: Record<string, number[]> | null
  // T392/V284: lähin reitti + kohtisuora etäisyys. NULL/puuttuu = backfill kesken → jäsenyys
  // ⊥ sovella reittisääntöä (entinen käytös).
  nearest_route_id?: string | null
  nearest_route_dist_m?: number | null
  route_ids: string[]
  status: string
  location_note: string | null
  color: string | null
  label: string | null
  icon_id: string | null
  image_id: string | null
  template_id: string | null
  parts_json: string | null
  // T423/V314: kasan sisältö. NULL = ei kasa (tai vioittunut JSON, serveri normalisoi).
  pile_marker_ids?: string[] | null
  description: string | null
  images: string[]
  created_by: string | null
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
    ...(row.distance_by_route ? { distanceByRoute: row.distance_by_route } : {}),
    ...(row.nearest_route_id != null ? { nearestRouteId: row.nearest_route_id } : {}),
    ...(row.nearest_route_dist_m != null ? { nearestRouteDistM: row.nearest_route_dist_m } : {}),
    routeIds: row.route_ids,
    status: row.status as MarkerStatus,
    ...(row.location_note != null ? { locationNote: row.location_note } : {}),
    ...(row.color != null ? { color: row.color } : {}),
    ...(row.label != null ? { label: row.label } : {}),
    ...(row.icon_id != null ? { iconId: row.icon_id } : {}),
    ...(row.image_id != null ? { imageId: row.image_id } : {}),
    ...(row.template_id != null ? { templateId: row.template_id } : {}),
    ...(parsePartsJson(row.parts_json) ? { parts: parsePartsJson(row.parts_json) } : {}),
    ...(row.pile_marker_ids != null ? { pileMarkerIds: row.pile_marker_ids } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.images && row.images.length > 0 ? { images: row.images } : {}),
    ...(row.created_by != null ? { createdBy: row.created_by } : {}),
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

/**
 * T392/V284: lähimmän reitin backfill-push — tarkoituksella outboxin OHI (B145-kuvio, sama
 * peruste kuin `pushSegmentTrack`). Arvo on JOHDETTU (lat/lon + GPX) ∴ epäonnistunut push
 * korjautuu itsestään seuraavalla latauksella; durabiliteetti ei ole sen arvoinen että
 * taustamigraatio saisi laukaista reauth-overlayn.
 */
export async function pushMarkerNearestRoute(id: string, routeId: string, distM: number): Promise<void> {
  try {
    await fetch(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nearest_route_id: routeId, nearest_route_dist_m: distM }),
    })
  } catch {
    // Verkkovirhe: seuraava lataus johtaa arvon uudelleen.
  }
}
