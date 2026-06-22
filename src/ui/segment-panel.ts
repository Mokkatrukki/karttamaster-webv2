import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSegment, updateSegment, deleteSegment, getMarkersForSegment, getSegmentProgress } from '../logic/segments'
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
}

type CreationState =
  | { mode: 'idle' }
  | { mode: 'first-click' }
  | { mode: 'second-click'; routeId: string; startDist: number }

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
  private escHandler: ((e: KeyboardEvent) => void) | null = null

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
    this.applyCollapsed()
    this.callbacks.onFirstPointClear?.()
  }

  onMapClick(lat: number, lon: number): void {
    if (this.state.mode === 'idle') return

    const resolved = this.resolveClick(lat, lon)
    if (!resolved) return

    if (this.state.mode === 'first-click') {
      this.state = { mode: 'second-click', routeId: resolved.routeId, startDist: resolved.distanceFromStart }
      this.statusEl.textContent = 'Klikkaa reittiä: 2. piste'
      this.callbacks.onFirstPoint?.(resolved.lat, resolved.lon)
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
      const seg = createSegment(this.store, {
        routeIds,
        startDist,
        endDist,
        equipment: [],
        phase: 'asettaminen',
        displayName: `Pätkä ${this.segmentCount}`,
      })
      this.save()
      pushSegment(seg).catch(() => {})

      this.state = { mode: 'idle' }
      this.statusEl.hidden = true
      this.callbacks.onFirstPointClear?.()
      this.render()
      this.onUpdate()
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
    header.className = 'segment-panel-header'
    header.style.cursor = 'pointer'
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#btn-segment-create')) return
      this.collapsed = !this.collapsed
      this.applyCollapsed()
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

    return { panel, statusEl, listEl, titleEl, toggleBtn }
  }

  private enterCreationMode(): void {
    this.collapsed = false
    this.applyCollapsed()
    this.state = { mode: 'first-click' }
    this.statusEl.hidden = false
    this.statusEl.textContent = 'Klikkaa reittiä: 1. piste'
  }

  private render(): void {
    this.applyCollapsed()
    this.listEl.innerHTML = ''
    const segments = Array.from(this.store.values())
    if (segments.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-empty'
      empty.textContent = 'Ei pätkiä — luo ensimmäinen'
      this.listEl.appendChild(empty)
      return
    }
    const markers = this.callbacks.getMarkers?.() ?? []
    for (const seg of segments) {
      this.listEl.appendChild(this.buildSegmentRow(seg, markers))
    }
  }

  private buildSegmentRow(seg: Segment, markers: SignMarker[] = []): HTMLLIElement {
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
    info.textContent = name
    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    kmSpan.textContent = `${startKm}–${endKm} km`
    info.appendChild(kmSpan)
    if (markers.length > 0) {
      const progress = getSegmentProgress(seg, markers)
      const progressSpan = document.createElement('span')
      progressSpan.className = 'segment-progress'
      progressSpan.textContent = `${progress}%`
      progressSpan.style.cssText = 'font-size:11px;color:var(--text-muted);margin-left:4px'
      info.appendChild(progressSpan)
    }
    main.appendChild(info)

    const editPtsBtn = document.createElement('button')
    editPtsBtn.className = 'btn-segment-edit-pts'
    editPtsBtn.title = 'Siirrä aloitus- ja lopetuspistettä'
    editPtsBtn.textContent = 'Muokkaa pisteitä'
    editPtsBtn.addEventListener('click', () => {
      this.callbacks.onEnterEditMode?.(seg, (startDist, endDist) => {
        updateSegment(this.store, seg.id, { startDist, endDist })
        this.save()
        updateSegmentRemote(seg.id, { startDist, endDist }).catch(() => {})
        this.render()
        this.onUpdate()
      })
    })
    main.appendChild(editPtsBtn)

    const detailsBtn = document.createElement('button')
    detailsBtn.className = 'btn-segment-details-open'
    detailsBtn.textContent = 'Lisätiedot & varusteet'
    detailsBtn.setAttribute('aria-label', 'Avaa lisätiedot ja varusteet')
    detailsBtn.addEventListener('click', () => this.openDetailsModal(seg))
    main.appendChild(detailsBtn)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', () => {
      this.callbacks.onExitEditMode?.()
      deleteSegment(this.store, seg.id)
      this.save()
      deleteSegmentRemote(seg.id).catch(() => {})
      this.render()
      this.onUpdate()
    })
    main.appendChild(deleteBtn)
    li.appendChild(main)

    li.appendChild(this.buildAssignSection(seg))

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

    modal.appendChild(body)
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

  private buildAssignSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-assign'

    const errorEl = document.createElement('p')
    errorEl.className = 'assign-error'
    errorEl.hidden = true

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
      editBtn.addEventListener('click', async () => {
        const codeToDelete = seg.assignedCode!
        errorEl.hidden = true
        try {
          const resp = await fetch(`/api/admin/codes/${codeToDelete}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('delete_failed')
          updateSegment(this.store, seg.id, { assignedCode: undefined })
          this.save()
          updateSegmentRemote(seg.id, { assignedCode: null as unknown as string }).catch(() => {})
          this.render()
        } catch {
          errorEl.textContent = 'Virhe poistettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })
      section.appendChild(editBtn)
      section.appendChild(errorEl)
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
      saveBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim()
        if (!code) return
        const displayName = nameInput.value.trim() || seg.displayName
        errorEl.hidden = true
        try {
          const resp = await fetch('/api/admin/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, display_name: displayName ?? code, segment_id: seg.id }),
          })
          if (!resp.ok) throw new Error('save_failed')
          updateSegment(this.store, seg.id, { assignedCode: code, displayName })
          this.save()
          const updated = this.store.get(seg.id)
          if (updated) updateSegmentRemote(seg.id, { assignedCode: code, displayName }).catch(() => {})
          this.render()
          this.onUpdate()
        } catch {
          errorEl.textContent = 'Virhe tallennettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })

      section.appendChild(codeInput)
      section.appendChild(nameInput)
      section.appendChild(saveBtn)
      section.appendChild(errorEl)
    }

    return section
  }
}
