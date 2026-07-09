import { bulkCollect } from '../logic/segment-actions'
import { isTerminal } from '../logic/marker-status'
import { firstUnsetMarker } from '../logic/navigation'
import { getPhaseProgress, formatPhaseProgress } from '../logic/segments'
import type { Segment, EquipmentItem } from '../logic/segments'
import { buildMarkerVisual } from './marker-visual-row'
import { EquipmentModal } from './equipment-modal'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignMarker } from '../logic/types'

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
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
  // T224 (B) "Siirretty" overflow — talkoolainen siirtää merkin (→ T222 merkin siirto kentällä).
  onMoveMarker?: (id: string) => void
  // T228: "Laita kommentti" overflow — avaa MarkerDetailModal (Kommentti/locationNote-kenttä).
  // Per-merkki-kommentti on jo olemassa (jaettu detail-modaali); tämä tekee siitä löydettävän herosta.
  onComment?: (id: string) => void
  // T78/V43: talkoolainen muokkaa oman pätkän rajoja kentällä (laajenna/lyhennä). Metrit.
  onEditBounds?: (startDistM: number, endDistM: number) => void
  // T224 (C): talkoolainen muokkaa pätkän manuaali-varustelistaa itse (valmisteluvaihe, V38/V93).
  onEquipmentChange?: (equipment: EquipmentItem[]) => void
  // T230: talkoolainen merkitsee pätkän valmiiksi/keskeneräiseksi (asettaminen/purku). Server V93.
  onComplete?: (completed: boolean) => void
}

export class SegmentView {
  private panel!: HTMLElement
  private readonly progressEl: HTMLElement
  private readonly nextEl: HTMLElement
  private readonly varusteBtn: HTMLButtonElement
  private readonly bulkBtn: HTMLButtonElement
  private readonly inspectSection: HTMLElement
  private readonly inspectBtn: HTMLButtonElement
  private readonly inspectNoteInput: HTMLTextAreaElement
  private readonly inspectStatus: HTMLElement
  private readonly boundsSection: HTMLElement
  private readonly completeSection: HTMLElement
  private readonly completeBtn: HTMLButtonElement
  private readonly completeStatus: HTMLElement
  private readonly equipmentModal: EquipmentModal
  private currentMarkers: SignMarker[] = []

  constructor(
    container: HTMLElement,
    private segment: Segment,
    private readonly onBulkCollect?: (updated: SignMarker[]) => void,
    private readonly onInspect?: (inspected: boolean, note: string) => void,
    private readonly actions: SegmentViewActions = {},
  ) {
    this.equipmentModal = new EquipmentModal((equipment) => this.actions.onEquipmentChange?.(equipment))
    const b = this.build()
    this.progressEl = b.progressEl
    this.nextEl = b.nextEl
    this.varusteBtn = b.varusteBtn
    this.bulkBtn = b.bulkBtn
    this.inspectSection = b.inspectSection
    this.inspectBtn = b.inspectBtn
    this.inspectNoteInput = b.inspectNoteInput
    this.inspectStatus = b.inspectStatus
    this.boundsSection = b.boundsSection
    this.completeSection = b.completeSection
    this.completeBtn = b.completeBtn
    this.completeStatus = b.completeStatus
    this.panel = b.panel
    container.appendChild(b.panel)
    this.renderInspectSection()
    this.renderCompleteSection()
    this.renderProgress()
    this.renderNext()
    this.renderVarusteBtn()
    this.renderBoundsSection()
  }

  update(markers: SignMarker[], segment?: Segment): void {
    if (segment) this.segment = segment
    this.currentMarkers = markers
    this.renderProgress()
    this.renderNext()
    this.updateBulkBtn(markers)
    this.renderVarusteBtn()
    this.renderInspectSection()
    this.renderCompleteSection()
    this.renderBoundsSection()
  }

  // T230: "Merkitse pätkä valmiiksi" — vain asettaminen/purku (tarkastus käyttää inspect-osiota).
  // Talkoolaisen eksplisiittinen valmis-signaali, erillään per-merkki-kuittauksesta. Näkyy vain
  // jos onComplete annettu (talkoolainen). Toggle: valmis ↔ keskeneräinen.
  private renderCompleteSection(): void {
    const phaseOk = this.segment.phase === 'asettaminen' || this.segment.phase === 'purku'
    if (!this.actions.onComplete || !phaseOk) {
      this.completeSection.hidden = true
      return
    }
    this.completeSection.hidden = false
    const done = this.segment.completed ?? false
    this.completeSection.classList.toggle('segment-view-complete--done', done)
    this.completeStatus.textContent = done ? 'Pätkä merkitty valmiiksi ✓' : ''
    this.completeStatus.hidden = !done
    this.completeBtn.textContent = done ? 'Merkitse keskeneräiseksi' : '✓ Merkitse pätkä valmiiksi'
    this.completeBtn.className = done
      ? 'btn btn--secondary segment-view-complete-btn'
      : 'btn btn--confirm segment-view-complete-btn'
  }

  // T224 (C): Varustelista-nappi näyttää määrän ja avaa tilavan modaalin (kuten "Kaikki merkit").
  private renderVarusteBtn(): void {
    const autoCount = this.currentMarkers.length
    const manualCount = this.segment.equipment.reduce((s, i) => s + (i.count || 0), 0)
    const total = autoCount + manualCount
    this.varusteBtn.textContent = total > 0 ? `🎒 Varustelista (${total})` : '🎒 Varustelista'
  }

  // T78/V43: pätkän rajojen muokkaus kentällä. Näkyy vain jos onEditBounds annettu (talkoolainen).
  // Kokoontaitettava — ei vie tilaa oletuksena, ei kilpaile hero-ohjauksen kanssa.
  private renderBoundsSection(): void {
    if (!this.actions.onEditBounds) {
      this.boundsSection.hidden = true
      return
    }
    this.boundsSection.hidden = false
    const toggle = this.boundsSection.querySelector('.segment-view-bounds-toggle') as HTMLButtonElement | null
    const form = this.boundsSection.querySelector('.segment-view-bounds-form') as HTMLElement | null
    if (toggle && form && form.hidden) {
      const s = ((this.segment.startDist ?? 0) / 1000).toFixed(1)
      const e = ((this.segment.endDist ?? 0) / 1000).toFixed(1)
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

  // "Seuraava merkki" -ohjaus (hero). Vain asettaminen-phasessa. Ohjaa pätkän ENSIMMÄISEEN
  // asettamattomaan merkkiin (firstUnsetMarker, pienin distanceFromStart).
  private renderNext(): void {
    if (this.segment.phase !== 'asettaminen') {
      this.nextEl.hidden = true
      return
    }
    this.nextEl.hidden = false
    this.nextEl.innerHTML = ''

    const next = firstUnsetMarker(this.currentMarkers)
    if (!next) {
      // T228: matala done-rivi (⊥ accent-kortti) → kartta esiin, passiivinen tila = matala paino.
      this.nextEl.classList.add('segment-view-next--done')
      const done = document.createElement('div')
      done.className = 'segment-view-next-done'
      const total = this.currentMarkers.length
      done.innerHTML = total === 0
        ? '<span class="segment-view-next-done-title">Ei merkkejä tällä pätkällä</span>'
        : '<span class="segment-view-next-done-title">✓ Kaikki asetettu 🎉</span>'
      this.nextEl.appendChild(done)
      return
    }
    this.nextEl.classList.remove('segment-view-next--done')

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

    // T224 (B): primary 2 nappia (VISION max 2) — Aseta + Näytä kartalla. Loput ⋯-valikossa.
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
      if (this.actions.onShowOnMap) { this.actions.onShowOnMap(next.id); this.setCollapsed(true) }
      else this.actions.onFocusMarker?.(next.id)
    })
    actionsRow.appendChild(showBtn)

    const moreBtn = document.createElement('button')
    moreBtn.className = 'btn btn--ghost segment-view-next-more'
    moreBtn.setAttribute('aria-label', 'Lisää toimintoja')
    moreBtn.setAttribute('aria-haspopup', 'true')
    moreBtn.textContent = '⋯'
    actionsRow.appendChild(moreBtn)

    this.nextEl.appendChild(actionsRow)

    // Overflow-valikko: Ei tarpeen · Siirretty · Ota kuva (tulossa) · Laita kommentti (tulossa)
    const menu = document.createElement('div')
    menu.className = 'segment-view-next-menu'
    menu.hidden = true

    const skipItem = document.createElement('button')
    skipItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-skip'
    skipItem.textContent = 'Ei tarpeen'
    skipItem.addEventListener('click', () => { menu.hidden = true; this.actions.onSkipMarker?.(next.id) })
    menu.appendChild(skipItem)

    const moveItem = document.createElement('button')
    moveItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-move'
    moveItem.textContent = 'Siirretty'
    if (this.actions.onMoveMarker) {
      moveItem.addEventListener('click', () => { menu.hidden = true; this.actions.onMoveMarker?.(next.id) })
    } else {
      moveItem.disabled = true
      moveItem.title = 'Tulossa'
    }
    menu.appendChild(moveItem)

    // T228: "Laita kommentti" → avaa detail-modaalin Kommentti-kenttä (löydettävä per-merkki-kommentti).
    const commentItem = document.createElement('button')
    commentItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-comment'
    commentItem.textContent = 'Laita kommentti'
    if (this.actions.onComment) {
      commentItem.addEventListener('click', () => { menu.hidden = true; this.actions.onComment?.(next.id) })
    } else {
      commentItem.disabled = true
      commentItem.title = 'Tulossa'
    }
    menu.appendChild(commentItem)

    // "Ota kuva" — talkoolaisen kuvankaappaus tulossa (T221/T103-alue).
    const photoItem = document.createElement('button')
    photoItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-photo'
    photoItem.textContent = 'Ota kuva'
    photoItem.disabled = true
    photoItem.title = 'Tulossa'
    menu.appendChild(photoItem)

    moreBtn.addEventListener('click', () => { menu.hidden = !menu.hidden })
    this.nextEl.appendChild(menu)
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
    varusteBtn: HTMLButtonElement
    bulkBtn: HTMLButtonElement
    inspectSection: HTMLElement
    inspectBtn: HTMLButtonElement
    inspectNoteInput: HTMLTextAreaElement
    inspectStatus: HTMLElement
    boundsSection: HTMLElement
    completeSection: HTMLElement
    completeBtn: HTMLButtonElement
    completeStatus: HTMLElement
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
    const startKm = ((this.segment.startDist ?? 0) / 1000).toFixed(1)
    const endKm = ((this.segment.endDist ?? 0) / 1000).toFixed(1)
    range.textContent = `${startKm}–${endKm} km`
    header.appendChild(range)

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

    // T228: EI inline-merkkilistaa — "Kaikki merkit" -modaali (yläpalkki) on ainoa per-merkki-lista
    // (bulk + rivi→MarkerDetailModal). Inline-lista duplikoi sen ja söi kartan tilan → poistettu.

    // T224 (C): Varustelista-nappi → tilava EquipmentModal (kuten "Kaikki merkit" -massalista).
    const varusteBtn = document.createElement('button')
    varusteBtn.type = 'button'
    varusteBtn.className = 'btn btn--secondary segment-view-varuste-btn'
    varusteBtn.textContent = '🎒 Varustelista'
    varusteBtn.addEventListener('click', () => this.equipmentModal.open(this.segment, this.currentMarkers))
    panel.appendChild(varusteBtn)

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

    // T230: "Merkitse pätkä valmiiksi" -osio (asettaminen/purku). Erillään merkki-kuittauksesta.
    const completeSection = document.createElement('div')
    completeSection.className = 'segment-view-complete'
    completeSection.hidden = true

    const completeStatus = document.createElement('p')
    completeStatus.className = 'segment-view-complete-status'
    completeStatus.hidden = true
    completeSection.appendChild(completeStatus)

    const completeBtn = document.createElement('button')
    completeBtn.type = 'button'
    completeBtn.className = 'btn btn--confirm segment-view-complete-btn'
    completeBtn.addEventListener('click', () => {
      this.actions.onComplete?.(!(this.segment.completed ?? false))
    })
    completeSection.appendChild(completeBtn)
    panel.appendChild(completeSection)

    const boundsSection = this.buildBoundsSection()
    panel.appendChild(boundsSection)

    return {
      panel, progressEl, nextEl, varusteBtn, bulkBtn,
      inspectSection, inspectBtn, inspectNoteInput, inspectStatus, boundsSection,
      completeSection, completeBtn, completeStatus,
    }
  }

  // T78/V43: pätkän rajojen muokkaus-osio (eristetty build-metodista luettavuuden vuoksi).
  private buildBoundsSection(): HTMLElement {
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
    const startInput = mkField('Alku (km)', 'segment-view-bounds-start', ((this.segment.startDist ?? 0) / 1000).toFixed(1))
    const endInput = mkField('Loppu (km)', 'segment-view-bounds-end', ((this.segment.endDist ?? 0) / 1000).toFixed(1))

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
      startInput.value = ((this.segment.startDist ?? 0) / 1000).toFixed(1)
      endInput.value = ((this.segment.endDist ?? 0) / 1000).toFixed(1)
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

    return boundsSection
  }

}
