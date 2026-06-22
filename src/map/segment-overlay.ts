import L from 'leaflet'
import { nearestPointIndex } from '../logic/bearing'
import type { RoutePoint } from '../logic/types'
import type { Segment, SegmentStore } from '../logic/segments'

interface RouteRef { id: string; routePoints: RoutePoint[] }

// DESIGN.md §K SegmentOverlay
const SEGMENT_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444']
const GAP_COLOR = '#94a3b8'

export class SegmentOverlay {
  private layers: L.Layer[] = []
  private editMarkers: L.Marker[] = []
  private snapMarkers: L.CircleMarker[] = []
  private onSegmentClick?: (seg: Segment) => void

  constructor(
    private readonly map: L.Map,
    private readonly routes: RouteRef[],
  ) {}

  setOnSegmentClick(cb: (seg: Segment) => void): void {
    this.onSegmentClick = cb
  }

  update(store: SegmentStore): void {
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

    // Colored segment stripes on top
    segments.forEach((seg, idx) => {
      const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
      for (const routeId of seg.routeIds) {
        const route = this.routes.find(r => r.id === routeId)
        if (!route) continue
        const pts = sliceRoutePoints(route.routePoints, seg.startDist, seg.endDist)
        if (pts.length < 2) continue
        const line = L.polyline(pts, { color, weight: 8, opacity: 0.7 })
        if (seg.displayName) {
          line.bindTooltip(seg.displayName, { permanent: true, className: 'segment-label', direction: 'center' })
        }
        if (this.onSegmentClick) {
          const clickedSeg = seg
          line.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            this.onSegmentClick!(clickedSeg)
          })
        }
        line.addTo(this.map)
        this.layers.push(line)
      }
    })
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
      for (const routeId of seg.routeIds) {
        const route = this.routes.find(r => r.id === routeId)
        if (!route) continue
        for (const [dist, color] of [[seg.startDist, '#f59e0b'], [seg.endDist, '#10b981']] as [number, string][]) {
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
    const route = this.routes.find(r => seg.routeIds.includes(r.id))
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

function computeGapRanges(segments: Segment[], routeId: string, routePoints: RoutePoint[]): [number, number][] {
  const totalEnd = routePoints[routePoints.length - 1]?.distanceFromStart ?? 0
  const covered = segments
    .filter(s => s.routeIds.includes(routeId))
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
