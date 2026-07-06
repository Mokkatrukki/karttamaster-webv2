import { updateSegment, deleteSegment, getMarkersForSegment, cloneSegmentToNextPhase, NEXT_PHASE } from '../logic/segments'
import { updateSegmentRemote, deleteSegmentRemote, pushSegment } from '../logic/segment-sync'
import type { Segment, SegmentStore, EquipmentItem } from '../logic/segments'
import type { SignMarker } from '../logic/types'
import { registerEscClose, createBackdrop } from './modal-helpers'

const STATUS_LABELS: Record<string, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu ✓',
  tarkistettu: 'Tarkistettu ✓',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const PHASE_LABELS: Record<Segment['phase'], string> = {
  asettaminen: 'asetus',
  tarkastus: 'tarkastus',
  purku: 'purku',
}

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

export interface SegmentDetailsCallbacks {
  getMarkers?: () => SignMarker[]
  onEnterEditMode?: (seg: Segment, onSave: (startDist: number, endDist: number) => void) => void
  onExitEditMode?: () => void
}

export class SegmentDetailsModal {
  private backdrop: HTMLElement | null = null
  private unregEsc: (() => void) | null = null

  constructor(
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
    private readonly onRender: () => void,
    private readonly callbacks: SegmentDetailsCallbacks = {},
  ) {}

  open(seg: Segment): void {
    this.close()

    const backdrop = createBackdrop('segment-details-modal-backdrop', () => this.close())

    const modal = document.createElement('div')
    modal.className = 'segment-details-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Pätkän lisätiedot ja varusteet')

    // Title element — updated in-place by name save
    const titleEl = document.createElement('span')
    titleEl.className = 'segment-details-modal-title'
    titleEl.textContent = seg.displayName ?? 'Pätkän lisätiedot'

    modal.appendChild(this.buildHeader(titleEl, () => this.close()))

    const { body, saveAll } = this.buildBody(seg, titleEl)
    modal.appendChild(body)
    modal.appendChild(this.buildSaveFooter(seg, saveAll))
    modal.appendChild(this.buildDangerZone(seg))

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.backdrop = backdrop
    this.unregEsc = registerEscClose(() => this.close())
  }

  close(): void {
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }

  private buildHeader(titleEl: HTMLElement, onClose: () => void): HTMLElement {
    const header = document.createElement('div')
    header.className = 'segment-details-modal-header'
    header.appendChild(titleEl)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'segment-details-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', onClose)
    header.appendChild(closeBtn)

    return header
  }

  private buildBody(
    seg: Segment,
    titleEl: HTMLElement,
  ): { body: HTMLElement; saveAll: () => void } {
    const body = document.createElement('div')
    body.className = 'segment-details-modal-body'

    // (1) displayName
    const { section: nameSection, saveDisplayName } = this.buildNameSection(seg, titleEl)
    body.appendChild(nameSection)

    // (2) description
    const { section: descSection, descInput } = this.buildDescSection(seg)
    body.appendChild(descSection)

    // (3) markers
    const allMarkers = this.callbacks.getMarkers?.() ?? []
    const segMarkers = getMarkersForSegment(seg, allMarkers)
    if (segMarkers.length > 0) {
      body.appendChild(this.buildMarkersSection(segMarkers))
    }

    // (4) equipment
    body.appendChild(this.buildEquipmentSection(seg))

    // (5) assign link
    body.appendChild(this.buildAssignSection(seg))

    // (6) edit points
    body.appendChild(this.buildEditPointsSection(seg))

    // (7) T146: kloonaa seuraavaan vaiheeseen
    body.appendChild(this.buildCloneSection(seg))

    const saveAll = () => {
      saveDisplayName()
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
    }

    return { body, saveAll }
  }

  private buildNameSection(
    seg: Segment,
    titleEl: HTMLElement,
  ): { section: HTMLElement; nameInput: HTMLInputElement; saveDisplayName: () => void } {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const label = document.createElement('label')
    label.className = 'segment-desc-label'
    label.textContent = 'Pätkän nimi'
    section.appendChild(label)

    const nameInput = document.createElement('input')
    nameInput.className = 'segment-details-name-input'
    nameInput.type = 'text'
    nameInput.value = seg.displayName ?? ''
    nameInput.placeholder = 'Esim. Pätkä 1'
    section.appendChild(nameInput)

    const saveDisplayName = () => {
      const val = nameInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { displayName: val })
      updateSegmentRemote(seg.id, { displayName: val ?? null as unknown as string }).catch(() => {})
      titleEl.textContent = val ?? 'Pätkän lisätiedot'
      this.onRender()
    }
    nameInput.addEventListener('blur', saveDisplayName)
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveDisplayName(); nameInput.blur() }
    })

    return { section, nameInput, saveDisplayName }
  }

  private buildDescSection(
    seg: Segment,
  ): { section: HTMLElement; descInput: HTMLTextAreaElement } {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const label = document.createElement('label')
    label.className = 'segment-desc-label'
    label.textContent = 'Järjestäjän ohjeet'
    section.appendChild(label)

    const descInput = document.createElement('textarea')
    descInput.className = 'segment-desc-input'
    descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
    descInput.value = seg.description ?? ''
    descInput.rows = 3
    descInput.addEventListener('change', () => {
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
    })
    section.appendChild(descInput)

    return { section, descInput }
  }

  private buildMarkersSection(segMarkers: SignMarker[]): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const title = document.createElement('p')
    title.className = 'segment-equipment-title'
    title.textContent = `Merkit pätkällä (${segMarkers.length}):`
    section.appendChild(title)

    const list = document.createElement('ul')
    list.className = 'segment-details-marker-list'
    const sorted = [...segMarkers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    for (const m of sorted) {
      const li = document.createElement('li')
      li.className = 'segment-details-marker-item'
      const info = document.createElement('span')
      info.className = 'segment-details-marker-info'
      info.textContent = `${(m.distanceFromStart / 1000).toFixed(1)} km — ${TYPE_LABELS[m.type] ?? m.type}`
      li.appendChild(info)
      const badge = document.createElement('span')
      badge.className = `segment-details-marker-status status-${m.status}`
      badge.textContent = STATUS_LABELS[m.status] ?? m.status
      li.appendChild(badge)
      list.appendChild(li)
    }
    section.appendChild(list)
    return section
  }

  private buildEquipmentSection(seg: Segment): HTMLElement {
    const container = document.createElement('div')
    container.className = 'segment-details-modal-section'

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
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
        })
        li.appendChild(nameInput)

        const removeBtn = document.createElement('button')
        removeBtn.className = 'btn-equipment-remove'
        removeBtn.textContent = '✕'
        removeBtn.addEventListener('click', () => {
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])].filter((_, idx) => idx !== i)
          updateSegment(this.store, seg.id, { equipment: updated })
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
          updateSegmentRemote(seg.id, { assignedCode: null as unknown as string }).catch(() => {})
          this.close()
          this.onRender()
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
          updateSegmentRemote(seg.id, { assignedCode: code }).catch(() => {})
          this.close()
          this.onRender()
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

  private buildEditPointsSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const btn = document.createElement('button')
    btn.className = 'btn-segment-edit-pts-modal'
    btn.textContent = 'Muokkaa pisteitä kartalla'
    btn.addEventListener('click', () => {
      this.close()
      this.callbacks.onEnterEditMode?.(seg, (startDist, endDist) => {
        updateSegment(this.store, seg.id, { startDist, endDist })
        updateSegmentRemote(seg.id, { startDist, endDist }).catch(() => {})
        this.onRender()
        this.onUpdate()
      })
    })
    section.appendChild(btn)
    return section
  }

  private buildCloneSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const nextPhase = NEXT_PHASE[seg.phase]
    const btn = document.createElement('button')
    btn.className = 'btn-segment-clone-phase'
    btn.textContent = `Kloonaa ${PHASE_LABELS[nextPhase]}-vaiheeseen`
    btn.addEventListener('click', () => {
      // T151/V95: overlap kohde-phasessa → null (esim. tuplaklikki) → älä luo, näytä virhe
      const cloned = cloneSegmentToNextPhase(this.store, seg)
      if (!cloned) {
        btn.textContent = `${PHASE_LABELS[nextPhase]}-vaiheessa on jo tämä pätkä`
        btn.disabled = true
        return
      }
      pushSegment(cloned).catch(() => {})
      this.close()
      this.onRender()
      this.onUpdate()
    })
    section.appendChild(btn)
    return section
  }

  private buildSaveFooter(_seg: Segment, saveAll: () => void): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'segment-details-modal-footer'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn-segment-modal-save'
    saveBtn.textContent = 'Tallenna muutokset'
    saveBtn.addEventListener('click', () => {
      saveAll()
      this.close()
      this.onUpdate()
    })
    footer.appendChild(saveBtn)
    return footer
  }

  private buildDangerZone(seg: Segment): HTMLElement {
    const dangerZone = document.createElement('div')
    dangerZone.className = 'segment-modal-danger-zone'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete-modal'
    deleteBtn.textContent = 'Poista pätkä'
    deleteBtn.addEventListener('click', () => {
      const name = seg.displayName ?? seg.id.slice(0, 6)
      if (!confirm(`Poistetaanko pätkä "${name}"? Toimintoa ei voi peruuttaa.`)) return
      this.close()
      this.callbacks.onExitEditMode?.()
      deleteSegment(this.store, seg.id)
      deleteSegmentRemote(seg.id).catch(() => {})
      this.onRender()
      this.onUpdate()
    })
    dangerZone.appendChild(deleteBtn)
    return dangerZone
  }
}
