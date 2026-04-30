import L from 'leaflet'
import type { SignMarker, MarkerType, RoutePoint } from './types'
import { nearestPointIndex, bearingAtIndex } from './bearing'
import { createSignIcon } from './icons'

export class MarkerManager {
  private markers: SignMarker[] = []
  private leafletMarkers = new Map<string, L.Marker>()
  private map: L.Map
  private routePoints: RoutePoint[]
  private onUpdate: () => void

  private rotatingId: string | null = null
  private rotatingCenter: { x: number; y: number } | null = null

  private readonly handleMouseMove = (e: MouseEvent) => {
    this.applyRotation(e.clientX, e.clientY)
  }
  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) this.applyRotation(e.touches[0].clientX, e.touches[0].clientY)
  }
  private readonly handleRotateEnd = () => {
    if (!this.rotatingId) return
    this.rotatingId = null
    this.rotatingCenter = null
    this.map.dragging.enable()
    const c = this.map.getContainer()
    c.removeEventListener('mousemove', this.handleMouseMove)
    c.removeEventListener('mouseup', this.handleRotateEnd)
    c.removeEventListener('touchmove', this.handleTouchMove)
    c.removeEventListener('touchend', this.handleRotateEnd)
    this.onUpdate()
  }

  constructor(map: L.Map, routePoints: RoutePoint[], onUpdate: () => void) {
    this.map = map
    this.routePoints = routePoints
    this.onUpdate = onUpdate
  }

  add(lat: number, lon: number, type: MarkerType): SignMarker {
    const idx = nearestPointIndex(this.routePoints, lat, lon)
    const bearing = bearingAtIndex(this.routePoints, idx)
    const point = this.routePoints[idx]

    const marker: SignMarker = {
      id: crypto.randomUUID(),
      type,
      lat,
      lon,
      bearing,
      distanceFromStart: point.distanceFromStart,
    }
    this.markers.push(marker)
    this.addLeafletMarker(marker)
    this.onUpdate()
    return marker
  }

  remove(id: string): void {
    const lm = this.leafletMarkers.get(id)
    if (lm) { lm.remove(); this.leafletMarkers.delete(id) }
    this.markers = this.markers.filter((m) => m.id !== id)
    this.onUpdate()
  }

  updateBearing(id: string, bearing: number): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.bearing = bearing
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, bearing))
  }

  startRotation(id: string, clientX: number, clientY: number): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    this.rotatingId = id
    const pt = this.map.latLngToContainerPoint([m.lat, m.lon])
    this.rotatingCenter = { x: pt.x, y: pt.y }
    this.map.dragging.disable()
    const c = this.map.getContainer()
    c.addEventListener('mousemove', this.handleMouseMove)
    c.addEventListener('mouseup', this.handleRotateEnd)
    c.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    c.addEventListener('touchend', this.handleRotateEnd)
  }

  getAll(): SignMarker[] {
    return [...this.markers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
  }

  panTo(id: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (m) this.map.setView([m.lat, m.lon], this.map.getZoom())
  }

  private applyRotation(clientX: number, clientY: number): void {
    if (!this.rotatingId || !this.rotatingCenter) return
    const rect = this.map.getContainer().getBoundingClientRect()
    const dx = clientX - rect.left - this.rotatingCenter.x
    const dy = clientY - rect.top - this.rotatingCenter.y
    const bearing = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360
    this.updateBearing(this.rotatingId, bearing)
  }

  private addLeafletMarker(m: SignMarker): void {
    const icon = createSignIcon(m.type, m.bearing)
    const lm = L.marker([m.lat, m.lon], { icon }).addTo(this.map)
    this.leafletMarkers.set(m.id, lm)

    const el = lm.getElement()
    if (el) {
      el.style.cursor = 'grab'
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation()
        this.startRotation(m.id, e.clientX, e.clientY)
      })
      el.addEventListener('touchstart', (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (e.touches.length > 0) this.startRotation(m.id, e.touches[0].clientX, e.touches[0].clientY)
      }, { passive: false })
    }
  }
}
