import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSegment, deleteSegment } from '../logic/segments'
import type { Segment, SegmentStore } from '../logic/segments'
import type { RouteConfig } from '../logic/multi-route'

type CreationState =
  | { mode: 'idle' }
  | { mode: 'first-click' }
  | { mode: 'second-click'; routeId: string; startDist: number }

export class SegmentPanel {
  private readonly statusEl: HTMLElement
  private readonly listEl: HTMLUListElement
  private state: CreationState = { mode: 'idle' }
  private segmentCount = 0

  constructor(
    container: HTMLElement,
    private readonly routes: RouteConfig[],
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
  ) {
    const { panel, statusEl, listEl } = this.build()
    this.statusEl = statusEl
    this.listEl = listEl
    container.appendChild(panel)
    this.render()
  }

  isCreationMode(): boolean {
    return this.state.mode !== 'idle'
  }

  onMapClick(lat: number, lon: number): void {
    if (this.state.mode === 'idle') return

    const resolved = this.resolveClick(lat, lon)
    if (!resolved) return

    if (this.state.mode === 'first-click') {
      this.state = { mode: 'second-click', routeId: resolved.routeId, startDist: resolved.distanceFromStart }
      this.statusEl.textContent = 'Klikkaa reittiä: 2. piste'
      return
    }

    if (this.state.mode === 'second-click') {
      const first = this.state
      const startDist = Math.min(first.startDist, resolved.distanceFromStart)
      const endDist = Math.max(first.startDist, resolved.distanceFromStart)

      if (endDist - startDist < 1) {
        this.statusEl.textContent = 'Pisteet liian lähellä — klikkaa kauempaa'
        return
      }

      const routeIds = [first.routeId]
      if (resolved.routeId !== first.routeId) routeIds.push(resolved.routeId)

      this.segmentCount++
      createSegment(this.store, {
        routeIds,
        startDist,
        endDist,
        equipment: [],
        phase: 'asettaminen',
        displayName: `Pätkä ${this.segmentCount}`,
      })

      this.state = { mode: 'idle' }
      this.statusEl.hidden = true
      this.render()
      this.onUpdate()
    }
  }

  private resolveClick(lat: number, lon: number): { routeId: string; distanceFromStart: number } | null {
    let bestRouteId = ''
    let bestDist = Infinity
    let bestDistFromStart = 0
    for (const route of this.routes) {
      const idx = nearestPointIndex(route.routePoints, lat, lon)
      const pt = route.routePoints[idx]
      const d = haversineDistance(pt, { lat, lon })
      if (d < bestDist) {
        bestDist = d
        bestRouteId = route.id
        bestDistFromStart = pt.distanceFromStart
      }
    }
    return bestRouteId ? { routeId: bestRouteId, distanceFromStart: bestDistFromStart } : null
  }

  private build(): { panel: HTMLElement; statusEl: HTMLElement; listEl: HTMLUListElement } {
    const panel = document.createElement('div')
    panel.id = 'segment-panel'

    const header = document.createElement('div')
    header.className = 'segment-panel-header'

    const title = document.createElement('h3')
    title.textContent = 'Pätkäjako'
    header.appendChild(title)

    const createBtn = document.createElement('button')
    createBtn.id = 'btn-segment-create'
    createBtn.textContent = 'Luo uusi pätkä'
    createBtn.className = 'btn-segment-create'
    createBtn.addEventListener('click', () => this.enterCreationMode())
    header.appendChild(createBtn)

    panel.appendChild(header)

    const statusEl = document.createElement('div')
    statusEl.className = 'segment-panel-status'
    statusEl.hidden = true
    panel.appendChild(statusEl)

    const listEl = document.createElement('ul')
    listEl.id = 'segment-list'
    listEl.className = 'segment-list'
    panel.appendChild(listEl)

    return { panel, statusEl, listEl }
  }

  private enterCreationMode(): void {
    this.state = { mode: 'first-click' }
    this.statusEl.hidden = false
    this.statusEl.textContent = 'Klikkaa reittiä: 1. piste'
  }

  private render(): void {
    this.listEl.innerHTML = ''
    const segments = Array.from(this.store.values())
    if (segments.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-empty'
      empty.textContent = 'Ei pätkiä — luo ensimmäinen'
      this.listEl.appendChild(empty)
      return
    }
    for (const seg of segments) {
      this.listEl.appendChild(this.buildSegmentRow(seg))
    }
  }

  private buildSegmentRow(seg: Segment): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-item'
    li.dataset.id = seg.id

    const info = document.createElement('span')
    info.className = 'segment-info'
    const startKm = (seg.startDist / 1000).toFixed(1)
    const endKm = (seg.endDist / 1000).toFixed(1)
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = `${name} — ${startKm}–${endKm} km`
    li.appendChild(info)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', () => {
      deleteSegment(this.store, seg.id)
      this.render()
      this.onUpdate()
    })
    li.appendChild(deleteBtn)

    return li
  }
}
