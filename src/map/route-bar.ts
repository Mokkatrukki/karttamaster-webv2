import L from 'leaflet'
import { nearestPointIndex } from '../logic/bearing'
import type { RouteConfig } from '../logic/multi-route'
import type { DriveMode } from './drive'
import type { MarkerManager } from './markers'

const SVG_EYE_OPEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const SVG_EYE_OFF  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

export class RouteBar {
  private visibleRouteIds: string[]
  private driveRouteId: string

  constructor(
    private readonly routes: RouteConfig[],
    private readonly polylines: L.Polyline[],
    private readonly map: L.Map,
    private readonly driveMode: DriveMode,
    private readonly markerManager: MarkerManager,
    private readonly container: HTMLElement,
    private readonly trackFill: HTMLElement,
    private readonly onActiveRouteChange: () => void,
  ) {
    this.visibleRouteIds = routes.map(r => r.id)
    this.driveRouteId = routes[0].id
    this.buildTabs()
    this.bindPolylineClicks()
    this.updateDOM()
  }

  getActiveRoute(): RouteConfig {
    return this.routes.find(r => r.id === this.driveRouteId)!
  }

  getActiveTotalM(): number {
    const pts = this.getActiveRoute().routePoints
    return pts[pts.length - 1]?.distanceFromStart ?? 0
  }

  setDriveRoute(id: string): void {
    this.driveRouteId = id
    if (!this.visibleRouteIds.includes(id)) {
      this.applyVisible([...this.visibleRouteIds, id])
    }
    this.driveMode.setRoute(this.getActiveRoute().routePoints)
    this.updateDOM()
    this.onActiveRouteChange()
  }

  toggleVisible(id: string): void {
    if (this.visibleRouteIds.includes(id)) {
      if (this.visibleRouteIds.length <= 1) return
      const next = this.visibleRouteIds.filter(rid => rid !== id)
      if (id === this.driveRouteId) {
        this.driveRouteId = next[0]
        this.driveMode.setRoute(this.getActiveRoute().routePoints)
        this.onActiveRouteChange()
      }
      this.applyVisible(next)
    } else {
      this.applyVisible([...this.visibleRouteIds, id])
    }
  }

  private applyVisible(ids: string[]): void {
    this.visibleRouteIds = ids
    this.routes.forEach((r, i) => {
      if (ids.includes(r.id)) this.polylines[i].addTo(this.map)
      else this.polylines[i].remove()
    })
    this.markerManager.setVisibleRoutes(ids)
    this.updateDOM()
  }

  private updateDOM(): void {
    const onlyOneVisible = this.visibleRouteIds.length <= 1
    this.routes.forEach(r => {
      const tab = this.container.querySelector(`.route-tab[data-route-id="${r.id}"]`) as HTMLElement | null
      if (!tab) return
      const visBtn = tab.querySelector('.route-tab-vis') as HTMLButtonElement
      const isVisible = this.visibleRouteIds.includes(r.id)
      tab.classList.toggle('active', r.id === this.driveRouteId)
      tab.classList.toggle('route-hidden', !isVisible)
      visBtn.innerHTML = isVisible ? SVG_EYE_OPEN : SVG_EYE_OFF
      visBtn.disabled = isVisible && onlyOneVisible
      visBtn.title = isVisible ? 'Piilota reitti' : 'Näytä reitti'
    })
    this.trackFill.style.background = this.getActiveRoute().color
  }

  private buildTabs(): void {
    this.routes.forEach(r => {
      const tab = document.createElement('div')
      tab.className = 'route-tab'
      tab.dataset.routeId = r.id
      tab.style.background = r.color

      const driveBtn = document.createElement('button')
      driveBtn.className = 'route-tab-drive'
      driveBtn.title = 'Aseta ajettavaksi reitiksi'
      driveBtn.innerHTML = `<span class="tab-color-dot" style="background:${r.color}"></span>${r.label}<span class="tab-arrow">▶</span>`
      driveBtn.addEventListener('click', () => this.setDriveRoute(r.id))

      const visBtn = document.createElement('button')
      visBtn.className = 'route-tab-vis'
      visBtn.innerHTML = SVG_EYE_OPEN
      visBtn.addEventListener('click', () => this.toggleVisible(r.id))

      tab.appendChild(driveBtn)
      tab.appendChild(visBtn)
      this.container.appendChild(tab)
    })
  }

  private bindPolylineClicks(): void {
    this.polylines.forEach((polyline, i) => {
      polyline.on('click', (e: L.LeafletMouseEvent) => {
        const r = this.routes[i]
        if (r.id !== this.driveRouteId) this.setDriveRoute(r.id)
        const idx = nearestPointIndex(r.routePoints, e.latlng.lat, e.latlng.lng)
        this.driveMode.jumpTo(idx)
      })
    })
  }
}
