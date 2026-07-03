import { bulkCollect } from '../logic/segment-actions'
import { isTerminal } from '../logic/marker-status'
import type { Segment } from '../logic/segments'
import type { SignMarker } from '../logic/types'

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

const STATUS_LABELS: Record<string, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu ✓',
  tarkistettu: 'Tarkistettu ✓',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

export class SegmentView {
  private readonly markerListEl: HTMLUListElement
  private readonly bulkBtn: HTMLButtonElement
  private readonly equipmentSection: HTMLElement
  private readonly inspectSection: HTMLElement
  private readonly inspectBtn: HTMLButtonElement
  private readonly inspectNoteInput: HTMLTextAreaElement
  private readonly inspectStatus: HTMLElement
  private currentMarkers: SignMarker[] = []

  constructor(
    container: HTMLElement,
    private segment: Segment,
    private readonly onBulkCollect?: (updated: SignMarker[]) => void,
    private readonly onInspect?: (inspected: boolean, note: string) => void,
  ) {
    const { panel, markerListEl, bulkBtn, equipmentSection, inspectSection, inspectBtn, inspectNoteInput, inspectStatus } = this.build()
    this.markerListEl = markerListEl
    this.bulkBtn = bulkBtn
    this.equipmentSection = equipmentSection
    this.inspectSection = inspectSection
    this.inspectBtn = inspectBtn
    this.inspectNoteInput = inspectNoteInput
    this.inspectStatus = inspectStatus
    container.appendChild(panel)
    this.renderInspectSection()
  }

  update(markers: SignMarker[], segment?: Segment): void {
    if (segment) this.segment = segment
    this.currentMarkers = markers
    this.renderMarkers(markers)
    this.updateBulkBtn(markers)
    this.renderEquipment(markers)
    this.renderInspectSection()
  }

  private updateBulkBtn(markers: SignMarker[]): void {
    const hasNonTerminal = markers.some(m => !isTerminal(m.status))
    this.bulkBtn.hidden = this.segment.phase !== 'purku' || !hasNonTerminal
  }

  // T147: tarkastus-phase — kevyt läpiajo, vapaateksti-huomio, ei per-merkki-kuittausta
  private renderInspectSection(): void {
    const isInspectionPhase = this.segment.phase === 'tarkastus'
    this.inspectSection.hidden = !isInspectionPhase
    if (!isInspectionPhase) return

    const inspected = this.segment.inspected ?? false
    this.inspectNoteInput.value = this.segment.inspectionNote ?? ''
    this.inspectStatus.textContent = inspected ? 'Tarkastettu ✓' : 'Ei vielä tarkastettu'
    this.inspectBtn.textContent = inspected ? 'Merkitse tarkastamattomaksi' : 'Merkitse tarkastetuksi'
  }

  private build(): {
    panel: HTMLElement
    markerListEl: HTMLUListElement
    bulkBtn: HTMLButtonElement
    equipmentSection: HTMLElement
    inspectSection: HTMLElement
    inspectBtn: HTMLButtonElement
    inspectNoteInput: HTMLTextAreaElement
    inspectStatus: HTMLElement
  } {
    const panel = document.createElement('div')
    panel.id = 'segment-view'

    const header = document.createElement('div')
    header.className = 'segment-view-header'

    const name = document.createElement('span')
    name.className = 'segment-view-name'
    name.textContent = this.segment.displayName ?? 'Pätkäsi'
    header.appendChild(name)

    const range = document.createElement('span')
    range.className = 'segment-view-range'
    const startKm = (this.segment.startDist / 1000).toFixed(1)
    const endKm = (this.segment.endDist / 1000).toFixed(1)
    range.textContent = `${startKm}–${endKm} km`
    header.appendChild(range)

    panel.appendChild(header)

    if (this.segment.description) {
      const desc = document.createElement('p')
      desc.className = 'segment-view-desc'
      desc.textContent = this.segment.description
      panel.appendChild(desc)
    }

    const equipmentSection = document.createElement('div')
    equipmentSection.className = 'segment-view-equipment'
    panel.appendChild(equipmentSection)

    const bulkBtn = document.createElement('button')
    bulkBtn.className = 'btn-bulk-collect'
    bulkBtn.textContent = '✓ Merkitse kaikki kerätyksi'
    bulkBtn.hidden = true
    bulkBtn.addEventListener('click', () => {
      const updated = bulkCollect(this.segment, this.currentMarkers)
      if (updated.length > 0) this.onBulkCollect?.(updated)
    })
    panel.appendChild(bulkBtn)

    const inspectSection = document.createElement('div')
    inspectSection.className = 'segment-view-inspect'
    inspectSection.hidden = true

    const inspectStatus = document.createElement('p')
    inspectStatus.className = 'segment-view-inspect-status'
    inspectSection.appendChild(inspectStatus)

    const inspectNoteInput = document.createElement('textarea')
    inspectNoteInput.className = 'segment-view-inspect-note'
    inspectNoteInput.placeholder = 'Huomiot (esim. "puu kaatunut polulla")'
    inspectNoteInput.rows = 3
    inspectSection.appendChild(inspectNoteInput)

    const inspectBtn = document.createElement('button')
    inspectBtn.className = 'btn-mark-inspected'
    inspectBtn.addEventListener('click', () => {
      const nowInspected = !(this.segment.inspected ?? false)
      this.onInspect?.(nowInspected, inspectNoteInput.value.trim())
    })
    inspectSection.appendChild(inspectBtn)

    panel.appendChild(inspectSection)

    const markerListEl = document.createElement('ul')
    markerListEl.className = 'segment-view-list'
    panel.appendChild(markerListEl)

    return { panel, markerListEl, bulkBtn, equipmentSection, inspectSection, inspectBtn, inspectNoteInput, inspectStatus }
  }

  private renderEquipment(markers: SignMarker[]): void {
    this.equipmentSection.innerHTML = ''

    // Auto-count: markers per type
    const counts = new Map<string, number>()
    for (const m of markers) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)

    const hasAuto = counts.size > 0
    const hasManual = this.segment.equipment.length > 0

    if (!hasAuto && !hasManual) return

    const title = document.createElement('p')
    title.className = 'segment-view-equipment-title'
    title.textContent = 'Varusteet:'
    this.equipmentSection.appendChild(title)

    const list = document.createElement('ul')
    list.className = 'segment-view-equipment-list'

    if (hasAuto) {
      for (const [type, count] of counts) {
        const li = document.createElement('li')
        li.className = 'equipment-auto-item'
        li.textContent = `${count}× ${type}`
        list.appendChild(li)
      }
    }

    for (const item of this.segment.equipment) {
      const li = document.createElement('li')
      li.className = 'equipment-manual-item'
      li.textContent = `${item.count}× ${item.name}`
      list.appendChild(li)
    }

    this.equipmentSection.appendChild(list)
  }

  private renderMarkers(markers: SignMarker[]): void {
    this.markerListEl.innerHTML = ''
    if (markers.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-view-empty'
      empty.textContent = 'Ei merkkejä tällä pätkällä'
      this.markerListEl.appendChild(empty)
      return
    }
    const sorted = [...markers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    for (const marker of sorted) {
      this.markerListEl.appendChild(this.buildMarkerRow(marker))
    }
  }

  private buildMarkerRow(marker: SignMarker): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-view-item'
    li.dataset.id = marker.id

    const km = (marker.distanceFromStart / 1000).toFixed(1)
    const typeLabel = TYPE_LABELS[marker.type] ?? marker.type
    const statusLabel = STATUS_LABELS[marker.status] ?? marker.status

    const info = document.createElement('span')
    info.className = 'segment-view-item-info'
    info.textContent = `${km} km — ${typeLabel}`
    li.appendChild(info)

    const status = document.createElement('span')
    status.className = `segment-view-status status-${marker.status}`
    status.textContent = statusLabel
    li.appendChild(status)

    return li
  }
}
