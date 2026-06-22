import L from 'leaflet'
import type { SignMarker, MarkerType, RoutePoint } from '../logic/types'
import { nearestPointIndex, bearingAtIndex, haversineDistance } from '../logic/bearing'
import { createSignIcon } from './icons'
import { assignRoutesToMarker } from '../logic/multi-route'
import { ensureRouteIds, FAR_FROM_ROUTE_M } from '../logic/marker-assign'
import { MarkerInteraction } from './marker-interaction'
import { DEFAULT_STATUS, transitionStatus } from '../logic/marker-status'
import type { StatusAction } from '../logic/marker-status'
import type { MarkerStatus } from '../logic/types'

interface RouteRef { id: string; routePoints: RoutePoint[] }

export class MarkerManager {
  private markers: SignMarker[] = []
  private leafletMarkers = new Map<string, L.Marker>()
  private map: L.Map
  private routes: RouteRef[]
  private visibleRouteIds: string[]
  private onUpdate: () => void
  private onFarFromRoute?: (distM: number) => void
  private interaction: MarkerInteraction

  constructor(map: L.Map, routes: RouteRef[], onUpdate: () => void, initialMarkers: SignMarker[] = [], onFarFromRoute?: (distM: number) => void) {
    this.map = map
    this.routes = routes
    this.visibleRouteIds = routes.map((r) => r.id)
    this.onUpdate = onUpdate
    this.onFarFromRoute = onFarFromRoute
    this.markers = initialMarkers
    this.interaction = new MarkerInteraction(
      map,
      this.leafletMarkers,
      (id) => this.markers.find((x) => x.id === id),
      (id) => this.remove(id),
      (id) => this.saveBearing(id),
      onUpdate,
      (armedId) => this.updateDragStates(armedId),
    )
    initialMarkers.forEach((m) => {
      if (m.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
        this.addLeafletMarker(m)
      }
    })
  }

  private apiPost(marker: SignMarker): void {
    fetch('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: marker.id,
        type: marker.type,
        lat: marker.lat,
        lon: marker.lon,
        bearing: marker.bearing,
        distance_from_start: marker.distanceFromStart,
        route_ids: marker.routeIds,
        status: marker.status,
        location_note: marker.locationNote ?? null,
        color: marker.color ?? null,
        short_label: marker.shortLabel ?? null,
      }),
    }).catch(() => {})
  }

  private apiPut(id: string, patch: Record<string, unknown>): void {
    fetch(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }

  private apiDelete(id: string): void {
    fetch(`/api/markers/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  private saveBearing(id: string): void {
    const m = this.markers.find(x => x.id === id)
    if (m) this.apiPut(m.id, { bearing: m.bearing })
  }

  private updateDragStates(armedId: string | null): void {
    this.leafletMarkers.forEach((lm, id) => {
      if (id === armedId) {
        lm.dragging?.disable()
      } else {
        lm.dragging?.enable()
      }
    })
  }

  add(lat: number, lon: number, type: MarkerType, color?: string, shortLabel?: string): SignMarker {
    let bestIdx = 0, bestRouteIdx = 0, bestDist = Infinity
    this.routes.forEach((r, ri) => {
      const idx = nearestPointIndex(r.routePoints, lat, lon)
      const dist = haversineDistance(r.routePoints[idx], { lat, lon })
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; bestRouteIdx = ri }
    })
    const primaryRoute = this.routes[bestRouteIdx]
    const bearing = bearingAtIndex(primaryRoute.routePoints, bestIdx)
    const point = primaryRoute.routePoints[bestIdx]
    const rawRouteIds = assignRoutesToMarker(lat, lon, this.routes)
    const routeIds = ensureRouteIds(rawRouteIds, primaryRoute.id)
    if (bestDist > FAR_FROM_ROUTE_M) this.onFarFromRoute?.(bestDist)

    const marker: SignMarker = {
      id: crypto.randomUUID(),
      type, lat, lon, bearing,
      distanceFromStart: point.distanceFromStart,
      routeIds,
      status: DEFAULT_STATUS,
      bearingManual: false,
      ...(color ? { color } : {}),
      ...(shortLabel ? { shortLabel } : {}),
    }
    this.markers.push(marker)
    this.apiPost(marker)

    if (marker.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
      this.addLeafletMarker(marker)
    }
    this.onUpdate()
    this.interaction.arm(marker.id)
    return marker
  }

  remove(id: string): void {
    if (this.interaction.armedId === id) this.interaction.disarm()
    const lm = this.leafletMarkers.get(id)
    if (lm) { lm.remove(); this.leafletMarkers.delete(id) }
    this.markers = this.markers.filter((m) => m.id !== id)
    this.apiDelete(id)
    this.onUpdate()
  }

  updateBearing(id: string, bearing: number): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.bearing = bearing
    m.bearingManual = true
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, bearing, m.status, m.color, m.shortLabel))
  }

  /** Returns markers visible under current visibleRouteIds, sorted by distanceFromStart */
  getAll(): SignMarker[] {
    return this.markers
      .filter((m) => m.routeIds.some((id) => this.visibleRouteIds.includes(id)))
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
  }

  /** Returns all markers assigned to a specific route, regardless of visibility */
  getForRoute(routeId: string): SignMarker[] {
    return this.markers
      .filter((m) => m.routeIds.includes(routeId))
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
  }

  setVisibleRoutes(ids: string[]): void {
    this.visibleRouteIds = ids
    this.markers.forEach((m) => {
      const visible = m.routeIds.some((id) => ids.includes(id))
      const lm = this.leafletMarkers.get(m.id)
      if (visible && !lm) {
        this.addLeafletMarker(m)
      } else if (!visible && lm) {
        lm.remove()
        this.leafletMarkers.delete(m.id)
      }
    })
    this.onUpdate()
  }

  panTo(id: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (m) this.map.setView([m.lat, m.lon], this.map.getZoom())
  }

  updateStatus(id: string, action: StatusAction): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.status = transitionStatus(m.status, action)
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, m.bearing, m.status, m.color, m.shortLabel))
    this.apiPut(id, { status: m.status })
    this.onUpdate()
  }

  bulkSetStatus(ids: string[], status: MarkerStatus): void {
    ids.forEach((id) => {
      const m = this.markers.find((x) => x.id === id)
      if (!m) return
      m.status = status
      const lm = this.leafletMarkers.get(id)
      if (lm) lm.setIcon(createSignIcon(m.type, m.bearing, m.status, m.color, m.shortLabel))
      this.apiPut(id, { status })
    })
    if (ids.length > 0) this.onUpdate()
  }

  updateType(id: string, newType: MarkerType, color?: string, shortLabel?: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.type = newType
    m.color = color ?? undefined
    m.shortLabel = shortLabel ?? undefined
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(newType, m.bearing, m.status, m.color, m.shortLabel))
    this.apiPut(id, { type: newType, color: color ?? null, short_label: shortLabel ?? null })
    this.onUpdate()
  }

  updateNote(id: string, note: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.locationNote = note || undefined
    this.apiPut(id, { location_note: note || null })
  }

  private addLeafletMarker(m: SignMarker): void {
    const icon = createSignIcon(m.type, m.bearing, m.status, m.color, m.shortLabel)
    const lm = L.marker([m.lat, m.lon], { icon, draggable: true }).addTo(this.map)
    this.leafletMarkers.set(m.id, lm)

    lm.on('dragend', () => {
      const { lat, lng } = lm.getLatLng()
      let bestIdx = 0, bestRouteIdx = 0, bestDist = Infinity
      this.routes.forEach((r, ri) => {
        const idx = nearestPointIndex(r.routePoints, lat, lng)
        const dist = haversineDistance(r.routePoints[idx], { lat, lon: lng })
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; bestRouteIdx = ri }
      })
      const primaryRoute = this.routes[bestRouteIdx]
      const point = primaryRoute.routePoints[bestIdx]
      const rawRouteIds = assignRoutesToMarker(lat, lng, this.routes)
      const routeIds = ensureRouteIds(rawRouteIds, primaryRoute.id)
      if (bestDist > FAR_FROM_ROUTE_M) this.onFarFromRoute?.(bestDist)
      // V52: jos käyttäjä on manuaalisesti kääntänyt merkkiä, säilytä bearing
      const bearing = m.bearingManual ? m.bearing : bearingAtIndex(primaryRoute.routePoints, bestIdx)
      m.lat = lat
      m.lon = lng
      m.bearing = bearing
      m.distanceFromStart = point.distanceFromStart
      m.routeIds = routeIds
      lm.setIcon(createSignIcon(m.type, bearing, m.status, m.color, m.shortLabel))
      this.apiPut(m.id, {
        lat,
        lon: lng,
        bearing,
        bearing_manual: m.bearingManual ?? false,
        distance_from_start: point.distanceFromStart,
        route_ids: routeIds,
      })
      this.onUpdate()
    })

    const el = lm.getElement()
    if (!el) return
    el.style.cursor = 'pointer'

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.interaction.isRotating) return
      if (this.interaction.activeContextMenuMarkerId === m.id) {
        this.interaction.hideContextMenu()
        return
      }
      this.interaction.showContextMenu(m, el)
    })

    el.addEventListener('mousedown', (e) => {
      if (this.interaction.armedId !== m.id) return
      e.stopPropagation()
      this.interaction.startRotation(m.id)
    })

    el.addEventListener('touchstart', (e) => {
      if (this.interaction.armedId !== m.id) return
      e.stopPropagation()
      e.preventDefault()
      this.interaction.startRotation(m.id)
    }, { passive: false })
  }
}
