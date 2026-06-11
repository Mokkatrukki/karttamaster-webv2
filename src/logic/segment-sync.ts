import type { Segment } from './segments'

export interface SegmentSyncResult {
  segment: Segment
  source: 'server' | 'cache'
}

export async function fetchSegmentByCode(code: string): Promise<Segment | null> {
  try {
    const resp = await fetch(`/api/segments/by-code/${encodeURIComponent(code)}`)
    if (!resp.ok) return null
    return (await resp.json()) as Segment
  } catch {
    return null
  }
}

export async function pushSegment(seg: Segment): Promise<boolean> {
  try {
    const resp = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seg),
    })
    return resp.ok
  } catch {
    return false
  }
}

export async function updateSegmentRemote(id: string, patch: Partial<Segment>): Promise<boolean> {
  try {
    const resp = await fetch(`/api/segments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return resp.ok
  } catch {
    return false
  }
}

export async function deleteSegmentRemote(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/segments/${id}`, { method: 'DELETE' })
    return resp.ok
  } catch {
    return false
  }
}

export async function fetchAllSegments(): Promise<Segment[]> {
  try {
    const resp = await fetch('/api/segments')
    if (!resp.ok) return []
    return (await resp.json()) as Segment[]
  } catch {
    return []
  }
}
