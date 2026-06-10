import L from 'leaflet'
import type { RoutePoint } from '../logic/types'
import type { Segment, SegmentStore } from '../logic/segments'

interface RouteRef { id: string; routePoints: RoutePoint[] }

// DESIGN.md §K SegmentOverlay
const SEGMENT_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444']
const GAP_COLOR = '#94a3b8'

export class SegmentOverlay {
  private layers: L.Layer[] = []

  constructor(
    private readonly map: L.Map,
    private readonly routes: RouteRef[],
  ) {}

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
        line.addTo(this.map)
        this.layers.push(line)
      }
    })
  }

  clear(): void {
    this.layers.forEach(l => l.remove())
    this.layers = []
  }
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
