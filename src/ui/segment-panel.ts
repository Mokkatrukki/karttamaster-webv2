import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSegment, updateSegment, deleteSegment, getMarkersForSegment, validateNoOverlap } from '../logic/segments'
import { pushSegment, updateSegmentRemote, deleteSegmentRemote } from '../logic/segment-sync'
import type { Segment, SegmentStore, EquipmentItem } from '../logic/segments'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'

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

type CreationState =
  | { mode: 'idle' }
  | { mode: 'vaihe1' }
  | { mode: 'vaihe2'; routeId: string; startDist: number }
  | { mode: 'tiedot'; routeIds: string[]; startDist: number; endDist: number }

const STATUS_LABELS: Record<string, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu ✓',
  tarkistettu: 'Tarkistettu ✓',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

export class SegmentPanel {
  private readonly statusEl: HTMLElement
  private readonly listEl: HTMLUListElement
  private readonly titleEl: HTMLElement
  private readonly toggleBtn: HTMLButtonElement
  private state: CreationState = { mode: 'idle' }
  private segmentCount = 0
  private collapsed = true
  private activeModal: HTMLElement | null = null
  private creationModal: HTMLElement | null = null
  private escHandler: ((e: KeyboardEvent) => void) | null = null
  private creationEscHandler: ((e: KeyboardEvent) => void) | null = null

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
    this.segmentCount = this.store.size
    this.render()
  }

  isCreationMode(): boolean {
    return this.state.mode !== 'idle'
  }

  cancelCreation(): void {
    if (this.state.mode === 'idle') return
    this.state = { mode: 'idle' }
    this.statusEl.hidden = true
    this.closeCreationModal()
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

  private receivePoint(routeId: string, dist: number, lat: number, lon: number): void {
    if (this.state.mode === 'vaihe1') {
      this.state = { mode: 'vaihe2', routeId, startDist: dist }
      this.callbacks.onFirstPoint?.(lat, lon)
      this.updateCreationModalPhase()
      return
    }

    if (this.state.mode === 'vaihe2') {
      const first = this.state
      const startDist = Math.min(first.startDist, dist)
      const endDist = Math.max(first.startDist, dist)

      if (endDist - startDist < 1) {
        this.setCreationModalError('Pisteet liian lähellä — klikkaa kauempaa')
        return
      }

      if (!validateNoOverlap(this.store, first.routeId, startDist, endDist)) {
        this.setCreationModalError('Pätkä menee päällekkäin — valitse eri pisteet')
        return
      }

      const routeIds = [first.routeId]
      if (routeId !== first.routeId) routeIds.push(routeId)

      this.state = { mode: 'tiedot', routeIds, startDist, endDist }
      this.callbacks.onFirstPointClear?.()
      this.callbacks.onHideSnapMarkers?.()
      this.updateCreationModalPhase()
    }
  }

  private save(): void {}

  private resolveClick(lat: number, lon: number): { routeId: string; distanceFromStart: number; lat: number; lon: number } | null {
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
    return bestRouteId ? { routeId: bestRouteId, distanceFromStart: bestDistFromStart, lat: bestLat, lon: bestLon } : null
  }

  private applyCollapsed(): void {
    const count = this.store.size
    this.titleEl.textContent = this.collapsed ? `Pätkäjako (${count})` : 'Pätkäjako'
    this.toggleBtn.textContent = this.collapsed ? '▶' : '▼'
    this.listEl.hidden = this.collapsed
    if (this.collapsed) this.statusEl.hidden = true
  }

  private build(): { panel: HTMLElement; statusEl: HTMLElement; listEl: HTMLUListElement; titleEl: HTMLElement; toggleBtn: HTMLButtonElement } {
    const panel = document.createElement('div')
    panel.id = 'segment-panel'

    const header = document.createElement('div')
    header.className = 'segment-panel-header left-panel-section-header'
    header.addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.render()
    })

    const titleEl = document.createElement('h3')
    titleEl.textContent = 'Pätkäjako (0)'
    header.appendChild(titleEl)

    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'btn-segment-toggle'
    toggleBtn.setAttribute('aria-label', 'Näytä tai piilota pätkäjako')
    toggleBtn.textContent = '▶'
    toggleBtn.style.cssText = 'background:transparent;border:none;color:var(--text-muted);font-size:10px;padding:0 8px;min-height:44px;min-width:44px;cursor:pointer'
    header.appendChild(toggleBtn)

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
    this.callbacks.onShowSnapMarkers?.((routeId, dist, lat, lon) => this.onSnapClick(routeId, dist, lat, lon))
    this.openCreationModal()
  }

  private openCreationModal(): void {
    this.closeCreationModal()

    const backdrop = document.createElement('div')
    backdrop.className = 'segment-creation-modal-backdrop'
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.cancelCreation()
    })

    const modal = document.createElement('div')
    modal.className = 'segment-creation-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Luo uusi pätkä')
    modal.dataset.testid = 'creation-modal'

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.creationModal = backdrop

    this.creationEscHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.cancelCreation()
    }
    document.addEventListener('keydown', this.creationEscHandler)

    this.updateCreationModalPhase()
  }

  private updateCreationModalPhase(): void {
    const backdrop = this.creationModal
    if (!backdrop) return
    const modal = backdrop.querySelector('.segment-creation-modal') as HTMLElement
    if (!modal) return
    modal.innerHTML = ''

    // vaihe1/vaihe2: backdrop must not block map clicks — only tiedot needs full overlay
    const inMapPhase = this.state.mode === 'vaihe1' || this.state.mode === 'vaihe2'
    backdrop.dataset.phase = this.state.mode
    backdrop.style.pointerEvents = inMapPhase ? 'none' : 'all'
    modal.style.pointerEvents = 'all'

    const header = document.createElement('div')
    header.className = 'segment-creation-modal-header'
    const title = document.createElement('span')
    title.className = 'segment-creation-modal-title'
    title.textContent = 'Luo uusi pätkä'
    header.appendChild(title)
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'segment-creation-modal-cancel'
    cancelBtn.setAttribute('aria-label', 'Peruuta')
    cancelBtn.textContent = '✕'
    cancelBtn.addEventListener('click', () => this.cancelCreation())
    header.appendChild(cancelBtn)
    modal.appendChild(header)

    if (this.state.mode === 'vaihe1' || this.state.mode === 'vaihe2') {
      const step = this.state.mode === 'vaihe1' ? 1 : 2
      const progress = document.createElement('div')
      progress.className = 'segment-creation-progress'
      progress.innerHTML = `<span class="step ${step >= 1 ? 'active' : ''}">1</span><span class="step-sep">—</span><span class="step ${step >= 2 ? 'active' : ''}">2</span><span class="step-sep">—</span><span class="step">3</span>`
      modal.appendChild(progress)

      const instruction = document.createElement('p')
      instruction.className = 'segment-creation-instruction'
      instruction.textContent = step === 1 ? 'Klikkaa kartalta aloituspiste' : 'Klikkaa kartalta lopetuspiste'
      modal.appendChild(instruction)

      if (this.state.mode === 'vaihe2') {
        const info = document.createElement('p')
        info.className = 'segment-creation-info'
        info.textContent = `Aloituspiste: ${(this.state.startDist / 1000).toFixed(1)} km`
        modal.appendChild(info)
      }

      const errorEl = document.createElement('p')
      errorEl.className = 'segment-creation-error'
      errorEl.hidden = true
      errorEl.dataset.errorEl = 'true'
      modal.appendChild(errorEl)
    } else if (this.state.mode === 'tiedot') {
      const progress = document.createElement('div')
      progress.className = 'segment-creation-progress'
      progress.innerHTML = '<span class="step active">1</span><span class="step-sep">—</span><span class="step active">2</span><span class="step-sep">—</span><span class="step active">3</span>'
      modal.appendChild(progress)

      const { routeIds, startDist, endDist } = this.state

      const nameSection = document.createElement('div')
      nameSection.className = 'segment-creation-modal-section'
      const nameLabel = document.createElement('label')
      nameLabel.textContent = 'Pätkän nimi'
      nameSection.appendChild(nameLabel)
      const nameInput = document.createElement('input')
      nameInput.className = 'segment-creation-name-input'
      nameInput.type = 'text'
      this.segmentCount++
      nameInput.value = `Pätkä ${this.segmentCount}`
      nameInput.placeholder = 'Esim. Pätkä 1'
      nameSection.appendChild(nameInput)
      modal.appendChild(nameSection)

      const descSection = document.createElement('div')
      descSection.className = 'segment-creation-modal-section'
      const descLabel = document.createElement('label')
      descLabel.textContent = 'Järjestäjän ohjeet'
      descSection.appendChild(descLabel)
      const descInput = document.createElement('textarea')
      descInput.className = 'segment-creation-desc-input'
      descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
      descInput.rows = 3
      descSection.appendChild(descInput)
      modal.appendChild(descSection)

      const footer = document.createElement('div')
      footer.className = 'segment-creation-modal-footer'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'btn-segment-creation-save'
      saveBtn.textContent = 'Tallenna'
      saveBtn.addEventListener('click', () => {
        const displayName = nameInput.value.trim() || `Pätkä ${this.segmentCount}`
        const description = descInput.value.trim() || undefined
        const seg = createSegment(this.store, {
          routeIds,
          startDist,
          endDist,
          equipment: [],
          phase: 'asettaminen',
          displayName,
          description,
        })
        this.save()
        pushSegment(seg).catch(() => {})
        this.state = { mode: 'idle' }
        this.closeCreationModal()
        this.callbacks.onExitCreationMode?.()
        this.render()
        this.onUpdate()
      })
      footer.appendChild(saveBtn)

      const cancelFooterBtn = document.createElement('button')
      cancelFooterBtn.className = 'btn-segment-creation-cancel'
      cancelFooterBtn.textContent = 'Peruuta'
      cancelFooterBtn.addEventListener('click', () => this.cancelCreation())
      footer.appendChild(cancelFooterBtn)

      modal.appendChild(footer)
    }
  }

  private setCreationModalError(msg: string): void {
    const errorEl = this.creationModal?.querySelector('[data-error-el]') as HTMLElement | null
    if (errorEl) {
      errorEl.textContent = msg
      errorEl.hidden = false
    }
  }

  private closeCreationModal(): void {
    if (this.creationModal) {
      this.creationModal.remove()
      this.creationModal = null
    }
    if (this.creationEscHandler) {
      document.removeEventListener('keydown', this.creationEscHandler)
      this.creationEscHandler = null
    }
  }

  private render(): void {
    this.applyCollapsed()
    this.listEl.innerHTML = ''

    // Remove previous footer if exists
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
        this.listEl.appendChild(this.buildSegmentRow(seg))
      }
    }

    // Section footer — always rendered, visible when not collapsed
    if (!this.collapsed) {
      const footerBtn = document.createElement('button')
      footerBtn.id = 'btn-segment-create'
      footerBtn.className = 'btn-segment-footer'
      footerBtn.textContent = '+ Luo uusi pätkä'
      footerBtn.style.cssText = 'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'
      footerBtn.addEventListener('click', () => this.enterCreationMode())
      panel?.appendChild(footerBtn)
    }
  }

  private buildSegmentRow(seg: Segment): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-item'
    li.dataset.id = seg.id

    const info = document.createElement('span')
    info.className = 'segment-info'
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = name

    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    const startKm = (seg.startDist / 1000).toFixed(1)
    const endKm = (seg.endDist / 1000).toFixed(1)
    kmSpan.textContent = `${startKm}–${endKm} km`

    const detailsBtn = document.createElement('button')
    detailsBtn.className = 'btn-segment-details-open'
    detailsBtn.setAttribute('aria-label', `Avaa ${name} asetukset`)
    detailsBtn.textContent = '···'
    detailsBtn.addEventListener('click', () => this.openDetailsModal(seg))

    li.appendChild(info)
    li.appendChild(kmSpan)
    li.appendChild(detailsBtn)
    return li
  }

  openDetailsModal(seg: Segment): void {
    this.closeModal()

    const backdrop = document.createElement('div')
    backdrop.className = 'segment-details-modal-backdrop'
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal()
    })

    const modal = document.createElement('div')
    modal.className = 'segment-details-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Pätkän lisätiedot ja varusteet')

    // Header
    const header = document.createElement('div')
    header.className = 'segment-details-modal-header'

    const title = document.createElement('span')
    title.className = 'segment-details-modal-title'
    title.textContent = seg.displayName ?? 'Pätkän lisätiedot'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'segment-details-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.closeModal())
    header.appendChild(closeBtn)
    modal.appendChild(header)

    // Body
    const body = document.createElement('div')
    body.className = 'segment-details-modal-body'

    // (1) displayName
    const nameSection = document.createElement('div')
    nameSection.className = 'segment-details-modal-section'
    const nameLabel = document.createElement('label')
    nameLabel.className = 'segment-desc-label'
    nameLabel.textContent = 'Pätkän nimi'
    nameSection.appendChild(nameLabel)
    const nameInput = document.createElement('input')
    nameInput.className = 'segment-details-name-input'
    nameInput.type = 'text'
    nameInput.value = seg.displayName ?? ''
    nameInput.placeholder = 'Esim. Pätkä 1'
    const saveDisplayName = () => {
      const val = nameInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { displayName: val })
      this.save()
      updateSegmentRemote(seg.id, { displayName: val ?? null as unknown as string }).catch(() => {})
      title.textContent = val ?? 'Pätkän lisätiedot'
      this.render()
    }
    nameInput.addEventListener('blur', saveDisplayName)
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveDisplayName()
        nameInput.blur()
      }
    })
    nameSection.appendChild(nameInput)
    body.appendChild(nameSection)

    // (2) description
    const descSection = document.createElement('div')
    descSection.className = 'segment-details-modal-section'
    const descLabel = document.createElement('label')
    descLabel.className = 'segment-desc-label'
    descLabel.textContent = 'Järjestäjän ohjeet'
    descSection.appendChild(descLabel)
    const descInput = document.createElement('textarea')
    descInput.className = 'segment-desc-input'
    descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
    descInput.value = seg.description ?? ''
    descInput.rows = 3
    descInput.addEventListener('change', () => {
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      this.save()
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
    })
    descSection.appendChild(descInput)
    body.appendChild(descSection)

    // (3) markers readonly list
    const allMarkers = this.callbacks.getMarkers?.() ?? []
    const segMarkers = getMarkersForSegment(seg, allMarkers)
    if (segMarkers.length > 0) {
      const markerSection = document.createElement('div')
      markerSection.className = 'segment-details-modal-section'
      const markerTitle = document.createElement('p')
      markerTitle.className = 'segment-equipment-title'
      markerTitle.textContent = `Merkit pätkällä (${segMarkers.length}):`
      markerSection.appendChild(markerTitle)
      const markerList = document.createElement('ul')
      markerList.className = 'segment-details-marker-list'
      const sorted = [...segMarkers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
      for (const m of sorted) {
        const li = document.createElement('li')
        li.className = 'segment-details-marker-item'
        const km = (m.distanceFromStart / 1000).toFixed(1)
        const typeLabel = TYPE_LABELS[m.type] ?? m.type
        const statusLabel = STATUS_LABELS[m.status] ?? m.status
        const info = document.createElement('span')
        info.className = 'segment-details-marker-info'
        info.textContent = `${km} km — ${typeLabel}`
        li.appendChild(info)
        const badge = document.createElement('span')
        badge.className = `segment-details-marker-status status-${m.status}`
        badge.textContent = statusLabel
        li.appendChild(badge)
        markerList.appendChild(li)
      }
      markerSection.appendChild(markerList)
      body.appendChild(markerSection)
    }

    // (4) equipment
    body.appendChild(this.buildEquipmentSection(seg))

    // (5) assign — talkoolaisen linkki
    body.appendChild(this.buildAssignSectionModal(seg))

    // (6) muokkaa pisteitä
    const editPtsSection = document.createElement('div')
    editPtsSection.className = 'segment-details-modal-section'
    const editPtsBtn = document.createElement('button')
    editPtsBtn.className = 'btn-segment-edit-pts-modal'
    editPtsBtn.textContent = 'Muokkaa pisteitä kartalla'
    editPtsBtn.addEventListener('click', () => {
      this.closeModal()
      this.callbacks.onEnterEditMode?.(seg, (startDist, endDist) => {
        updateSegment(this.store, seg.id, { startDist, endDist })
        this.save()
        updateSegmentRemote(seg.id, { startDist, endDist }).catch(() => {})
        this.render()
        this.onUpdate()
      })
    })
    editPtsSection.appendChild(editPtsBtn)
    body.appendChild(editPtsSection)

    modal.appendChild(body)

    // Footer — tallenna muutokset
    const footer = document.createElement('div')
    footer.className = 'segment-details-modal-footer'
    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn-segment-modal-save'
    saveBtn.textContent = 'Tallenna muutokset'
    saveBtn.addEventListener('click', () => {
      saveDisplayName()
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      this.save()
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
      this.closeModal()
      this.onUpdate()
    })
    footer.appendChild(saveBtn)
    modal.appendChild(footer)

    // Danger zone — poisto (pienempi, varmistus)
    const dangerZone = document.createElement('div')
    dangerZone.className = 'segment-modal-danger-zone'
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete-modal'
    deleteBtn.textContent = 'Poista pätkä'
    deleteBtn.addEventListener('click', () => {
      const name = seg.displayName ?? seg.id.slice(0, 6)
      if (!confirm(`Poistetaanko pätkä "${name}"? Toimintoa ei voi peruuttaa.`)) return
      this.closeModal()
      this.callbacks.onExitEditMode?.()
      deleteSegment(this.store, seg.id)
      this.save()
      deleteSegmentRemote(seg.id).catch(() => {})
      this.render()
      this.onUpdate()
    })
    dangerZone.appendChild(deleteBtn)
    modal.appendChild(dangerZone)

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.activeModal = backdrop

    // Escape closes
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeModal()
    }
    document.addEventListener('keydown', this.escHandler)
  }

  private closeModal(): void {
    if (this.activeModal) {
      this.activeModal.remove()
      this.activeModal = null
    }
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler)
      this.escHandler = null
    }
  }

  private buildEquipmentSection(seg: Segment): HTMLElement {
    const container = document.createElement('div')
    container.className = 'segment-details-modal-section'

    // Auto-count from markers
    const allMarkers = this.callbacks.getMarkers?.() ?? []
    const segMarkers = getMarkersForSegment(seg, allMarkers)
    if (segMarkers.length > 0) {
      const counts = new Map<string, number>()
      for (const m of segMarkers) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
      const autoTitle = document.createElement('p')
      autoTitle.className = 'segment-equipment-title'
      autoTitle.textContent = 'Merkit pätkällä (automaattinen):'
      container.appendChild(autoTitle)
      const autoList = document.createElement('ul')
      autoList.className = 'segment-equipment-auto-list'
      for (const [type, count] of counts) {
        const li = document.createElement('li')
        li.textContent = `${count}× ${type}`
        autoList.appendChild(li)
      }
      container.appendChild(autoList)
    }

    // Manual items
    const manualTitle = document.createElement('p')
    manualTitle.className = 'segment-equipment-title'
    manualTitle.textContent = 'Lisävarusteet:'
    container.appendChild(manualTitle)

    const listEl = document.createElement('ul')
    listEl.className = 'segment-equipment-manual-list'
    container.appendChild(listEl)

    const renderList = (items: EquipmentItem[]) => {
      listEl.innerHTML = ''
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const li = document.createElement('li')
        li.className = 'segment-equipment-item'

        const countInput = document.createElement('input')
        countInput.type = 'number'
        countInput.min = '1'
        countInput.value = String(item.count)
        countInput.className = 'equipment-count-input'
        countInput.addEventListener('change', () => {
          const newCount = Math.max(1, parseInt(countInput.value) || 1)
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])]
          updated[i] = { ...updated[i], count: newCount }
          updateSegment(this.store, seg.id, { equipment: updated })
          this.save()
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
        })
        li.appendChild(countInput)

        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.value = item.name
        nameInput.className = 'equipment-name-input'
        nameInput.placeholder = 'esim. nauhaa'
        nameInput.addEventListener('change', () => {
          const newName = nameInput.value.trim()
          if (!newName) return
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])]
          updated[i] = { ...updated[i], name: newName }
          updateSegment(this.store, seg.id, { equipment: updated })
          this.save()
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
        })
        li.appendChild(nameInput)

        const removeBtn = document.createElement('button')
        removeBtn.className = 'btn-equipment-remove'
        removeBtn.textContent = '✕'
        removeBtn.addEventListener('click', () => {
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])].filter((_, idx) => idx !== i)
          updateSegment(this.store, seg.id, { equipment: updated })
          this.save()
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
          renderList(updated)
        })
        li.appendChild(removeBtn)
        listEl.appendChild(li)
      }
    }

    renderList(seg.equipment)

    const addRow = document.createElement('div')
    addRow.className = 'segment-equipment-add'

    const countInput = document.createElement('input')
    countInput.type = 'number'
    countInput.min = '1'
    countInput.value = '1'
    countInput.className = 'equipment-count-input'
    countInput.placeholder = 'kpl'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'equipment-name-input'
    nameInput.placeholder = 'esim. nauhaa'

    const addBtn = document.createElement('button')
    addBtn.className = 'btn-equipment-add'
    addBtn.textContent = '+ Lisää'
    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim()
      if (!name) return
      const count = Math.max(1, parseInt(countInput.value) || 1)
      const current = this.store.get(seg.id)?.equipment ?? []
      const updated = [...current, { name, count }]
      updateSegment(this.store, seg.id, { equipment: updated })
      this.save()
      updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
      nameInput.value = ''
      countInput.value = '1'
      renderList(updated)
    })

    addRow.appendChild(countInput)
    addRow.appendChild(nameInput)
    addRow.appendChild(addBtn)
    container.appendChild(addRow)

    return container
  }

  private buildAssignSectionModal(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const title = document.createElement('p')
    title.className = 'segment-equipment-title'
    title.textContent = 'Talkoolaisen linkki:'
    section.appendChild(title)

    const errorEl = document.createElement('p')
    errorEl.className = 'assign-error'
    errorEl.hidden = true

    if (seg.assignedCode) {
      const url = `/s/${seg.assignedCode}`
      const row = document.createElement('div')
      row.className = 'segment-assign-modal-row'

      const urlSpan = document.createElement('span')
      urlSpan.className = 'segment-url'
      urlSpan.textContent = url
      row.appendChild(urlSpan)

      const copyBtn = document.createElement('button')
      copyBtn.className = 'btn-copy-url'
      copyBtn.textContent = '📋 Kopioi'
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${window.location.origin}${url}`).catch(() => {})
      })
      row.appendChild(copyBtn)

      const editBtn = document.createElement('button')
      editBtn.className = 'btn-assign-edit'
      editBtn.textContent = 'Muuta'
      editBtn.addEventListener('click', async () => {
        errorEl.hidden = true
        try {
          const resp = await fetch(`/api/admin/codes/${seg.assignedCode!}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('delete_failed')
          updateSegment(this.store, seg.id, { assignedCode: undefined })
          this.save()
          updateSegmentRemote(seg.id, { assignedCode: null as unknown as string }).catch(() => {})
          this.closeModal()
          this.render()
        } catch {
          errorEl.textContent = 'Virhe poistettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })
      row.appendChild(editBtn)
      section.appendChild(row)
    } else {
      const form = document.createElement('div')
      form.className = 'segment-assign-modal-form'

      const codeInput = document.createElement('input')
      codeInput.className = 'input-assign-code'
      codeInput.placeholder = 'Koodi'
      codeInput.setAttribute('aria-label', 'Talkoolaisen koodi')

      const saveBtn = document.createElement('button')
      saveBtn.className = 'btn-assign-save'
      saveBtn.textContent = 'Tallenna linkki'
      saveBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim()
        if (!code) return
        errorEl.hidden = true
        try {
          const resp = await fetch('/api/admin/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, display_name: seg.displayName ?? code, segment_id: seg.id }),
          })
          if (!resp.ok) throw new Error('save_failed')
          updateSegment(this.store, seg.id, { assignedCode: code })
          this.save()
          updateSegmentRemote(seg.id, { assignedCode: code }).catch(() => {})
          this.closeModal()
          this.render()
          this.onUpdate()
        } catch {
          errorEl.textContent = 'Virhe tallennettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })

      form.appendChild(codeInput)
      form.appendChild(saveBtn)
      section.appendChild(form)
    }

    section.appendChild(errorEl)
    return section
  }
}
