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

export async function createArea(area: AreaMarker): Promise<AreaMarker | null> {
  try {
    const res = await fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    })
    if (!res.ok) return null
    return await res.json() as AreaMarker
  } catch {
    return null
  }
}

export async function updateArea(area: AreaMarker): Promise<void> {
  try {
    await fetch(`/api/areas/${area.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    })
  } catch {
    // silent — overlay already updated in-memory
  }
}

export async function deleteArea(areaId: string): Promise<void> {
  try {
    await fetch(`/api/areas/${areaId}`, { method: 'DELETE' })
  } catch {
    // silent
  }
}
