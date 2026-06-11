import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSegment, updateSegment, deleteSegment } from '../logic/segments'
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

export class SegmentPanel {
  private readonly statusEl: HTMLElement
  private readonly listEl: HTMLUListElement
  private state: CreationState = { mode: 'idle' }
  private segmentCount = 0
  private expandedDetails = new Set<string>()

  constructor(
    container: HTMLElement,
    private readonly routes: RouteConfig[],
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
    private readonly callbacks: SegmentPanelCallbacks = {},
  ) {
    const { panel, statusEl, listEl } = this.build()
    this.statusEl = statusEl
    this.listEl = listEl
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
    info.textContent = name
    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    kmSpan.textContent = `${startKm}–${endKm} km`
    info.appendChild(kmSpan)
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

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', () => {
      this.callbacks.onExitEditMode?.()
      this.expandedDetails.delete(seg.id)
      deleteSegment(this.store, seg.id)
      this.save()
      deleteSegmentRemote(seg.id).catch(() => {})
      this.render()
      this.onUpdate()
    })
    main.appendChild(deleteBtn)
    li.appendChild(main)

    li.appendChild(this.buildDetailsSection(seg))
    li.appendChild(this.buildAssignSection(seg))

    return li
  }

  private buildDetailsSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details'

    const toggle = document.createElement('button')
    toggle.className = 'btn-segment-details-toggle'
    toggle.textContent = 'Lisätiedot & varusteet ▸'
    toggle.setAttribute('aria-expanded', 'false')

    const body = document.createElement('div')
    body.className = 'segment-details-body'
    const isExpanded = this.expandedDetails.has(seg.id)
    body.hidden = !isExpanded
    toggle.textContent = isExpanded ? 'Lisätiedot & varusteet ▾' : 'Lisätiedot & varusteet ▸'
    toggle.setAttribute('aria-expanded', String(isExpanded))

    toggle.addEventListener('click', () => {
      const open = body.hidden
      body.hidden = !open
      toggle.textContent = open ? 'Lisätiedot & varusteet ▾' : 'Lisätiedot & varusteet ▸'
      toggle.setAttribute('aria-expanded', String(open))
      if (open) this.expandedDetails.add(seg.id)
      else this.expandedDetails.delete(seg.id)
    })

    // Description field
    const descLabel = document.createElement('label')
    descLabel.className = 'segment-desc-label'
    descLabel.textContent = 'Järjestäjän ohjeet'
    body.appendChild(descLabel)

    const descInput = document.createElement('textarea')
    descInput.className = 'segment-desc-input'
    descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
    descInput.value = seg.description ?? ''
    descInput.rows = 2
    descInput.addEventListener('change', () => {
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      this.save()
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
    })
    body.appendChild(descInput)

    // Equipment auto-count (from markers if available)
    const markers = this.callbacks.getMarkers?.() ?? []
    body.appendChild(this.buildEquipmentAutoSection(seg, markers))

    // Manual equipment items
    body.appendChild(this.buildEquipmentManualSection(seg))

    section.appendChild(toggle)
    section.appendChild(body)
    return section
  }

  private buildEquipmentAutoSection(seg: Segment, allMarkers: SignMarker[]): HTMLElement {
    const container = document.createElement('div')
    container.className = 'segment-equipment-auto'

    if (allMarkers.length === 0) return container

    // Count markers for this segment by type
    const { routeIds, startDist, endDist } = seg
    const routeSet = new Set(routeIds)
    const segMarkers = allMarkers.filter(
      m => m.routeIds.some(r => routeSet.has(r)) &&
           m.distanceFromStart >= startDist &&
           m.distanceFromStart <= endDist,
    )
    if (segMarkers.length === 0) return container

    const counts = new Map<string, number>()
    for (const m of segMarkers) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)

    const title = document.createElement('p')
    title.className = 'segment-equipment-title'
    title.textContent = 'Merkit pätkällä (automaattinen):'
    container.appendChild(title)

    const list = document.createElement('ul')
    list.className = 'segment-equipment-auto-list'
    for (const [type, count] of counts) {
      const li = document.createElement('li')
      li.textContent = `${count}× ${type}`
      list.appendChild(li)
    }
    container.appendChild(list)
    return container
  }

  private buildEquipmentManualSection(seg: Segment): HTMLElement {
    const container = document.createElement('div')
    container.className = 'segment-equipment-manual'

    const title = document.createElement('p')
    title.className = 'segment-equipment-title'
    title.textContent = 'Lisävarusteet:'
    container.appendChild(title)

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
          // Sync updated segment (with code) to backend
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
