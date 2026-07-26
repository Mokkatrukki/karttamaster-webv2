import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import {
  validateNoOverlap,
  getSegmentStatusCounts,
  formatStatusCounts,
  getPhaseProgress,
  formatPhaseProgress,
  getSegmentsForPhase,
  segmentPath,
} from '../logic/segments'
import type { SegmentStore, Segment } from '../logic/segments'
import { SHARED_THRESHOLD_M, type RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import { SegmentCreationModal, type CreationState } from './segment-creation-modal'
import { SegmentDetailsModal } from './segment-details-modal'
import { openSegmentRowMenu } from './segment-row-menu'

export interface SegmentPanelCallbacks {
  onFirstPoint?: (lat: number, lon: number) => void
  onFirstPointClear?: () => void
  onEnterEditMode?: (seg: Segment, onSave: (startDist: number, endDist: number) => void) => void
  onExitEditMode?: () => void
  onSaveError?: (err: unknown) => void
  getMarkers?: () => SignMarker[]
  onEnterCreationMode?: () => void
  onExitCreationMode?: () => void
  onShowSnapMarkers?: (onSnap: (routeId: string, dist: number, lat: number, lon: number) => void) => void
  onHideSnapMarkers?: () => void
  // T148: globaali phase-näkymän suodin — undefined = näytä kaikki (taaksepäin yhteensopiva)
  getActivePhase?: () => Segment['phase']
  // T335/V243: kartan korostus vain valittuun pätkään — tila asuu wiringissä, paneeli välittää
  isFocusSegment?: (seg: Segment) => boolean
  onToggleFocusSegment?: (seg: Segment, on: boolean) => void
  // T345: rajaa kartta pätkään (`···` → Näytä kartalla). Puuttuu → riviä ei näytetä valikossa.
  onShowSegmentOnMap?: (seg: Segment) => void
  // T345: näkyvä palaute (linkin kopiointi). Puuttuu → hiljainen onnistuminen.
  onNotify?: (msg: string) => void
}

export class SegmentPanel {
  private readonly statusEl: HTMLElement
  private readonly listEl: HTMLUListElement
  private readonly titleEl: HTMLElement
  private readonly toggleBtn: HTMLElement
  private state: CreationState = { mode: 'idle' }
  private collapsed = true
  private readonly creationModal: SegmentCreationModal
  private readonly detailsModal: SegmentDetailsModal

  constructor(
    container: HTMLElement,
    private readonly routes: RouteConfig[],
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
    private readonly callbacks: SegmentPanelCallbacks = {},
  ) {
    const { panel, statusEl, listEl, titleEl, toggleBtn } = this.build()
    this.statusEl = statusEl
    this.listEl = listEl
    this.titleEl = titleEl
    this.toggleBtn = toggleBtn
    container.appendChild(panel)

    this.creationModal = new SegmentCreationModal(
      store,
      () => this.cancelCreation(),
      (seg) => {
        this.state = { mode: 'idle' }
        this.callbacks.onExitCreationMode?.()
        this.render()
        this.onUpdate()
        // T298/V209/B113: luotu pätkä aukeaa suoraan lisätiedot-modaaliin — järjestäjä näkee
        // linkin ja voi muokata heti. Slug syntyy luonnissa (T297), ei "jaa linkki" -porttia.
        this.detailsModal.open(seg)
      },
      () => this.creationPhase(),
      () => this.callbacks.getMarkers?.() ?? [],
    )

    this.detailsModal = new SegmentDetailsModal(
      store,
      onUpdate,
      () => this.render(),
      {
        getMarkers: callbacks.getMarkers,
        onEnterEditMode: callbacks.onEnterEditMode,
        onExitEditMode: callbacks.onExitEditMode,
        isFocusSegment: callbacks.isFocusSegment,
        onToggleFocusSegment: callbacks.onToggleFocusSegment,
      },
    )

    this.render()
  }

  // T141/B61: kutsutaan merkin status-muutoksesta (main.ts MarkerManager onUpdate) — päivittää
  // rivien status-lukumäärät ilman että segmentin oma data on muuttunut.
  refreshCounts(): void {
    this.render()
  }

  isCreationMode(): boolean {
    return this.state.mode !== 'idle'
  }

  // T150/T151/V94: uusi pätkä + overlap-validointi kohdistuu aktiiviseen phase-näkymään
  private creationPhase(): Segment['phase'] {
    return this.callbacks.getActivePhase?.() ?? 'asettaminen'
  }

  cancelCreation(): void {
    if (this.state.mode === 'idle') return
    this.state = { mode: 'idle' }
    this.statusEl.hidden = true
    this.creationModal.close()
    this.callbacks.onFirstPointClear?.()
    this.callbacks.onHideSnapMarkers?.()
    this.callbacks.onExitCreationMode?.()
    this.applyCollapsed()
  }

  onMapClick(lat: number, lon: number): void {
    // reititön/tiedot/idle eivät ota kartta-klikkejä (vain reitin piste-poiminta vaihe1/vaihe2)
    if (this.state.mode !== 'vaihe1' && this.state.mode !== 'vaihe2') return
    const resolved = this.resolveClick(lat, lon)
    if (!resolved) return
    this.receivePoint(resolved.routeId, resolved.distanceFromStart, resolved.lat, resolved.lon)
  }

  onSnapClick(routeId: string, dist: number, lat: number, lon: number): void {
    if (this.state.mode !== 'vaihe1' && this.state.mode !== 'vaihe2') return
    this.receivePoint(routeId, dist, lat, lon)
  }

  openDetailsModal(seg: Segment): void {
    this.detailsModal.open(seg)
  }

  private receivePoint(routeId: string, dist: number, lat: number, lon: number): void {
    if (this.state.mode === 'vaihe1') {
      this.state = { mode: 'vaihe2', routeId, startDist: dist }
      this.callbacks.onFirstPoint?.(lat, lon)
      this.creationModal.updatePhase(this.state)
      return
    }

    if (this.state.mode === 'vaihe2') {
      const first = this.state
      // T299/V211/B114: klikki 2:n km ! lukea PRIMARY-reitistä (= klikki 1:n reitti), ei siitä
      // reitistä johon se sattui snappaamaan. 3 SMTB-reittiä kulkee samaa polkua ≤100 m ∴ ennen
      // tätä klikki 2 saattoi tuoda km:n eri geometriasta → Math.min/max vertasi reitin A km 12.4
      // ja reitin B km 47.1 → intervalli ei vastannut kumpaakaan → pätkä keräsi random-merkit.
      const secondDist = this.distOnRoute(first.routeId, lat, lon)
      if (secondDist === null) {
        this.creationModal.setError('Toinen piste ei ole samalla reitillä — klikkaa reitin varrelta')
        return
      }

      const startDist = Math.min(first.startDist, secondDist)
      const endDist = Math.max(first.startDist, secondDist)

      if (endDist - startDist < 1) {
        this.creationModal.setError('Pisteet liian lähellä — klikkaa kauempaa')
        return
      }

      if (!validateNoOverlap(this.store, first.routeId, startDist, endDist, this.creationPhase())) {
        this.creationModal.setError('Pätkä menee päällekkäin — valitse eri pisteet')
        return
      }

      this.state = {
        mode: 'tiedot',
        routeIds: this.sharedRouteIds(first.routeId, startDist, endDist),
        primaryRouteId: first.routeId,
        startDist,
        endDist,
      }
      this.callbacks.onFirstPointClear?.()
      this.callbacks.onHideSnapMarkers?.()
      this.creationModal.updatePhase(this.state)
    }
  }

  // T299/V211: paljonko km:ää annetulla reitillä, kun kartalta klikattiin (lat,lon).
  // null = klikki ei ole tämän reitin varrella (>SHARED_THRESHOLD_M) ∴ km olisi arvaus.
  private distOnRoute(routeId: string, lat: number, lon: number): number | null {
    const route = this.routes.find(r => r.id === routeId)
    if (!route || route.routePoints.length === 0) return null
    const pt = route.routePoints[nearestPointIndex(route.routePoints, lat, lon)]
    if (haversineDistance(pt, { lat, lon }) > SHARED_THRESHOLD_M) return null
    return pt.distanceFromStart
  }

  // T299/V25/V211: pätkän jäsenreitit = ne jotka kulkevat pätkän MATKALLA primaryn rinnalla
  // (≤SHARED_THRESHOLD_M koko välin ajan), ei "se reitti johon klikki 2 sattui osumaan".
  // Otos primaryn pisteistä välillä [startDist,endDist]; reitti kelpaa vain jos se on lähellä
  // JOKAISTA otospistettä — yhdessä kohdassa risteävä reitti ei tee siitä jaettua osuutta.
  private sharedRouteIds(primaryRouteId: string, startDist: number, endDist: number): string[] {
    const primary = this.routes.find(r => r.id === primaryRouteId)
    if (!primary) return [primaryRouteId]

    const inRange = primary.routePoints.filter(
      p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist,
    )
    if (inRange.length === 0) return [primaryRouteId]
    const step = Math.max(1, Math.floor(inRange.length / 12))
    const samples = inRange.filter((_, i) => i % step === 0)

    const ids = [primaryRouteId]
    for (const route of this.routes) {
      if (route.id === primaryRouteId || route.routePoints.length === 0) continue
      const alongside = samples.every(s => {
        const pt = route.routePoints[nearestPointIndex(route.routePoints, s.lat, s.lon)]
        return haversineDistance(pt, s) <= SHARED_THRESHOLD_M
      })
      if (alongside) ids.push(route.id)
    }
    return ids
  }

  private resolveClick(
    lat: number,
    lon: number,
  ): { routeId: string; distanceFromStart: number; lat: number; lon: number } | null {
    let bestRouteId = ''
    let bestDist = Infinity
    let bestDistFromStart = 0
    let bestLat = 0
    let bestLon = 0
    for (const route of this.routes) {
      const idx = nearestPointIndex(route.routePoints, lat, lon)
      const pt = route.routePoints[idx]
      const d = haversineDistance(pt, { lat, lon })
      if (d < bestDist) {
        bestDist = d
        bestRouteId = route.id
        bestDistFromStart = pt.distanceFromStart
        bestLat = pt.lat
        bestLon = pt.lon
      }
    }
    return bestRouteId
      ? { routeId: bestRouteId, distanceFromStart: bestDistFromStart, lat: bestLat, lon: bestLon }
      : null
  }

  private applyCollapsed(): void {
    const count = this.store.size
    this.titleEl.textContent = `Reittipätkät (${count})`
    this.toggleBtn.textContent = this.collapsed ? '▶' : '▼'
    this.listEl.hidden = this.collapsed
    if (this.collapsed) this.statusEl.hidden = true
  }

  private build(): {
    panel: HTMLElement
    statusEl: HTMLElement
    listEl: HTMLUListElement
    titleEl: HTMLElement
    toggleBtn: HTMLElement
  } {
    const panel = document.createElement('div')
    panel.id = 'segment-panel'

    const header = document.createElement('div')
    header.className = 'segment-panel-header left-panel-section-header'
    header.addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.render()
    })

    const toggleBtn = document.createElement('span')
    toggleBtn.className = 'btn-segment-toggle section-header-toggle'
    toggleBtn.textContent = '▶'
    header.appendChild(toggleBtn)

    const titleEl = document.createElement('span')
    titleEl.className = 'section-header-name'
    titleEl.textContent = 'Reittipätkät (0)'
    header.appendChild(titleEl)

    panel.appendChild(header)

    const statusEl = document.createElement('div')
    statusEl.className = 'segment-panel-status'
    statusEl.hidden = true
    panel.appendChild(statusEl)

    const listEl = document.createElement('ul')
    listEl.id = 'segment-list'
    listEl.className = 'segment-list'
    panel.appendChild(listEl)

    return { panel, statusEl, listEl, titleEl, toggleBtn }
  }

  private enterCreationMode(): void {
    this.collapsed = false
    this.applyCollapsed()
    this.state = { mode: 'vaihe1' }
    this.callbacks.onEnterCreationMode?.()
    this.callbacks.onShowSnapMarkers?.((routeId, dist, lat, lon) =>
      this.onSnapClick(routeId, dist, lat, lon),
    )
    this.creationModal.open(this.state)
  }

  // T216/V139: reititön (alue)tehtävä — ei kartta-klikkiflowta, avaa suoraan tiedot+liitoslomake.
  private enterRoutelessCreation(): void {
    this.collapsed = false
    this.applyCollapsed()
    this.state = { mode: 'reititon' }
    this.callbacks.onEnterCreationMode?.()
    this.creationModal.open(this.state)
  }

  private render(): void {
    this.applyCollapsed()
    this.listEl.innerHTML = ''

    const panel = this.listEl.parentElement
    panel?.querySelectorAll('.btn-segment-footer').forEach(el => el.remove())

    const activePhase = this.callbacks.getActivePhase?.()
    const segments = activePhase ? getSegmentsForPhase(this.store, activePhase) : Array.from(this.store.values())
    if (segments.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-empty'
      empty.textContent = activePhase ? `Ei pätkiä ${activePhase}-vaiheessa` : 'Ei pätkiä — luo ensimmäinen'
      this.listEl.appendChild(empty)
    } else {
      for (const seg of segments) {
        this.listEl.appendChild(this.buildRow(seg))
      }
    }

    if (!this.collapsed) {
      const footerStyle =
        'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'

      const footerBtn = document.createElement('button')
      footerBtn.id = 'btn-segment-create'
      footerBtn.className = 'btn-segment-footer'
      footerBtn.textContent = '+ Luo uusi pätkä'
      footerBtn.style.cssText = footerStyle
      footerBtn.addEventListener('click', () => this.enterCreationMode())
      panel?.appendChild(footerBtn)

      // T216/V139: reitittömän (alue)tehtävän luonti — maali/keräysalue ilman reittipätkää.
      const routelessBtn = document.createElement('button')
      routelessBtn.id = 'btn-segment-create-routeless'
      routelessBtn.className = 'btn-segment-footer'
      routelessBtn.textContent = '+ Luo aluetehtävä (reititön)'
      routelessBtn.style.cssText = footerStyle
      routelessBtn.addEventListener('click', () => this.enterRoutelessCreation())
      panel?.appendChild(routelessBtn)
    }
  }

  private buildRow(seg: Segment): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-item'
    li.dataset.id = seg.id

    // T344/V250: nimi on SISÄÄNTULO, ei koriste — DESIGN §K "Item-label: klikkaus = toiminto".
    // Aiemmin `span` ∴ ~80 % rivin leveydestä oli kuollutta aluetta & ainoa reitti asetuksiin oli
    // 44px `···`. Klikkikuuntelija on VAIN tässä napissa, ei `li`:ssä — kaksi sisäkkäistä kohdetta
    // laukaisisi modaalin kahdesti.
    const info = document.createElement('button')
    info.type = 'button'
    info.className = 'segment-info'
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = name
    info.setAttribute('aria-label', `Avaa ${name} lisätiedot`)
    info.addEventListener('click', () => this.detailsModal.open(seg))

    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    const markers = this.callbacks.getMarkers?.() ?? []
    kmSpan.textContent = formatPhaseProgress(getPhaseProgress(seg, markers))
    // V139: reitittömällä tehtävällä ei km-aluetta.
    const kmRange = seg.startDist !== undefined && seg.endDist !== undefined
      ? `${(seg.startDist / 1000).toFixed(1)}–${(seg.endDist / 1000).toFixed(1)} km · `
      : ''
    kmSpan.title = `${kmRange}${formatStatusCounts(getSegmentStatusCounts(seg, markers))}`

    // T345/V250: `···` avaa pikavalikon, ei enää suoraan modaalia — katselutoiminnot (zoom,
    // korostus, linkki) eivät saa kulkea modaalin kautta. Modaali on valikon viimeinen rivi.
    const detailsBtn = document.createElement('button')
    detailsBtn.className = 'btn-segment-details-open'
    detailsBtn.setAttribute('aria-label', `${name} — toiminnot`)
    detailsBtn.setAttribute('aria-haspopup', 'menu')
    detailsBtn.setAttribute('aria-expanded', 'false')
    detailsBtn.textContent = '···'
    detailsBtn.addEventListener('click', () => {
      openSegmentRowMenu(detailsBtn, {
        onShowOnMap: this.callbacks.onShowSegmentOnMap
          ? () => this.callbacks.onShowSegmentOnMap?.(seg)
          : undefined,
        isFocused: this.callbacks.isFocusSegment
          ? () => this.callbacks.isFocusSegment?.(seg) ?? false
          : undefined,
        onToggleFocus: this.callbacks.onToggleFocusSegment
          ? (on) => this.callbacks.onToggleFocusSegment?.(seg, on)
          : undefined,
        // V250: sama osoitelähde kuin modaalilla (`segmentPath`) — ⊥ toista `/s/<koodi>`-muotoa.
        shareUrl: segmentPath(this.store.get(seg.id) ?? seg),
        onOpenDetails: () => this.detailsModal.open(seg),
        onNotify: this.callbacks.onNotify,
      })
    })

    li.appendChild(info)
    li.appendChild(kmSpan)
    li.appendChild(detailsBtn)
    return li
  }
}
