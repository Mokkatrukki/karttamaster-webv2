import type { SignMarker } from './types'

export interface EquipmentItem {
  name: string
  count: number
}

export interface Segment {
  id: string
  routeIds: string[]
  startDist: number
  endDist: number
  assignedCode?: string
  displayName?: string
  description?: string
  equipment: EquipmentItem[]
  phase: 'asettaminen' | 'purku'
}

export type SegmentStore = Map<string, Segment>

export function createSegmentStore(): SegmentStore {
  return new Map()
}

// V11: startDist must be < endDist (continuous range). V25: routeIds non-empty.
export function createSegment(
  store: SegmentStore,
  data: Omit<Segment, 'id'>,
  id?: string,
): Segment {
  if (data.startDist >= data.endDist) {
    throw new Error(`V11: startDist (${data.startDist}) must be < endDist (${data.endDist})`)
  }
  if (data.routeIds.length === 0) {
    throw new Error('V25: routeIds must not be empty')
  }
  const segment: Segment = { id: id ?? crypto.randomUUID(), ...data }
  store.set(segment.id, segment)
  return segment
}

export function updateSegment(
  store: SegmentStore,
  id: string,
  patch: Partial<Omit<Segment, 'id'>>,
): Segment | null {
  const existing = store.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch }
  if (updated.startDist >= updated.endDist) {
    throw new Error(`V11: startDist (${updated.startDist}) must be < endDist (${updated.endDist})`)
  }
  if (updated.routeIds.length === 0) {
    throw new Error('V25: routeIds must not be empty')
  }
  store.set(id, updated)
  return updated
}

export function deleteSegment(store: SegmentStore, id: string): boolean {
  return store.delete(id)
}

export function getSegmentsForPhase(
  store: SegmentStore,
  phase: Segment['phase'],
): Segment[] {
  return Array.from(store.values()).filter(s => s.phase === phase)
}

export function getSegmentForCode(
  store: SegmentStore,
  code: string,
): Segment | undefined {
  const upper = code.toUpperCase()
  return Array.from(store.values()).find(s => s.assignedCode?.toUpperCase() === upper)
}

// V25: include marker if routeIds intersects AND distanceFromStart in [startDist, endDist].
// Deduplication is implicit — each marker id is unique.
export function getMarkersForSegment(
  segment: Segment,
  markers: SignMarker[],
): SignMarker[] {
  const routeSet = new Set(segment.routeIds)
  return markers.filter(
    m =>
      m.routeIds.some(r => routeSet.has(r)) &&
      m.distanceFromStart >= segment.startDist &&
      m.distanceFromStart <= segment.endDist,
  )
}
