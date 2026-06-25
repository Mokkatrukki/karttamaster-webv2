import type { AreaMarker } from './area-types'

export async function fetchAreas(): Promise<AreaMarker[]> {
  try {
    const res = await fetch('/api/areas')
    if (!res.ok) return []
    const data = await res.json() as AreaMarker[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
