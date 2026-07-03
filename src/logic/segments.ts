import type { SignMarker, MarkerStatus } from './types'

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

// T95: progress % = (asetettu+tarkistettu+kerätty) / all markers in segment
export function getSegmentProgress(segment: Segment, markers: SignMarker[]): number {
  const segMarkers = getMarkersForSegment(segment, markers)
  if (segMarkers.length === 0) return 0
  const done = segMarkers.filter(
    m => m.status === 'asetettu' || m.status === 'tarkistettu' || m.status === 'kerätty',
  ).length
  return Math.round((done / segMarkers.length) * 100)
}

// T141/V88: lukumäärä per status, kartan-alle-palkkia varten. Vain count>0 -statukset näytetään UI:ssa.
export function getSegmentStatusCounts(
  segment: Segment,
  markers: SignMarker[],
): Record<MarkerStatus, number> {
  const counts: Record<MarkerStatus, number> = {
    suunniteltu: 0,
    asetettu: 0,
    tarkistettu: 0,
    kerätty: 0,
    ei_tarpeen: 0,
  }
  for (const m of getMarkersForSegment(segment, markers)) {
    counts[m.status]++
  }
  return counts
}

// V49: overlap = startDist2 < endDist1 && startDist1 < endDist2. excludeId skips own segment on edit.
export function validateNoOverlap(
  store: SegmentStore,
  routeId: string,
  startDist: number,
  endDist: number,
  excludeId?: string,
): boolean {
  for (const seg of store.values()) {
    if (seg.id === excludeId) continue
    if (!seg.routeIds.includes(routeId)) continue
    if (startDist < seg.endDist && seg.startDist < endDist) return false
  }
  return true
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
