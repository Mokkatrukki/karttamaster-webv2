import L from 'leaflet'
import { nearestPointIndex } from '../logic/bearing'
import type { RoutePoint, SignMarker } from '../logic/types'
import type { Segment, SegmentStore, SegmentLineState } from '../logic/segments'
import { colorForSegment, segmentLineState, getPhaseProgress } from '../logic/segments'

interface RouteRef { id: string; routePoints: RoutePoint[] }

const GAP_COLOR = '#94a3b8'

// T152/V96: viivatyyli = status. Väri = tunniste (colorForSegment), tyyli näistä.
const LINE_STATE_STYLE: Record<SegmentLineState, { opacity: number; weight: number; dashArray?: string }> = {
  valmis:     { opacity: 0.9,  weight: 11 },              // ehjä
  kesken:     { opacity: 0.85, weight: 11, dashArray: '1 9' }, // täysi katko
  ei_alkanut: { opacity: 0.4,  weight: 9,  dashArray: '1 9' }, // haalea katko
}

export interface ContextLineStyle {
  opacity: number
  weight: number
  dashArray?: string
  interactive: boolean
}

// V142: talkoolaisen näkymässä oma tehtävä kirkas + klikattava, muut himmeä + read-only.
// Pure — Leaflet vain soveltaa. contextOwnId === undefined = järjestäjä (ei himmennystä).
// Testattavuus: Vitest-pure (oma → interactive täysi tyyli; muu → himmennetty non-interactive).
export const CONTEXT_DIM_OPACITY = 0.22
export function contextSegmentStyle(
  base: { opacity: number; weight: number; dashArray?: string },
  contextOwnId: string | undefined,
  segId: string,
): ContextLineStyle {
  const isOwn = contextOwnId === undefined || segId === contextOwnId
  if (isOwn) return { ...base, interactive: true }
  return {
    opacity: Math.min(base.opacity, CONTEXT_DIM_OPACITY),
    weight: Math.max(base.weight - 4, 5),
    dashArray: base.dashArray,
    interactive: false,
  }
}

export class SegmentOverlay {
  private layers: L.Layer[] = []
  private editMarkers: L.Marker[] = []
  private snapMarkers: L.CircleMarker[] = []
  private onSegmentClick?: (seg: Segment) => void
  private contextOwnId?: string

  constructor(
    private readonly map: L.Map,
    private readonly routes: RouteRef[],
  ) {}

  setOnSegmentClick(cb: (seg: Segment) => void): void {
    this.onSegmentClick = cb
  }

  // V142: talkoolaisen näkymä — oma tehtävä kirkas+klikattava, muut himmeä+read-only.
  // undefined = järjestäjä (kaikki kirkkaita, klikattavia). Kutsu ennen update():a.
  setContextOwn(ownId: string | undefined): void {
    this.contextOwnId = ownId
  }

  update(store: SegmentStore, markers: SignMarker[] = []): void {
    this.clear()
    const segments = Array.from(store.values())

    // Gray gaps (uncovered route sections)
    for (const route of this.routes) {
      const gaps = computeGapRanges(segments, route.id, route.routePoints)
      for (const [start, end] of gaps) {
        const pts = sliceRoutePoints(route.routePoints, start, end)
        if (pts.length >= 2) {
          this.layers.push(L.polyline(pts, { color: GAP_COLOR, weight: 8, opacity: 0.3 }).addTo(this.map))
        }
      }
    }

    // T152/V96: väri = tunniste (stabiili per id), viivatyyli = phase-status
    for (const seg of segments) {
      const color = colorForSegment(seg.id)
      const progress = getPhaseProgress(seg, markers)
      const state = segmentLineState(progress)
      // V142: himmennä muut tehtävät talkoolaisen näkymässä; oma säilyy kirkkaana.
      const style = contextSegmentStyle(LINE_STATE_STYLE[state], this.contextOwnId, seg.id)
      // tarkastus-vaiheen valmis-pätkä saa ✓ tooltipiin
      const labelSuffix = seg.phase === 'tarkastus' && state === 'valmis' ? ' ✓' : ''
      // V139: reititön tehtävä ei piirrä reitti-polylinea (T217 tuo oman render-haaran).
      if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
      const segStart = seg.startDist
      const segEnd = seg.endDist
      for (const routeId of seg.routeIds) {
        const route = this.routes.find(r => r.id === routeId)
        if (!route) continue
        const pts = sliceRoutePoints(route.routePoints, segStart, segEnd)
        if (pts.length < 2) continue
        const line = L.polyline(pts, {
          color, weight: style.weight, opacity: style.opacity,
          dashArray: style.dashArray, lineCap: 'round',
          // V142: muut tehtävät read-only — Leaflet ei kaappaa klikkiä (menee kartalle läpi).
          interactive: style.interactive,
        })
        if (seg.displayName) {
          line.bindTooltip(seg.displayName + labelSuffix, {
            permanent: true,
            className: style.interactive ? 'segment-label' : 'segment-label segment-label--dim',
            direction: 'center',
          })
        }
        if (this.onSegmentClick && style.interactive) {
          const clickedSeg = seg
          line.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            this.onSegmentClick!(clickedSeg)
          })
        }
        line.addTo(this.map)
        this.layers.push(line)
      }
    }
  }

  clear(): void {
    this.layers.forEach(l => l.remove())
    this.layers = []
  }

  isEditMode(): boolean {
    return this.editMarkers.length > 0
  }

  exitEditMode(): void {
    this.editMarkers.forEach(m => m.remove())
    this.editMarkers = []
  }

  showCreationSnapMarkers(
    store: SegmentStore,
    onSnap: (routeId: string, dist: number, lat: number, lon: number) => void,
  ): void {
    this.hideCreationSnapMarkers()
    for (const seg of store.values()) {
      if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
      const segStart = seg.startDist
      const segEnd = seg.endDist
      for (const routeId of seg.routeIds) {
        const route = this.routes.find(r => r.id === routeId)
        if (!route) continue
        for (const [dist, color] of [[segStart, '#f59e0b'], [segEnd, '#10b981']] as [number, string][]) {
          const pos = routePointAtDist(route.routePoints, dist)
          const m = L.circleMarker(pos, { radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2 })
          m.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            onSnap(routeId, dist, pos[0], pos[1])
          })
          m.addTo(this.map)
          this.snapMarkers.push(m)
        }
      }
    }
  }

  hideCreationSnapMarkers(): void {
    this.snapMarkers.forEach(m => m.remove())
    this.snapMarkers = []
  }

  // Place draggable start/end markers for the segment. onSave called on each snap.
  enterEditMode(seg: Segment, onSave: (startDist: number, endDist: number) => void): void {
    this.exitEditMode()
    // V139: reitittömällä tehtävällä ei raahattavia raja-merkkejä.
    if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) return
    const route = this.routes.find(r => seg.routeIds!.includes(r.id))
    if (!route) return

    let editStartDist = seg.startDist
    let editEndDist = seg.endDist

    const startPos = routePointAtDist(route.routePoints, seg.startDist)
    const endPos = routePointAtDist(route.routePoints, seg.endDist)

    const startIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--start', html: 'A', iconSize: [24, 24] })
    const endIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--end', html: 'B', iconSize: [24, 24] })

    const startMarker = L.marker(startPos, { draggable: true, icon: startIcon, title: 'Aloituspiste (raahaa)' })
    const endMarker = L.marker(endPos, { draggable: true, icon: endIcon, title: 'Lopetuspiste (raahaa)' })

    startMarker.on('dragend', () => {
      const { lat, lng } = startMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editStartDist = pt.distanceFromStart
      startMarker.setLatLng([pt.lat, pt.lon])
      if (editStartDist < editEndDist) onSave(editStartDist, editEndDist)
    })

    endMarker.on('dragend', () => {
      const { lat, lng } = endMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editEndDist = pt.distanceFromStart
      endMarker.setLatLng([pt.lat, pt.lon])
      if (editEndDist > editStartDist) onSave(editStartDist, editEndDist)
    })

    startMarker.addTo(this.map)
    endMarker.addTo(this.map)
    this.editMarkers = [startMarker, endMarker]
  }
}

function routePointAtDist(routePoints: RoutePoint[], dist: number): [number, number] {
  let closest = routePoints[0]
  let minDiff = Math.abs(routePoints[0].distanceFromStart - dist)
  for (const pt of routePoints) {
    const diff = Math.abs(pt.distanceFromStart - dist)
    if (diff < minDiff) {
      minDiff = diff
      closest = pt
    }
  }
  return [closest.lat, closest.lon]
}

function sliceRoutePoints(points: RoutePoint[], startDist: number, endDist: number): [number, number][] {
  return points
    .filter(p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist)
    .map(p => [p.lat, p.lon])
}

// V139: exportattu Taso-1-testausta varten — reitittömät tehtävät EIVÄT osallistu gap-laskentaan
// (niillä ei ole reittiä katettavaksi). Testataan että routeless-seg ei kaada eikä vääristä gappeja.
export function computeGapRanges(segments: Segment[], routeId: string, routePoints: RoutePoint[]): [number, number][] {
  const totalEnd = routePoints[routePoints.length - 1]?.distanceFromStart ?? 0
  const covered = segments
    .filter((s): s is Segment & { startDist: number; endDist: number } =>
      !!s.routeIds && s.routeIds.includes(routeId) && s.startDist !== undefined && s.endDist !== undefined)
    .map(s => [s.startDist, s.endDist] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const gaps: [number, number][] = []
  let pos = 0
  for (const [start, end] of covered) {
    if (start > pos) gaps.push([pos, start])
    pos = Math.max(pos, end)
  }
  if (pos < totalEnd) gaps.push([pos, totalEnd])
  return gaps
}
