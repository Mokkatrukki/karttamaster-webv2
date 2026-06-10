import type { SignMarker, MarkerType, MarkerStatus } from './types'
import { loadMarkers, saveMarkers } from './persistence'

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
}

function fromServer(row: ServerMarker): SignMarker {
  return {
    id: row.id,
    type: row.type as MarkerType,
    lat: row.lat,
    lon: row.lon,
    bearing: row.bearing,
    distanceFromStart: row.distance_from_start,
    routeIds: row.route_ids,
    status: row.status as MarkerStatus,
    ...(row.location_note != null ? { locationNote: row.location_note } : {}),
  }
}

export type SyncErrorReason = 'map_not_ready' | 'auth_required' | 'unknown'

export class SyncError extends Error {
  constructor(public reason: SyncErrorReason, message?: string) {
    super(message ?? reason)
    this.name = 'SyncError'
  }
}

// V18: server first — localStorage fallback only on network failure
export async function syncMarkers(): Promise<SignMarker[]> {
  let res: Response
  try {
    res = await fetch('/api/markers')
  } catch {
    return loadMarkers()
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new SyncError('map_not_ready', String(body.error ?? 'map_not_ready'))
  }
  if (res.status === 401) {
    throw new SyncError('auth_required')
  }
  if (!res.ok) {
    return loadMarkers()
  }

  const rows = await res.json() as ServerMarker[]
  const markers = rows.map(fromServer)
  saveMarkers(markers)
  return markers
}

// V19: send pendingSync markers to server before other operations
export async function pushPending(): Promise<void> {
  const markers = loadMarkers()
  const pending = markers.filter((m) => m.pendingSync)
  if (pending.length === 0) return

  const results = await Promise.allSettled(
    pending.map(async (m) => {
      const res = await fetch(`/api/markers/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: m.status,
          ...(m.locationNote !== undefined ? { location_note: m.locationNote } : {}),
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      return m.id
    }),
  )

  const succeeded = new Set(
    results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value),
  )

  if (succeeded.size > 0) {
    const updated = markers.map((m) =>
      succeeded.has(m.id) ? { ...m, pendingSync: undefined } : m,
    )
    saveMarkers(updated)
  }
}
