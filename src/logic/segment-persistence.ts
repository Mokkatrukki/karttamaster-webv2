import type { Segment, SegmentStore } from './segments'

const LS_KEY = 'karttamaster-segments'

interface PersistedSegments {
  version: number
  segments: Segment[]
}

export function saveSegments(store: SegmentStore): void {
  const data: PersistedSegments = { version: 1, segments: Array.from(store.values()) }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — skip silently
  }
}

export function loadSegments(): SegmentStore {
  const store: SegmentStore = new Map()
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return store
    const parsed = JSON.parse(raw) as PersistedSegments
    if (parsed.version !== 1 || !Array.isArray(parsed.segments)) {
      console.warn('[segment-persistence] corrupt data — resetting')
      localStorage.removeItem(LS_KEY)
      return store
    }
    for (const seg of parsed.segments) {
      if (
        typeof seg.id === 'string' &&
        Array.isArray(seg.routeIds) &&
        seg.routeIds.length > 0 &&
        typeof seg.startDist === 'number' &&
        typeof seg.endDist === 'number' &&
        seg.startDist < seg.endDist
      ) {
        store.set(seg.id, seg)
      }
    }
  } catch {
    // V14: parse error → silent reset
    console.warn('[segment-persistence] parse error — resetting')
    localStorage.removeItem(LS_KEY)
  }
  return store
}
