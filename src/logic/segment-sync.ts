import type { Segment } from './segments'
import { outbox } from './outbox-instance'

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

// T183/V116: pätkäkirjoitukset durable-outboxin kautta. Palautettu boolean =
// välittömän yrityksen tulos (kutsujan V35/V93-banneri toimii ennallaan), mutta
// epäonnistunut kirjoitus jää jonoon retryä varten — ei katoa sivun päivityksellä.
export async function pushSegment(seg: Segment): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'segment:' + seg.id,
    method: 'POST',
    url: '/api/segments',
    body: JSON.stringify(seg),
  })
  return delivered
}

export async function updateSegmentRemote(id: string, patch: Partial<Segment>): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'segment:' + id,
    method: 'PUT',
    url: `/api/segments/${id}`,
    body: JSON.stringify(patch),
  })
  return delivered
}

export async function deleteSegmentRemote(id: string): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'segment:' + id,
    method: 'DELETE',
    url: `/api/segments/${id}`,
  })
  return delivered
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
