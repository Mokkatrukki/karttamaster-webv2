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
  phase: 'asettaminen' | 'tarkastus' | 'purku'
  inspected?: boolean
  inspectionNote?: string
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

// T146/V91: lookup, ei if-ketju — uusi phase helppo lisätä. purku→asettaminen kiertää ympäri
// (järjestäjä voi kloonata takaisin seuraavan tapahtuman asetusvaihetta varten).
export const NEXT_PHASE: Record<Segment['phase'], Segment['phase']> = {
  asettaminen: 'tarkastus',
  tarkastus: 'purku',
  purku: 'asettaminen',
}

// T146: korjaa UI-aukon — ei ollut mitään tapaa luoda tarkastus/purku-vaiheen pätkäjakoa.
// Kopioi routeIds/startDist/endDist/displayName, TYHJÄ assignedCode/equipment/description
// (V26: eri talkoolainen eri vaiheessa, ei peri edellisen koodia). Vanha segmentti koskematon.
// T151/V95: validoi kohde-phasen overlap ennen luontia — duplikaattiklooni (tuplaklikki) → null.
export function cloneSegmentToNextPhase(store: SegmentStore, segment: Segment): Segment | null {
  const targetPhase = NEXT_PHASE[segment.phase]
  for (const routeId of segment.routeIds) {
    if (!validateNoOverlap(store, routeId, segment.startDist, segment.endDist, targetPhase)) {
      return null
    }
  }
  return createSegment(store, {
    routeIds: [...segment.routeIds],
    startDist: segment.startDist,
    endDist: segment.endDist,
    displayName: segment.displayName,
    equipment: [],
    phase: targetPhase,
  })
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

// T141/B61/V88: lukumäärä per status, pätkäjako-listan riville. Vain count>0 -statukset näytetään UI:ssa.
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

const STATUS_COUNT_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'suunniteltu',
  asetettu: 'asetettu',
  tarkistettu: 'tarkistettu',
  kerätty: 'kerätty',
  ei_tarpeen: 'ei tarpeen',
}

export function formatStatusCounts(counts: Record<MarkerStatus, number>): string {
  const parts = (Object.keys(STATUS_COUNT_LABELS) as MarkerStatus[])
    .filter(status => counts[status] > 0)
    .map(status => `${counts[status]} ${STATUS_COUNT_LABELS[status]}`)
  return parts.length > 0 ? parts.join(' · ') : 'ei merkkejä'
}

// T143/V90: yksi phase-tietoinen luku täyden breakdownin sijaan — mahtuu ahtaaseen sivupalkkiriviin.
// Lookup-taulu (ei if-ketju) jotta uudet phaset on helppo lisätä.
const COUNT_PHASE_TARGET: Record<'asettaminen' | 'purku', { label: string; doneStatuses: MarkerStatus[] }> = {
  asettaminen: { label: 'asetettu', doneStatuses: ['asetettu', 'tarkistettu', 'kerätty'] },
  purku: { label: 'kerätty', doneStatuses: ['kerätty'] },
}

// T144/V91: tarkastus-phase ei laske per-merkki-statusta (ei ole marker-tason "tarkastettu"-statusta,
// ks. V92) — segmentin oma inspected-boolean sen sijaan. Discriminated union ettei count-muoto valehtele.
export type PhaseProgress =
  | { kind: 'count'; done: number; total: number; label: string }
  | { kind: 'boolean'; done: boolean; label: string }

export function getPhaseProgress(segment: Segment, markers: SignMarker[]): PhaseProgress {
  if (segment.phase === 'tarkastus') {
    return { kind: 'boolean', done: segment.inspected ?? false, label: 'tarkastettu' }
  }
  const segMarkers = getMarkersForSegment(segment, markers)
  const target = COUNT_PHASE_TARGET[segment.phase]
  const done = segMarkers.filter(m => target.doneStatuses.includes(m.status)).length
  return { kind: 'count', done, total: segMarkers.length, label: target.label }
}

export function formatPhaseProgress(progress: PhaseProgress): string {
  if (progress.kind === 'boolean') {
    return progress.done ? `${progress.label} ✓` : `ei vielä ${progress.label}`
  }
  if (progress.total === 0) return 'ei merkkejä'
  return `${progress.done}/${progress.total} ${progress.label}`
}

// T152/V96: pätkän tunnistehue stabiili per id (⊥ lista-indeksi — poisto ei siirrä muiden värejä).
// Paletti EI sisällä route-värejä (main.ts ROUTE_DEFS #f59e0b/#8b5cf6, DESIGN.md §K).
export const SEGMENT_COLORS = ['#10b981', '#ec4899', '#3b82f6', '#ef4444', '#06b6d4', '#64748b']

export function colorForSegment(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return SEGMENT_COLORS[Math.abs(hash) % SEGMENT_COLORS.length]
}

// T152/V96: viivatyyli kartalla kertoo statuksen — kolme ämpäriä getPhaseProgress-tuloksesta.
// ei_alkanut = haalea katko, kesken = täysi katko, valmis = ehjä.
export type SegmentLineState = 'ei_alkanut' | 'kesken' | 'valmis'

export function segmentLineState(progress: PhaseProgress): SegmentLineState {
  if (progress.kind === 'boolean') {
    return progress.done ? 'valmis' : 'ei_alkanut'
  }
  if (progress.total === 0 || progress.done === 0) return 'ei_alkanut'
  if (progress.done >= progress.total) return 'valmis'
  return 'kesken'
}

// V49/V95: overlap = startDist2 < endDist1 && startDist1 < endDist2, vain saman phasen sisällä
// (eri vaiheiden pätkät saavat olla päällekkäin, V91). excludeId skips own segment on edit.
export function validateNoOverlap(
  store: SegmentStore,
  routeId: string,
  startDist: number,
  endDist: number,
  phase: Segment['phase'],
  excludeId?: string,
): boolean {
  for (const seg of store.values()) {
    if (seg.id === excludeId) continue
    if (seg.phase !== phase) continue
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
