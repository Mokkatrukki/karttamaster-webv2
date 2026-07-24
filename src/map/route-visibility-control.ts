import type L from 'leaflet'
import type { RouteConfig } from '../logic/multi-route'
import type { MarkerManager } from './markers'

const SVG_EYE_OPEN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const SVG_EYE_OFF  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
const SVG_LAYERS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`

// T204/V134 + T286: järjestäjän reittivalitsin. AIEMMIN: yksi pilli per reitti rivissä →
// 5 reittiä (2 tapahtumaa) ylivuoti mobiililla ja MTB-pillit jäivät ruudun ulkopuolelle.
// NYT: yksi trigger-nappi (karttatasot-ikoni + aktiivilaskuri) → avaa listapaneelin jossa
// reitit ryhmitelty tapahtumittain, kukin näytä/piilota-togglella. V6: viimeistä näkyvää
// reittiä ei voi piilottaa.
export class RouteVisibilityControl {
  private visibleRouteIds: string[]
  private open = false
  private trigger!: HTMLButtonElement
  private panel!: HTMLElement
  private readonly onDocClick = (e: MouseEvent) => {
    if (this.open && !this.container.contains(e.target as Node)) this.setOpen(false)
  }

  constructor(
    private readonly routes: RouteConfig[],
    private readonly polylines: L.Polyline[],
    private readonly map: L.Map,
    private readonly markerManager: MarkerManager,
    private readonly container: HTMLElement,
  ) {
    this.visibleRouteIds = routes.map(r => r.id)
    this.build()
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

  private setOpen(open: boolean): void {
    this.open = open
    this.panel.hidden = !open
    this.trigger.classList.toggle('open', open)
    this.trigger.setAttribute('aria-expanded', String(open))
    if (open) document.addEventListener('click', this.onDocClick)
    else document.removeEventListener('click', this.onDocClick)
  }

  private updateDOM(): void {
    const onlyOneVisible = this.visibleRouteIds.length <= 1
    this.routes.forEach(r => {
      const row = this.container.querySelector(`.route-vis-row[data-route-id="${r.id}"]`) as HTMLElement | null
      if (!row) return
      const isVisible = this.visibleRouteIds.includes(r.id)
      row.classList.toggle('route-hidden', !isVisible)
      const eye = row.querySelector('.route-vis-eye') as HTMLElement
      eye.innerHTML = isVisible ? SVG_EYE_OPEN : SVG_EYE_OFF
      const btn = row as HTMLButtonElement
      btn.disabled = isVisible && onlyOneVisible
      btn.title = isVisible ? (btn.disabled ? 'Viimeistä reittiä ei voi piilottaa' : 'Piilota reitti') : 'Näytä reitti'
    })
    const count = this.trigger.querySelector('.route-vis-count')
    if (count) count.textContent = `${this.visibleRouteIds.length}/${this.routes.length}`
  }

  private build(): void {
    // V137/B92: idempotentti render — tyhjennä ensin, ettei re-init (logout→login) jätä
    // tuplakontrolleja containeriin.
    this.container.replaceChildren()

    this.trigger = document.createElement('button')
    this.trigger.className = 'route-vis-trigger'
    this.trigger.type = 'button'
    this.trigger.setAttribute('aria-expanded', 'false')
    this.trigger.setAttribute('aria-label', 'Valitse näkyvät reitit')
    this.trigger.innerHTML = `${SVG_LAYERS}<span class="route-vis-count"></span>`
    this.trigger.addEventListener('click', e => { e.stopPropagation(); this.setOpen(!this.open) })

    this.panel = document.createElement('div')
    this.panel.className = 'route-vis-panel'
    this.panel.hidden = true

    // Ryhmittele tapahtumittain, säilytä ROUTE_DEFS-järjestys.
    const groups: Array<{ event: string; routes: RouteConfig[] }> = []
    for (const r of this.routes) {
      const ev = r.event ?? ''
      let g = groups.find(x => x.event === ev)
      if (!g) { g = { event: ev, routes: [] }; groups.push(g) }
      g.routes.push(r)
    }

    for (const g of groups) {
      if (g.event) {
        const label = document.createElement('div')
        label.className = 'route-vis-group-label'
        label.textContent = g.event
        this.panel.appendChild(label)
      }
      for (const r of g.routes) {
        const row = document.createElement('button')
        row.className = 'route-vis-row'
        row.type = 'button'
        row.dataset.routeId = r.id
        row.innerHTML = `<span class="route-vis-dot" style="background:${r.color}"></span><span class="route-vis-label">${r.label}</span><span class="route-vis-eye">${SVG_EYE_OPEN}</span>`
        row.addEventListener('click', () => this.toggleVisible(r.id))
        this.panel.appendChild(row)
      }
    }

    this.container.appendChild(this.panel)
    this.container.appendChild(this.trigger)
  }
}
