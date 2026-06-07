import L from 'leaflet'
import type { SignMarker, MarkerType, RoutePoint } from '../logic/types'
import { nearestPointIndex, bearingAtIndex, haversineDistance } from '../logic/bearing'
import { createSignIcon } from './icons'
import { assignRoutesToMarker } from '../logic/multi-route'
import { saveMarkers } from '../logic/persistence'

interface RouteRef { id: string; routePoints: RoutePoint[] }

export class MarkerManager {
  private markers: SignMarker[] = []
  private leafletMarkers = new Map<string, L.Marker>()
  private map: L.Map
  private routes: RouteRef[]
  private visibleRouteIds: string[]
  private onUpdate: () => void

  private rotatingId: string | null = null
  private rotatingCenter: { x: number; y: number } | null = null
  private rotationArmedId: string | null = null
  private contextMenu: HTMLElement | null = null
  private contextMenuMarkerId: string | null = null

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
    this.disarmRotation()
    this.save()
    this.onUpdate()
  }

  private readonly handleArmOutsideClick = (e: Event) => {
    const armedEl = this.rotationArmedId
      ? this.leafletMarkers.get(this.rotationArmedId)?.getElement()
      : null
    if (armedEl?.contains(e.target as Node)) return
    this.disarmRotation()
  }

  constructor(map: L.Map, routes: RouteRef[], onUpdate: () => void, initialMarkers: SignMarker[] = []) {
    this.map = map
    this.routes = routes
    this.visibleRouteIds = routes.map((r) => r.id)
    this.onUpdate = onUpdate
    this.markers = initialMarkers
    initialMarkers.forEach((m) => {
      if (m.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
        this.addLeafletMarker(m)
      }
    })
    MarkerManager.injectStyles()
  }

  private save(): void {
    saveMarkers(this.markers)
  }

  add(lat: number, lon: number, type: MarkerType): SignMarker {
    // Find globally nearest point across all routes for bearing/distanceFromStart
    let bestIdx = 0, bestRouteIdx = 0, bestDist = Infinity
    this.routes.forEach((r, ri) => {
      const idx = nearestPointIndex(r.routePoints, lat, lon)
      const dist = haversineDistance(r.routePoints[idx], { lat, lon })
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; bestRouteIdx = ri }
    })
    const primaryRoute = this.routes[bestRouteIdx]
    const bearing = bearingAtIndex(primaryRoute.routePoints, bestIdx)
    const point = primaryRoute.routePoints[bestIdx]
    const routeIds = assignRoutesToMarker(lat, lon, this.routes)

    const marker: SignMarker = {
      id: crypto.randomUUID(),
      type, lat, lon, bearing,
      distanceFromStart: point.distanceFromStart,
      routeIds,
    }
    this.markers.push(marker)
    this.save()

    // Only add Leaflet marker if at least one of its routes is visible
    if (marker.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
      this.addLeafletMarker(marker)
    }
    this.onUpdate()
    this.armRotation(marker.id)
    return marker
  }

  remove(id: string): void {
    if (this.rotationArmedId === id) this.disarmRotation()
    const lm = this.leafletMarkers.get(id)
    if (lm) { lm.remove(); this.leafletMarkers.delete(id) }
    this.markers = this.markers.filter((m) => m.id !== id)
    this.save()
    this.onUpdate()
  }

  updateBearing(id: string, bearing: number): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.bearing = bearing
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, bearing))
  }

  startRotation(id: string, _clientX: number, _clientY: number): void {
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

  private armRotation(id: string): void {
    this.rotationArmedId = id
    const el = this.leafletMarkers.get(id)?.getElement()
    if (el) el.classList.add('marker-armed')
    setTimeout(() => {
      document.addEventListener('mousedown', this.handleArmOutsideClick)
      document.addEventListener('touchstart', this.handleArmOutsideClick)
    }, 0)
  }

  private disarmRotation(): void {
    if (!this.rotationArmedId) return
    const el = this.leafletMarkers.get(this.rotationArmedId)?.getElement()
    if (el) el.classList.remove('marker-armed')
    this.rotationArmedId = null
    document.removeEventListener('mousedown', this.handleArmOutsideClick)
    document.removeEventListener('touchstart', this.handleArmOutsideClick)
  }

  private showContextMenu(m: SignMarker, anchorEl: HTMLElement): void {
    this.hideContextMenu()

    const rect = anchorEl.getBoundingClientRect()
    const menu = document.createElement('div')
    menu.className = 'marker-ctx-menu'
    menu.style.top = `${rect.top - 48}px`
    menu.style.left = `${rect.left + rect.width / 2}px`
    menu.style.transform = 'translateX(-50%)'
    menu.addEventListener('click', (e) => e.stopPropagation())
    menu.addEventListener('mousedown', (e) => e.stopPropagation())
    menu.addEventListener('touchstart', (e) => e.stopPropagation())

    const rotateBtn = document.createElement('button')
    rotateBtn.className = 'marker-ctx-rotate'
    rotateBtn.textContent = '↻ Käännä'
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.hideContextMenu()
      this.armRotation(m.id)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'marker-ctx-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.hideContextMenu()
      this.remove(m.id)
    })

    menu.appendChild(rotateBtn)
    menu.appendChild(deleteBtn)
    document.body.appendChild(menu)
    this.contextMenu = menu
    this.contextMenuMarkerId = m.id

    setTimeout(() => {
      document.addEventListener('click', this.handleMenuOutside, { once: true })
    }, 300)
  }

  private readonly handleMenuOutside = () => {
    this.hideContextMenu()
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove()
      this.contextMenu = null
      this.contextMenuMarkerId = null
    }
  }

  private applyRotation(clientX: number, clientY: number): void {
    if (!this.rotatingId || !this.rotatingCenter) return
    const rect = this.map.getContainer().getBoundingClientRect()
    const dx = clientX - rect.left - this.rotatingCenter.x
    const dy = clientY - rect.top - this.rotatingCenter.y
    const bearing = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360

    const m = this.markers.find((x) => x.id === this.rotatingId)
    if (!m) return
    m.bearing = bearing

    const el = this.leafletMarkers.get(this.rotatingId)?.getElement()
    const svg = el?.querySelector('svg') as HTMLElement | null
    if (svg) svg.style.transform = `rotate(${bearing}deg)`
  }

  private addLeafletMarker(m: SignMarker): void {
    const icon = createSignIcon(m.type, m.bearing)
    const lm = L.marker([m.lat, m.lon], { icon }).addTo(this.map)
    this.leafletMarkers.set(m.id, lm)

    const el = lm.getElement()
    if (!el) return

    el.style.cursor = 'pointer'

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.rotatingId) return
      if (this.contextMenuMarkerId === m.id) { this.hideContextMenu(); return }
      this.showContextMenu(m, el)
    })

    el.addEventListener('mousedown', (e) => {
      if (this.rotationArmedId !== m.id) return
      e.stopPropagation()
      document.removeEventListener('mousedown', this.handleArmOutsideClick)
      this.startRotation(m.id, e.clientX, e.clientY)
    })

    el.addEventListener('touchstart', (e) => {
      if (this.rotationArmedId !== m.id) return
      e.stopPropagation()
      e.preventDefault()
      if (e.touches.length > 0) this.startRotation(m.id, e.touches[0].clientX, e.touches[0].clientY)
    }, { passive: false })
  }

  private static injectStyles(): void {
    if (document.getElementById('marker-ctx-styles')) return
    const style = document.createElement('style')
    style.id = 'marker-ctx-styles'
    style.textContent = `
      .marker-ctx-menu {
        position: fixed;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        display: flex;
        gap: 4px;
        padding: 4px;
        z-index: 2000;
        pointer-events: auto;
      }
      .marker-ctx-menu button {
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .marker-ctx-rotate { background: #f59e0b; color: #111; }
      .marker-ctx-delete { background: #ef4444; color: #fff; }
      .sign-handle { display: none; }
      .marker-armed .sign-handle { display: block; }
      .marker-armed { cursor: grab !important; }
    `
    document.head.appendChild(style)
  }
}
