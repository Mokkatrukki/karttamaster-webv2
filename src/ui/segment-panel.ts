import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSegment, updateSegment, deleteSegment } from '../logic/segments'
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

    const main = document.createElement('div')
    main.className = 'segment-row-main'

    const info = document.createElement('span')
    info.className = 'segment-info'
    const startKm = (seg.startDist / 1000).toFixed(1)
    const endKm = (seg.endDist / 1000).toFixed(1)
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = `${name} — ${startKm}–${endKm} km`
    main.appendChild(info)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', () => {
      deleteSegment(this.store, seg.id)
      this.render()
      this.onUpdate()
    })
    main.appendChild(deleteBtn)
    li.appendChild(main)

    li.appendChild(this.buildAssignSection(seg))

    return li
  }

  private buildAssignSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-assign'

    if (seg.assignedCode) {
      const url = `/s/${seg.assignedCode}`

      const urlSpan = document.createElement('span')
      urlSpan.className = 'segment-url'
      urlSpan.textContent = url
      section.appendChild(urlSpan)

      const copyBtn = document.createElement('button')
      copyBtn.className = 'btn-copy-url'
      copyBtn.textContent = '📋 Kopioi'
      copyBtn.addEventListener('click', () => {
        const fullUrl = `${window.location.origin}${url}`
        navigator.clipboard.writeText(fullUrl).catch(() => {})
      })
      section.appendChild(copyBtn)

      const editBtn = document.createElement('button')
      editBtn.className = 'btn-assign-edit'
      editBtn.textContent = 'Muuta'
      editBtn.addEventListener('click', () => {
        updateSegment(this.store, seg.id, { assignedCode: undefined })
        this.render()
      })
      section.appendChild(editBtn)
    } else {
      const codeInput = document.createElement('input')
      codeInput.className = 'input-assign-code'
      codeInput.placeholder = 'Koodi'
      codeInput.setAttribute('aria-label', 'Talkoolaisen koodi')

      const nameInput = document.createElement('input')
      nameInput.className = 'input-assign-name'
      nameInput.placeholder = 'Nimi (valinnainen)'
      nameInput.value = seg.displayName ?? ''
      nameInput.setAttribute('aria-label', 'Pätkän nimi')

      const saveBtn = document.createElement('button')
      saveBtn.className = 'btn-assign-save'
      saveBtn.textContent = 'Tallenna'
      saveBtn.addEventListener('click', () => {
        const code = codeInput.value.trim()
        if (!code) return
        const displayName = nameInput.value.trim() || seg.displayName
        updateSegment(this.store, seg.id, { assignedCode: code, displayName })
        this.render()
        this.onUpdate()
      })

      section.appendChild(codeInput)
      section.appendChild(nameInput)
      section.appendChild(saveBtn)
    }

    return section
  }
}
