import { bulkCollect } from '../logic/segment-actions'
import { isTerminal } from '../logic/marker-status'
import { firstUnsetMarker } from '../logic/navigation'
import { getPhaseProgress, formatPhaseProgress } from '../logic/segments'
import type { Segment } from '../logic/segments'
import { buildMarkerVisual } from './marker-visual-row'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignMarker } from '../logic/types'

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

const STATUS_LABELS: Record<string, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

// Merkin ihmisluettava nimi: oma label > kirjaston tyyppilabel > tyyppikoodi.
function markerLabel(m: SignMarker): string {
  if (m.label) return m.label
  return TYPE_LABELS[m.type] ?? SIGN_TYPES.find(s => s.type === m.type)?.label ?? m.type
}

// T14/T208 (talkoolainen): pätkänäkymän toiminta-callbackit. Erillinen positional-parametreista
// (onBulkCollect/onInspect) taaksepäin-yhteensopivuuden vuoksi (t14/t52-testit).
export interface SegmentViewActions {
  // "Aseta" — merkki suunniteltu→asetettu (V9). Ohjaus etenee pätkän merkit järjestyksessä.
  onSetMarker?: (id: string) => void
  // "Ei tarpeen" — merkki suunniteltu→ei_tarpeen (V9).
  onSkipMarker?: (id: string) => void
  // Rivin/napin klikkaus — kohdista merkki kartalla + avaa detaljit (ohjeet, siirto).
  onFocusMarker?: (id: string) => void
  // "Näytä kartalla" — panoroi kartta merkkiin AVAAMATTA modaalia (näkymä pienenee, kartta esiin).
  onShowOnMap?: (id: string) => void
  // T78/V43: talkoolainen muokkaa oman pätkän rajoja kentällä (laajenna/lyhennä). Metrit.
  onEditBounds?: (startDistM: number, endDistM: number) => void
}

export class SegmentView {
  private panel!: HTMLElement
  private readonly progressEl: HTMLElement
  private readonly nextEl: HTMLElement
  private readonly markerListEl: HTMLUListElement
  private readonly bulkBtn: HTMLButtonElement
  private readonly equipmentSection: HTMLElement
  private readonly inspectSection: HTMLElement
  private readonly inspectBtn: HTMLButtonElement
  private readonly inspectNoteInput: HTMLTextAreaElement
  private readonly inspectStatus: HTMLElement
  private readonly boundsSection: HTMLElement
  private currentMarkers: SignMarker[] = []

  constructor(
    container: HTMLElement,
    private segment: Segment,
    private readonly onBulkCollect?: (updated: SignMarker[]) => void,
    private readonly onInspect?: (inspected: boolean, note: string) => void,
    private readonly actions: SegmentViewActions = {},
  ) {
    const b = this.build()
    this.progressEl = b.progressEl
    this.nextEl = b.nextEl
    this.markerListEl = b.markerListEl
    this.bulkBtn = b.bulkBtn
    this.equipmentSection = b.equipmentSection
    this.inspectSection = b.inspectSection
    this.inspectBtn = b.inspectBtn
    this.inspectNoteInput = b.inspectNoteInput
    this.inspectStatus = b.inspectStatus
    this.boundsSection = b.boundsSection
    this.panel = b.panel
    container.appendChild(b.panel)
    this.renderInspectSection()
    this.renderProgress()
    this.renderNext()
    this.renderBoundsSection()
  }

  update(markers: SignMarker[], segment?: Segment): void {
    if (segment) this.segment = segment
    this.currentMarkers = markers
    this.renderProgress()
    this.renderNext()
    this.renderMarkers(markers)
    this.updateBulkBtn(markers)
    this.renderEquipment(markers)
    this.renderInspectSection()
    this.renderBoundsSection()
  }

  // T78/V43: pätkän rajojen muokkaus kentällä. Näkyy vain jos onEditBounds annettu (talkoolainen).
  // Kokoontaitettava — ei vie tilaa oletuksena, ei kilpaile hero-ohjauksen kanssa.
  private renderBoundsSection(): void {
    if (!this.actions.onEditBounds) {
      this.boundsSection.hidden = true
      return
    }
    this.boundsSection.hidden = false
    // Päivitä toggle-napin km-teksti nykyisillä rajoilla (jos form ei ole auki).
    const toggle = this.boundsSection.querySelector('.segment-view-bounds-toggle') as HTMLButtonElement | null
    const form = this.boundsSection.querySelector('.segment-view-bounds-form') as HTMLElement | null
    if (toggle && form && form.hidden) {
      const s = (this.segment.startDist / 1000).toFixed(1)
      const e = (this.segment.endDist / 1000).toFixed(1)
      toggle.textContent = `✎ Muokkaa pätkän rajoja (${s}–${e} km)`
    }
  }

  // Kutistaa/laajentaa näkymän (kartta esiin mobiilissa). Kutsuttavissa ulkoa + "Näytä kartalla".
  setCollapsed(collapsed: boolean): void {
    this.panel.classList.toggle('segment-view--collapsed', collapsed)
    const btn = this.panel.querySelector('.segment-view-collapse')
    if (btn) btn.setAttribute('aria-label', collapsed ? 'Laajenna pätkänäkymä' : 'Pienennä pätkänäkymä')
  }

  private updateBulkBtn(markers: SignMarker[]): void {
    const hasNonTerminal = markers.some(m => !isTerminal(m.status))
    this.bulkBtn.hidden = this.segment.phase !== 'purku' || !hasNonTerminal
  }

  // T143/V90: phase-tietoinen edistymispalkki — "N/M asetettu" tai "N/M kerätty".
  // Sama getPhaseProgress-logiikka kuin järjestäjän sivupalkissa (yhtenäisyys).
  private renderProgress(): void {
    const p = getPhaseProgress(this.segment, this.currentMarkers)
    const text = formatPhaseProgress(p)
    let pct = 0
    if (p.kind === 'count') pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
    else pct = p.done ? 100 : 0
    this.progressEl.innerHTML = `
      <div class="segment-view-progress-bar"><div class="segment-view-progress-fill" style="width:${pct}%"></div></div>
      <span class="segment-view-progress-text">${text}</span>`
  }

  // "Seuraava merkki" -ohjaus (VISION: "Jos GPS ei ole päällä, näyttää listan seuraavista
  // asettamattomista merkeistä"). Vain asettaminen-phasessa. Ohjaa pätkän ENSIMMÄISEEN
  // asettamattomaan merkkiin (firstUnsetMarker, pienin distanceFromStart) — ei "randomiin".
  private renderNext(): void {
    if (this.segment.phase !== 'asettaminen') {
      this.nextEl.hidden = true
      return
    }
    this.nextEl.hidden = false
    this.nextEl.innerHTML = ''

    const next = firstUnsetMarker(this.currentMarkers)
    if (!next) {
      // Kaikki asetettu → valmis-tila.
      const done = document.createElement('div')
      done.className = 'segment-view-next-done'
      const total = this.currentMarkers.length
      done.innerHTML = total === 0
        ? '<span class="segment-view-next-done-title">Ei merkkejä tällä pätkällä</span>'
        : '<span class="segment-view-next-done-title">Kaikki merkit asetettu 🎉</span>'
      this.nextEl.appendChild(done)
      return
    }

    const label = document.createElement('div')
    label.className = 'segment-view-next-label'
    label.textContent = 'Seuraava merkki'
    this.nextEl.appendChild(label)

    const row = document.createElement('div')
    row.className = 'segment-view-next-row'

    row.appendChild(buildMarkerVisual(
      { type: next.type, iconId: next.iconId, label: next.label, parts: next.parts, color: next.color },
      { size: 44, zoomable: false },
    ))

    const info = document.createElement('div')
    info.className = 'segment-view-next-info'
    const km = (next.distanceFromStart / 1000).toFixed(1)
    const nameEl = document.createElement('span')
    nameEl.className = 'segment-view-next-name'
    nameEl.textContent = markerLabel(next)
    const metaEl = document.createElement('span')
    metaEl.className = 'segment-view-next-meta'
    metaEl.textContent = `${km} km`
    info.appendChild(nameEl)
    info.appendChild(metaEl)
    if (next.locationNote) {
      const noteEl = document.createElement('span')
      noteEl.className = 'segment-view-next-note'
      noteEl.textContent = next.locationNote
      info.appendChild(noteEl)
    }
    row.appendChild(info)
    this.nextEl.appendChild(row)

    const actionsRow = document.createElement('div')
    actionsRow.className = 'segment-view-next-actions'

    const setBtn = document.createElement('button')
    setBtn.className = 'btn btn--confirm segment-view-next-set'
    setBtn.textContent = '✓ Aseta'
    setBtn.addEventListener('click', () => this.actions.onSetMarker?.(next.id))
    actionsRow.appendChild(setBtn)

    const showBtn = document.createElement('button')
    showBtn.className = 'btn btn--secondary segment-view-next-show'
    showBtn.textContent = 'Näytä kartalla'
    showBtn.addEventListener('click', () => {
      // Panoroi + kutista näkymä → kartta esiin (ei avaa modaalia). Fallback onFocusMarker jos
      // onShowOnMap ei annettu.
      if (this.actions.onShowOnMap) { this.actions.onShowOnMap(next.id); this.setCollapsed(true) }
      else this.actions.onFocusMarker?.(next.id)
    })
    actionsRow.appendChild(showBtn)

    this.nextEl.appendChild(actionsRow)

    const skipBtn = document.createElement('button')
    skipBtn.className = 'btn btn--ghost segment-view-next-skip'
    skipBtn.textContent = 'Ei tarpeen'
    skipBtn.addEventListener('click', () => this.actions.onSkipMarker?.(next.id))
    this.nextEl.appendChild(skipBtn)
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
    progressEl: HTMLElement
    nextEl: HTMLElement
    markerListEl: HTMLUListElement
    bulkBtn: HTMLButtonElement
    equipmentSection: HTMLElement
    inspectSection: HTMLElement
    inspectBtn: HTMLButtonElement
    inspectNoteInput: HTMLTextAreaElement
    inspectStatus: HTMLElement
    boundsSection: HTMLElement
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

    // Kokoontaitto: mobiilissa näkymä vie ~48vh → kartta jää pieneksi. Chevron kutistaa
    // näkymän otsikko+edistymispalkkiin ja antaa kartalle tilaa navigointiin.
    const collapseBtn = document.createElement('button')
    collapseBtn.type = 'button'
    collapseBtn.className = 'segment-view-collapse'
    collapseBtn.setAttribute('aria-label', 'Pienennä pätkänäkymä')
    collapseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>'
    collapseBtn.addEventListener('click', () => this.setCollapsed(!this.panel.classList.contains('segment-view--collapsed')))
    header.appendChild(collapseBtn)

    panel.appendChild(header)

    const progressEl = document.createElement('div')
    progressEl.className = 'segment-view-progress'
    panel.appendChild(progressEl)

    if (this.segment.description) {
      const desc = document.createElement('p')
      desc.className = 'segment-view-desc'
      desc.textContent = this.segment.description
      panel.appendChild(desc)
    }

    const nextEl = document.createElement('div')
    nextEl.className = 'segment-view-next'
    nextEl.hidden = true
    panel.appendChild(nextEl)

    const equipmentSection = document.createElement('div')
    equipmentSection.className = 'segment-view-equipment'
    panel.appendChild(equipmentSection)

    const bulkBtn = document.createElement('button')
    bulkBtn.className = 'btn btn--confirm btn-bulk-collect'
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
    inspectBtn.className = 'btn btn--confirm btn-mark-inspected'
    inspectBtn.addEventListener('click', () => {
      const nowInspected = !(this.segment.inspected ?? false)
      this.onInspect?.(nowInspected, inspectNoteInput.value.trim())
    })
    inspectSection.appendChild(inspectBtn)

    panel.appendChild(inspectSection)

    const markerListEl = document.createElement('ul')
    markerListEl.className = 'segment-view-list'
    panel.appendChild(markerListEl)

    // T78/V43: pätkän rajojen muokkaus — subtle, kokoontaitettu, listan jälkeen.
    const boundsSection = document.createElement('div')
    boundsSection.className = 'segment-view-bounds'
    boundsSection.hidden = true

    const boundsToggle = document.createElement('button')
    boundsToggle.type = 'button'
    boundsToggle.className = 'btn btn--secondary btn--sm segment-view-bounds-toggle'
    boundsToggle.textContent = '✎ Muokkaa pätkän rajoja'
    boundsSection.appendChild(boundsToggle)

    const boundsForm = document.createElement('div')
    boundsForm.className = 'segment-view-bounds-form'
    boundsForm.hidden = true

    const mkField = (labelText: string, cls: string, value: string): HTMLInputElement => {
      const wrap = document.createElement('label')
      wrap.className = 'segment-view-bounds-field'
      const lab = document.createElement('span')
      lab.textContent = labelText
      const input = document.createElement('input')
      input.type = 'number'
      input.className = cls
      input.step = '0.1'
      input.min = '0'
      input.value = value
      input.inputMode = 'decimal'
      wrap.appendChild(lab)
      wrap.appendChild(input)
      boundsForm.appendChild(wrap)
      return input
    }
    const startInput = mkField('Alku (km)', 'segment-view-bounds-start', (this.segment.startDist / 1000).toFixed(1))
    const endInput = mkField('Loppu (km)', 'segment-view-bounds-end', (this.segment.endDist / 1000).toFixed(1))

    const boundsError = document.createElement('p')
    boundsError.className = 'segment-view-bounds-error'
    boundsError.hidden = true
    boundsForm.appendChild(boundsError)

    const boundsActions = document.createElement('div')
    boundsActions.className = 'segment-view-bounds-actions'
    const saveBounds = document.createElement('button')
    saveBounds.type = 'button'
    saveBounds.className = 'btn btn--confirm segment-view-bounds-save'
    saveBounds.textContent = 'Tallenna rajat'
    const cancelBounds = document.createElement('button')
    cancelBounds.type = 'button'
    cancelBounds.className = 'btn btn--secondary segment-view-bounds-cancel'
    cancelBounds.textContent = 'Peruuta'
    boundsActions.appendChild(saveBounds)
    boundsActions.appendChild(cancelBounds)
    boundsForm.appendChild(boundsActions)
    boundsSection.appendChild(boundsForm)

    const openForm = () => {
      startInput.value = (this.segment.startDist / 1000).toFixed(1)
      endInput.value = (this.segment.endDist / 1000).toFixed(1)
      boundsError.hidden = true
      boundsForm.hidden = false
      boundsToggle.hidden = true
    }
    const closeForm = () => {
      boundsForm.hidden = true
      boundsToggle.hidden = false
      this.renderBoundsSection()
    }
    boundsToggle.addEventListener('click', openForm)
    cancelBounds.addEventListener('click', closeForm)
    saveBounds.addEventListener('click', () => {
      const startKm = parseFloat(startInput.value)
      const endKm = parseFloat(endInput.value)
      if (!Number.isFinite(startKm) || !Number.isFinite(endKm) || startKm < 0) {
        boundsError.textContent = 'Anna kelvolliset km-arvot.'
        boundsError.hidden = false
        return
      }
      if (endKm <= startKm) {
        boundsError.textContent = 'Loppu-km oltava suurempi kuin alku.'
        boundsError.hidden = false
        return
      }
      this.actions.onEditBounds?.(Math.round(startKm * 1000), Math.round(endKm * 1000))
      closeForm()
    })

    panel.appendChild(boundsSection)

    return { panel, progressEl, nextEl, markerListEl, bulkBtn, equipmentSection, inspectSection, inspectBtn, inspectNoteInput, inspectStatus, boundsSection }
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
    title.textContent = 'Varusteet'
    this.equipmentSection.appendChild(title)

    const list = document.createElement('ul')
    list.className = 'segment-view-equipment-list'

    if (hasAuto) {
      for (const [type, count] of counts) {
        const li = document.createElement('li')
        li.className = 'equipment-auto-item'
        // Ihmisluettava tyyppilabel (esim. "Vasemmalle") — ei raakaa koodia ("left").
        li.textContent = `${count}× ${TYPE_LABELS[type] ?? SIGN_TYPES.find(s => s.type === type)?.label ?? type}`
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

    // T198/V136: jaettu merkkivisuaali — sama korttimuoto + väri kuin kartalla ja järjestäjän
    // listassa (yhtenäinen UI). Talkoolainen tunnistaa merkin listalta samasta ulkoasusta.
    li.appendChild(buildMarkerVisual(
      { type: marker.type, iconId: marker.iconId, label: marker.label, parts: marker.parts, color: marker.color },
      { size: 30, zoomable: false },
    ))

    const km = (marker.distanceFromStart / 1000).toFixed(1)
    const typeLabel = markerLabel(marker)
    const statusLabel = STATUS_LABELS[marker.status] ?? marker.status

    const info = document.createElement('span')
    info.className = 'segment-view-item-info'
    info.textContent = `${km} km — ${typeLabel}`
    li.appendChild(info)

    if (marker.locationNote) {
      const note = document.createElement('span')
      note.className = 'marker-note-dot'
      note.setAttribute('aria-label', 'Ohje kirjoitettu')
      note.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
      li.appendChild(note)
    }

    const status = document.createElement('span')
    status.className = `segment-view-status status-${marker.status}`
    status.textContent = statusLabel
    li.appendChild(status)

    // Rivin klikkaus → kohdista + avaa detaljit (ohjeet, tyyppi, siirto). Sama kuin järjestäjän
    // listassa (V127: mobiilissa detaljin avaus sulkee overlayn).
    if (this.actions.onFocusMarker) {
      li.classList.add('segment-view-item--clickable')
      li.addEventListener('click', () => this.actions.onFocusMarker?.(marker.id))
    }

    return li
  }
}
