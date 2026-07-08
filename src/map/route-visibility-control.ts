import type L from 'leaflet'
import type { RouteConfig } from '../logic/multi-route'
import type { MarkerManager } from './markers'

const SVG_EYE_OPEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const SVG_EYE_OFF  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

// T204/V134: järjestäjän kevyt reittivalitsin — pelkkä näytä/piilota per reitti (pyöreä
// pill-kontrolli). EI drive-kontrolleja (◀▶), EI km-scrubberia — ne kuuluvat vain
// talkoolaisen näkymään (RouteBar). V6 säilyy: viimeistä näkyvää reittiä ei voi piilottaa.
export class RouteVisibilityControl {
  private visibleRouteIds: string[]

  constructor(
    private readonly routes: RouteConfig[],
    private readonly polylines: L.Polyline[],
    private readonly map: L.Map,
    private readonly markerManager: MarkerManager,
    private readonly container: HTMLElement,
  ) {
    this.visibleRouteIds = routes.map(r => r.id)
    this.buildPills()
    this.updateDOM()
  }

  // ProgressBar/StatusPanel-yhteensopivuus: "aktiivinen" = ensimmäinen näkyvä reitti.
  getActiveRoute(): RouteConfig {
    return this.routes.find(r => this.visibleRouteIds.includes(r.id)) ?? this.routes[0]
  }

  getActiveTotalM(): number {
    const pts = this.getActiveRoute().routePoints
    return pts[pts.length - 1]?.distanceFromStart ?? 0
  }

  toggleVisible(id: string): void {
    if (this.visibleRouteIds.includes(id)) {
      if (this.visibleRouteIds.length <= 1) return // V6: viimeistä ei voi piilottaa
      this.applyVisible(this.visibleRouteIds.filter(rid => rid !== id))
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
      const pill = this.container.querySelector(`.route-vis-pill[data-route-id="${r.id}"]`) as HTMLElement | null
      if (!pill) return
      const isVisible = this.visibleRouteIds.includes(r.id)
      pill.classList.toggle('route-hidden', !isVisible)
      const eye = pill.querySelector('.route-vis-eye') as HTMLElement
      eye.innerHTML = isVisible ? SVG_EYE_OPEN : SVG_EYE_OFF
      const btn = pill as HTMLButtonElement
      btn.disabled = isVisible && onlyOneVisible
      btn.title = isVisible ? (btn.disabled ? 'Viimeistä reittiä ei voi piilottaa' : 'Piilota reitti') : 'Näytä reitti'
    })
  }

  private buildPills(): void {
    // V137/B92: idempotentti render — tyhjennä ennen lisäystä, ettei re-init (logout→login)
    // tai muu tuplakutsu jätä tuplapillereitä ("35km 55km 35km 55km") containeriin.
    this.container.replaceChildren()
    this.routes.forEach(r => {
      const pill = document.createElement('button')
      pill.className = 'route-vis-pill'
      pill.dataset.routeId = r.id
      pill.innerHTML = `<span class="route-vis-dot" style="background:${r.color}"></span><span class="route-vis-label">${r.label}</span><span class="route-vis-eye">${SVG_EYE_OPEN}</span>`
      pill.addEventListener('click', () => this.toggleVisible(r.id))
      this.container.appendChild(pill)
    })
  }
}
