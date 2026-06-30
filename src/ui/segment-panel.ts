import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { validateNoOverlap } from '../logic/segments'
import type { SegmentStore, Segment } from '../logic/segments'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import { SegmentCreationModal, type CreationState } from './segment-creation-modal'
import { SegmentDetailsModal } from './segment-details-modal'

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
        void seg
      },
    )

    this.detailsModal = new SegmentDetailsModal(
      store,
      onUpdate,
      () => this.render(),
      {
        getMarkers: callbacks.getMarkers,
        onEnterEditMode: callbacks.onEnterEditMode,
        onExitEditMode: callbacks.onExitEditMode,
      },
    )

    this.render()
  }

  isCreationMode(): boolean {
    return this.state.mode !== 'idle'
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
    if (this.state.mode === 'idle' || this.state.mode === 'tiedot') return
    const resolved = this.resolveClick(lat, lon)
    if (!resolved) return
    this.receivePoint(resolved.routeId, resolved.distanceFromStart, resolved.lat, resolved.lon)
  }

  onSnapClick(routeId: string, dist: number, lat: number, lon: number): void {
    if (this.state.mode === 'idle' || this.state.mode === 'tiedot') return
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
      const startDist = Math.min(first.startDist, dist)
      const endDist = Math.max(first.startDist, dist)

      if (endDist - startDist < 1) {
        this.creationModal.setError('Pisteet liian lähellä — klikkaa kauempaa')
        return
      }

      if (!validateNoOverlap(this.store, first.routeId, startDist, endDist)) {
        this.creationModal.setError('Pätkä menee päällekkäin — valitse eri pisteet')
        return
      }

      const routeIds = [first.routeId]
      if (routeId !== first.routeId) routeIds.push(routeId)

      this.state = { mode: 'tiedot', routeIds, startDist, endDist }
      this.callbacks.onFirstPointClear?.()
      this.callbacks.onHideSnapMarkers?.()
      this.creationModal.updatePhase(this.state)
    }
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
    this.titleEl.textContent = `Pätkäjako (${count})`
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
    titleEl.textContent = 'Pätkäjako (0)'
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

  private render(): void {
    this.applyCollapsed()
    this.listEl.innerHTML = ''

    const panel = this.listEl.parentElement
    panel?.querySelector('.btn-segment-footer')?.remove()

    const segments = Array.from(this.store.values())
    if (segments.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-empty'
      empty.textContent = 'Ei pätkiä — luo ensimmäinen'
      this.listEl.appendChild(empty)
    } else {
      for (const seg of segments) {
        this.listEl.appendChild(this.buildRow(seg))
      }
    }

    if (!this.collapsed) {
      const footerBtn = document.createElement('button')
      footerBtn.id = 'btn-segment-create'
      footerBtn.className = 'btn-segment-footer'
      footerBtn.textContent = '+ Luo uusi pätkä'
      footerBtn.style.cssText =
        'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'
      footerBtn.addEventListener('click', () => this.enterCreationMode())
      panel?.appendChild(footerBtn)
    }
  }

  private buildRow(seg: Segment): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-item'
    li.dataset.id = seg.id

    const info = document.createElement('span')
    info.className = 'segment-info'
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = name

    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    kmSpan.textContent = `${(seg.startDist / 1000).toFixed(1)}–${(seg.endDist / 1000).toFixed(1)} km`

    const detailsBtn = document.createElement('button')
    detailsBtn.className = 'btn-segment-details-open'
    detailsBtn.setAttribute('aria-label', `Avaa ${name} asetukset`)
    detailsBtn.textContent = '···'
    detailsBtn.addEventListener('click', () => this.detailsModal.open(seg))

    li.appendChild(info)
    li.appendChild(kmSpan)
    li.appendChild(detailsBtn)
    return li
  }
}
