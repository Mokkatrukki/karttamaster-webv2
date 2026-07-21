import { bulkCollect } from '../logic/segment-actions'
import { isTerminal } from '../logic/marker-status'
import { getPhaseProgress, formatPhaseProgress } from '../logic/segments'
import type { Segment, EquipmentItem } from '../logic/segments'
import { buildMarkerVisual } from './marker-visual-row'
import { EquipmentModal } from './equipment-modal'
import { SegmentHero, markerLabel } from './segment-hero'
import { SegmentEquipment } from './segment-equipment'
import { SegmentMarkerList } from './segment-marker-list'
import { SegmentKotiTabs } from './segment-koti-tabs'
import { CommentThread, type CommentThreadApi } from './comment-thread'
import type { SignMarker } from '../logic/types'

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
  // T232 (B)/V156: GPS-toggle herosta (siirretty yläpalkista). Palauttaa uuden aktiivitilan.
  onToggleGps?: () => boolean
  // T232 (B): GPS-navigaattorin nykyinen tila (napin alkuperäisen ilmeen renderöintiin).
  isGpsActive?: () => boolean
  // T232 (F)/V159: hero:n valittu merkki muuttui (◀▶-selailu/reconcile) → synkkaa kartan
  // ikoni-korostus (T256 setNextHighlight). null = ei valittua merkkiä (done/väärä phase) → tyhjennä.
  onNavigate?: (markerId: string | null) => void
  // T232 (E)/T229: "+ Merkki" hero-overflowsta → avaa sign-picker kartan keskelle (POST omalle pätkälle).
  onAddMarker?: () => void
  // T218/V143 (skenaario 2): keräyslistan "haettu"-kuittaus. Kuka tahansa autentikoitu, EI
  // ownership-gatea. collected=true → kerätty, false → suunniteltu (peruutus).
  onCollectMarker?: (id: string, collected: boolean) => void
  // T221/T75: pätkän geneerinen kommenttilanka — kirjoittajan nimi (talkoolaisen koodi) esitäyttöön.
  commentAuthorName?: string
  // T221: injektoitava kommentti-api (Vitest-jsdom). Oletus = oikea logic/comments-slice.
  commentApi?: CommentThreadApi
}

export class SegmentView {
  private panel!: HTMLElement
  private readonly progressEl: HTMLElement
  private readonly gpsBtn: HTMLButtonElement
  private readonly nextEl: HTMLElement
  // T218/V143: keräyskasa-tehtävän (markerTypeFilter) elävä keräyslista — asettaminen-heron tilalla.
  private readonly collectionEl: HTMLElement
  private readonly bulkBtn: HTMLButtonElement
  private readonly inspectSection: HTMLElement
  private readonly inspectBtn: HTMLButtonElement
  private readonly inspectNoteInput: HTMLTextAreaElement
  private readonly inspectStatus: HTMLElement
  // T232 (A)/V158: "Lisää ⋯" panel-tason sekundäärivalikko — pitää complete+bounds pois
  // aina-näkyvistä (hero-primary tiivis) mutta tavoitettavina KAIKISSA phaseissa (ei hero-overflow,
  // joka on vain asettaminen+next → complete olisi tavoittamaton purussa/done-tilassa).
  private readonly moreSection: HTMLElement
  private readonly boundsSection: HTMLElement
  private readonly completeSection: HTMLElement
  private readonly completeBtn: HTMLButtonElement
  private readonly completeStatus: HTMLElement
  private readonly equipmentModal: EquipmentModal
  private currentMarkers: SignMarker[] = []
  // T221/T75: pätkän geneerinen kommenttilanka (targetType='segment'). Talkoolainen näkee/lisää,
  // ei poista (canDelete=false). Eri asia kuin per-merkki-kommentit (MarkerDetailModal).
  private readonly commentEl: HTMLElement
  private commentThread: CommentThread | null = null
  // T234: "Seuraava merkki" -hero eristetty omaan luokkaansa (SegmentHero). SegmentView on
  // koordinaattori; hero omistaa selectedNavId-tilan ja ◀▶-selailun (V159).
  private readonly hero: SegmentHero
  // T262/V182: KOTI-moodin inline-varustelista (varustarkastus-checkoff). Eristetty omaan
  // luokkaansa (SegmentView on koordinaattori); kartta-moodissa CSS piilottaa (vain hero näkyy).
  private readonly equipment: SegmentEquipment
  private readonly equipmentEl: HTMLElement
  // T263/V183: KOTI-moodin inline "Kaikki merkit" -lista (koti-only; kartta piilottaa CSS:llä).
  private readonly markerList: SegmentMarkerList
  private readonly markerListEl: HTMLElement
  // T264/V184: koti-välilehdet (Varustelista · Kaikki merkit · Kommentit). Korvaa "Lisää ⋯" -accordionin.
  private readonly kotiTabs: SegmentKotiTabs

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
    this.gpsBtn = b.gpsBtn
    this.nextEl = b.nextEl
    this.equipmentEl = b.equipmentEl
    this.markerListEl = b.markerListEl
    this.collectionEl = b.collectionEl
    this.bulkBtn = b.bulkBtn
    this.inspectSection = b.inspectSection
    this.inspectBtn = b.inspectBtn
    this.inspectNoteInput = b.inspectNoteInput
    this.inspectStatus = b.inspectStatus
    this.moreSection = b.moreSection
    this.boundsSection = b.boundsSection
    this.completeSection = b.completeSection
    this.completeBtn = b.completeBtn
    this.completeStatus = b.completeStatus
    this.commentEl = b.commentEl
    this.panel = b.panel
    container.appendChild(b.panel)
    // T221/T75: pätkän kommenttilanka. Talkoolainen-näkymä → canDelete=false (poisto järjestäjä+).
    this.commentThread = new CommentThread({
      targetType: 'segment',
      targetId: this.segment.id,
      canDelete: false,
      authorName: this.actions.commentAuthorName,
      api: this.actions.commentApi,
    })
    this.commentEl.appendChild(this.commentThread.el)
    void this.commentThread.load()
    this.hero = new SegmentHero(this.nextEl, {
      getSegment: () => this.segment,
      getMarkers: () => this.currentMarkers,
      actions: this.actions,
      setCollapsed: (collapsed) => this.setCollapsed(collapsed),
    })
    // T262/V182: KOTI-inline-varustelista. "Muokkaa" → sama EquipmentModal kuin yläpalkin 🎒.
    this.equipment = new SegmentEquipment(this.equipmentEl, {
      getSegment: () => this.segment,
      getMarkers: () => this.currentMarkers,
      onEdit: () => this.openEquipment(),
    })
    // T263/V183: KOTI-inline "Kaikki merkit" -lista. Rivi → onFocusMarker (= MarkerDetailModal).
    this.markerList = new SegmentMarkerList(this.markerListEl, {
      getMarkers: () => this.currentMarkers,
      onOpenDetail: (id) => this.actions.onFocusMarker?.(id),
    })
    // T264/V184: koti-välilehdet. Reparentoi elementit paneleihin (varuste / kaikki merkit +
    // valmis + rajat / kommentit). "Lisää ⋯" -accordion (moreSection) piilotetaan → valmis/rajat/
    // kommentit tabeissa, ei haitarin alla. Tabit vain koti-moodissa (kartta: CSS piilottaa, hero näkyy).
    this.kotiTabs = new SegmentKotiTabs([
      { id: 'varuste', label: '🎒 Varustelista', els: [this.equipmentEl] },
      { id: 'merkit', label: 'Kaikki merkit', els: [this.markerListEl, this.completeSection, this.boundsSection] },
      { id: 'kommentit', label: 'Kommentit', els: [this.commentEl] },
    ])
    this.panel.insertBefore(this.kotiTabs.root, this.bulkBtn)
    this.renderGpsBtn()
    this.renderInspectSection()
    this.renderCompleteSection()
    this.renderProgress()
    this.hero.render()
    this.equipment.render()
    this.markerList.render()
    this.renderCollectionList()
    this.renderBoundsSection()
    this.renderMoreSection()
  }

  // T233/V155: yläpalkin "🎒 Varustelista" -nappi avaa tämän (varuste siirtyi pois pätkänäkymän
  // panelista, ettei kilpaile hero-primaryn kanssa). EquipmentModal elää yhä SegmentView:ssä.
  openEquipment(): void {
    this.equipmentModal.open(this.segment, this.currentMarkers)
  }

  update(markers: SignMarker[], segment?: Segment): void {
    if (segment) this.segment = segment
    this.currentMarkers = markers
    this.renderProgress()
    this.hero.render()
    this.equipment.render()
    this.markerList.render()
    this.renderCollectionList()
    this.updateBulkBtn(markers)
    this.renderInspectSection()
    this.renderCompleteSection()
    this.renderBoundsSection()
    this.renderMoreSection()
  }

  // T232 (B)/V156: GPS-toggle (siirretty yläpalkista heroon). Persistentti panel-kontrolli —
  // näkyy KAIKISSA phaseissa (asettaminen+purku, VISION phase 3+5), ei asettaminen-only heron
  // sisällä (muuten GPS olisi tavoittamaton purussa). Näkyy vain jos onToggleGps annettu.
  private renderGpsBtn(): void {
    if (!this.actions.onToggleGps) { this.gpsBtn.hidden = true; return }
    this.gpsBtn.hidden = false
    const active = this.actions.isGpsActive?.() ?? false
    this.gpsBtn.classList.toggle('gps-active', active)
    this.gpsBtn.textContent = active ? '📍 GPS päällä' : '📍 GPS'
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

  // T264/V184: "Lisää ⋯" -accordion POISTETTU — valmis/rajat siirtyivät Kaikki merkit -tabiin,
  // kommentit Kommentit-tabiin (SegmentKotiTabs reparentoi). moreSection pysyy piilossa (elementti
  // säilyy taaksepäin-yhteensopivuuden vuoksi, mutta ei näy — ei enää haitaria, käyttäjäpalaute).
  private renderMoreSection(): void {
    this.moreSection.hidden = true
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

  // T218/V143 (skenaario 2): dynaaminen keräyslista. markerTypeFilter-tehtävä = reititön keräys
  // (keräyskasa/autoporukka). currentMarkers on jo resolveTaskMarkers-osumat (getMarkersForSegment
  // delegoi V140) → lista päivittyy elävästi kun kuka tahansa lisää keräyskasa-merkin. Per-merkki
  // "Haettu"-kuittaus (kerätty ↔ suunniteltu), ei ownership-gatea (V143). Näkyy vain typeFilter-taskille.
  private renderCollectionList(): void {
    if (!this.segment.markerTypeFilter) { this.collectionEl.hidden = true; return }
    this.collectionEl.hidden = false
    this.collectionEl.innerHTML = ''

    const markers = [...this.currentMarkers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    const collected = markers.filter(m => m.status === 'kerätty').length

    const header = document.createElement('div')
    header.className = 'segment-view-collect-header'
    header.textContent = markers.length === 0
      ? 'Ei vielä keräyskohteita'
      : `Keräyslista · ${collected}/${markers.length} haettu`
    this.collectionEl.appendChild(header)

    for (const m of markers) {
      const done = m.status === 'kerätty'
      const row = document.createElement('div')
      row.className = 'segment-view-collect-row'
      if (done) row.classList.add('segment-view-collect-row--done')

      row.appendChild(buildMarkerVisual(
        { type: m.type, iconId: m.iconId, label: m.label, parts: m.parts, color: m.color },
        { size: 36, zoomable: false },
      ))

      const info = document.createElement('button')
      info.type = 'button'
      info.className = 'segment-view-collect-info'
      const nameEl = document.createElement('span')
      nameEl.className = 'segment-view-collect-name'
      nameEl.textContent = markerLabel(m)
      info.appendChild(nameEl)
      if (m.locationNote) {
        const noteEl = document.createElement('span')
        noteEl.className = 'segment-view-collect-note'
        noteEl.textContent = m.locationNote
        info.appendChild(noteEl)
      }
      // Rivin klikkaus → näytä kartalla (löydä keräyskohde). Ei modaalia, kartta esiin.
      info.addEventListener('click', () => {
        if (this.actions.onShowOnMap) { this.actions.onShowOnMap(m.id); this.setCollapsed(true) }
        else this.actions.onFocusMarker?.(m.id)
      })
      row.appendChild(info)

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = done
        ? 'btn btn--secondary segment-view-collect-btn'
        : 'btn btn--confirm segment-view-collect-btn'
      btn.textContent = done ? 'Haettu ✓' : '✓ Haettu'
      btn.addEventListener('click', () => this.actions.onCollectMarker?.(m.id, !done))
      row.appendChild(btn)

      this.collectionEl.appendChild(row)
    }
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
    gpsBtn: HTMLButtonElement
    nextEl: HTMLElement
    collectionEl: HTMLElement
    bulkBtn: HTMLButtonElement
    equipmentEl: HTMLElement
    markerListEl: HTMLElement
    inspectSection: HTMLElement
    inspectBtn: HTMLButtonElement
    inspectNoteInput: HTMLTextAreaElement
    inspectStatus: HTMLElement
    moreSection: HTMLElement
    boundsSection: HTMLElement
    completeSection: HTMLElement
    completeBtn: HTMLButtonElement
    completeStatus: HTMLElement
    commentEl: HTMLElement
  } {
    const panel = document.createElement('div')
    panel.id = 'segment-view'

    const header = document.createElement('div')
    header.className = 'segment-view-header'

    const name = document.createElement('span')
    name.className = 'segment-view-name'
    name.textContent = this.segment.displayName ?? 'Pätkäsi'
    header.appendChild(name)

    // T232 (D): pätkän pituus päänäyttönä ("· 1.0 km"), km-väli pienempänä metatietona.
    const startM = this.segment.startDist ?? 0
    const endM = this.segment.endDist ?? 0
    if (endM > startM) {
      const length = document.createElement('span')
      length.className = 'segment-view-length'
      length.textContent = `· ${((endM - startM) / 1000).toFixed(1)} km`
      header.appendChild(length)
    }

    const range = document.createElement('span')
    range.className = 'segment-view-range'
    const startKm = (startM / 1000).toFixed(1)
    const endKm = (endM / 1000).toFixed(1)
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

    // T232 (B)/V156: GPS-toggle (persistentti panel-kontrolli, näkyy kaikissa phaseissa).
    const gpsBtn = document.createElement('button')
    gpsBtn.type = 'button'
    gpsBtn.className = 'btn btn--secondary segment-view-gps-btn'
    gpsBtn.textContent = '📍 GPS'
    gpsBtn.hidden = true
    gpsBtn.addEventListener('click', () => {
      const active = this.actions.onToggleGps?.() ?? false
      gpsBtn.classList.toggle('gps-active', active)
      gpsBtn.textContent = active ? '📍 GPS päällä' : '📍 GPS'
    })
    panel.appendChild(gpsBtn)

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

    // T218/V143: keräyskasa-tehtävän elävä keräyslista (markerTypeFilter). Asettaminen-heron tilalla.
    const collectionEl = document.createElement('div')
    collectionEl.className = 'segment-view-collect'
    collectionEl.hidden = true
    panel.appendChild(collectionEl)

    // T262/V182: KOTI-moodin inline-varustelista (varustarkastus). Kartta-moodissa CSS piilottaa.
    const equipmentEl = document.createElement('div')
    equipmentEl.className = 'segment-view-equipment'
    panel.appendChild(equipmentEl)

    // T263/V183: KOTI-moodin inline "Kaikki merkit" -lista. Kartta-moodissa CSS piilottaa.
    const markerListEl = document.createElement('div')
    markerListEl.className = 'segment-view-markers'
    panel.appendChild(markerListEl)

    // T228: EI inline-merkkilistaa — "Kaikki merkit" -modaali (yläpalkki) on ainoa per-merkki-lista
    // (bulk + rivi→MarkerDetailModal). Inline-lista duplikoi sen ja söi kartan tilan → poistettu.
    // T233/V155: Varustelista-nappi siirtyi yläpalkkiin (avaa openEquipment()); ei enää panelissa.

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

    // T232 (A)/V158: "Lisää ⋯" panel-tason sekundäärivalikko — complete + bounds sen sisällä,
    // pois hero-primarysta mutta tavoitettavana kaikissa phaseissa (ei asettaminen-only hero-overflow).
    const moreSection = document.createElement('div')
    moreSection.className = 'segment-view-more'
    moreSection.hidden = true

    const moreToggle = document.createElement('button')
    moreToggle.type = 'button'
    moreToggle.className = 'btn btn--ghost segment-view-more-toggle'
    moreToggle.setAttribute('aria-haspopup', 'true')
    moreToggle.setAttribute('aria-expanded', 'false')
    moreToggle.textContent = 'Lisää ⋯'
    moreSection.appendChild(moreToggle)

    const moreBody = document.createElement('div')
    moreBody.className = 'segment-view-more-body'
    moreBody.hidden = true
    moreSection.appendChild(moreBody)

    moreToggle.addEventListener('click', () => {
      moreBody.hidden = !moreBody.hidden
      moreToggle.setAttribute('aria-expanded', String(!moreBody.hidden))
    })

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
    moreBody.appendChild(completeSection)

    const boundsSection = this.buildBoundsSection()
    moreBody.appendChild(boundsSection)

    // T260/R4: pätkän kommenttilanka-container SIIRRETTY "Lisää ⋯":n alle (thread konstruktorissa).
    // Ei enää liimattuna koti-etusivulle (käyttäjäpalaute "en ymmärrä mikä toi kommentti juttu on
    // etusivulla") — koko-pätkän kommentit saavutettavissa valikosta. Per-merkki-kommentit = merkkimodaali.
    const commentEl = document.createElement('div')
    commentEl.className = 'segment-view-comments'
    moreBody.appendChild(commentEl)

    panel.appendChild(moreSection)

    return {
      panel, progressEl, gpsBtn, nextEl, equipmentEl, markerListEl, collectionEl, bulkBtn,
      inspectSection, inspectBtn, inspectNoteInput, inspectStatus,
      moreSection, boundsSection,
      completeSection, completeBtn, completeStatus, commentEl,
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
