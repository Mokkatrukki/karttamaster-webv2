import { createAndPushSegment } from '../logic/segment-create'
import { PILE_TEMPLATE_ID, pileTemplate } from '../logic/pile'
import type { Segment, SegmentStore } from '../logic/segments'
import type { SignMarker } from '../logic/types'
import type { SegmentTrack } from '../logic/segment-track'
import { registerEscClose, createBackdrop } from './modal-helpers'

// T362/B144: luonti kerää ANKKUREITA (reitin pisteindeksejä), ⊥ kahta km-lukua. Väliankkurit
// ratkaisevat kierroksen: haku etenee aina edellisestä indeksistä ∴ edestakainen osuus ⊥ ole arvaus.
export interface CreationAnchor {
  idx: number
  dist: number
  lat: number
  lon: number
}

export type CreationState =
  | { mode: 'idle' }
  | { mode: 'vaihe1' }
  // T362: reitti LUKITTU ensimmäisestä klikistä & näkyvissä (B144(a): hiljainen valinta oli
  // puolet bugista). `anchors` kasvaa klikeistä; ≥2 → "Valmis" avautuu.
  // T389/V281: `origin` = ensiklikin RAAKA koordinaatti ∴ reitin vaihto re-resolvoi ankkurin
  // siitä mihin käyttäjä osoitti, ⊥ lukitun reitin snapatusta pisteestä (joka on jo tulkinta).
  // `routeChoices` = näkyvät reitit joilla on osuma originin lähellä — 1 ehdokas → ⊥ pillereitä.
  | {
      mode: 'polku'
      routeId: string
      routeLabel: string
      anchors: CreationAnchor[]
      origin: { lat: number; lon: number }
      routeChoices: { id: string; label: string }[]
    }
  // T299/V211: primaryRouteId = reitti jota startDist/endDist mittaavat. routeIds = jäsenyys.
  // T362/V258: `track` on pätkän geometrian totuus; startDist/endDist johdetaan siitä.
  | { mode: 'tiedot'; routeIds: string[]; primaryRouteId: string; startDist: number; endDist: number; track: SegmentTrack }
  // T216/V139: reititön (alue)tehtävä — ei reitti-klikkejä, vaan nimi + kuvaus + valinnainen merkkijoukko
  | { mode: 'reititon' }

// T216/V140: markerTypeFilter-vaihtoehdot johdetaan olemassa olevista merkeistä — uniikit
// templateId:t (ei erillistä template-kirjastoa tarvita). Label = merkin label tai templateId.
function distinctTemplateOptions(markers: SignMarker[]): { templateId: string; label: string }[] {
  const seen = new Map<string, string>()
  // T425/V315: kasa on AINA valittavissa, vaikka yhtään kasaa ei olisi vielä jätetty. Ilman
  // tätä ketju on umpisolmussa: autoporukan keräystehtävää ei voi luoda ennen ensimmäistä
  // kasaa, mutta kasan jättäminen on hyödytöntä ennen kuin joku hakee sen. Kasa-template on
  // sisäänrakennettu (V315) ∴ se on olemassa riippumatta datasta.
  seen.set(PILE_TEMPLATE_ID, pileTemplate().label)
  for (const m of markers) {
    if (m.templateId && !seen.has(m.templateId)) {
      if (m.templateId !== PILE_TEMPLATE_ID) seen.set(m.templateId, m.label ?? m.type ?? m.templateId)
    }
  }
  return Array.from(seen, ([templateId, label]) => ({ templateId, label }))
}

export class SegmentCreationModal {
  private backdrop: HTMLElement | null = null
  private unregEsc: (() => void) | null = null
  private segmentCounter: number

  constructor(
    private readonly store: SegmentStore,
    private readonly onCancel: () => void,
    private readonly onSaved: (seg: Segment) => void,
    // T150/V94: uusi pätkä syntyy järjestäjän aktiiviseen phase-näkymään, ei hardcoded 'asettaminen'
    private readonly getPhase: () => Segment['phase'] = () => 'asettaminen',
    // T216/V140: merkkiliitoksen lähde (eksplisiittinen checklist + tyyppisuodattimen vaihtoehdot)
    private readonly getMarkers: () => SignMarker[] = () => [],
    // T362: polkutilan napit — paneeli omistaa ankkurit, modaali vain pyytää muutosta.
    private readonly onUndoAnchor: (() => void) | null = null,
    private readonly onPathDone: (() => void) | null = null,
    // T389/V281: reitin vaihto — paneeli omistaa ankkurit & re-resolvoinnin, modaali vain pyytää.
    private readonly onSwitchRoute: ((routeId: string) => void) | null = null,
  ) {
    this.segmentCounter = store.size
  }

  open(state: CreationState): void {
    this.close()

    const backdrop = createBackdrop('segment-creation-modal-backdrop', () => this.onCancel())

    const modal = document.createElement('div')
    modal.className = 'segment-creation-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Luo uusi pätkä')
    modal.dataset.testid = 'creation-modal'

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.backdrop = backdrop
    this.unregEsc = registerEscClose(() => this.onCancel())

    this.updatePhase(state)
  }

  updatePhase(state: CreationState): void {
    if (!this.backdrop) return
    const modal = this.backdrop.querySelector('.segment-creation-modal') as HTMLElement
    if (!modal) return
    modal.innerHTML = ''

    const inMapPhase = state.mode === 'vaihe1' || state.mode === 'polku'
    this.backdrop.dataset.phase = state.mode
    this.backdrop.style.pointerEvents = inMapPhase ? 'none' : 'all'
    modal.style.pointerEvents = 'all'

    modal.appendChild(this.buildHeader(state.mode === 'reititon' ? 'Luo aluetehtävä' : 'Luo uusi pätkä'))

    if (state.mode === 'vaihe1' || state.mode === 'polku') {
      modal.appendChild(this.buildProgress(state.mode === 'vaihe1' ? 1 : 2))

      const instruction = document.createElement('p')
      instruction.className = 'segment-creation-instruction'
      instruction.textContent =
        state.mode === 'vaihe1'
          ? 'Klikkaa kartalta pätkän aloituspiste'
          : 'Klikkaa reittiä pitkin eteenpäin — lopeta "Valmis"-napilla'
      modal.appendChild(instruction)

      if (state.mode === 'polku') this.appendPathSection(modal, state)

      const errorEl = document.createElement('p')
      errorEl.className = 'segment-creation-error'
      errorEl.hidden = true
      errorEl.dataset.errorEl = 'true'
      modal.appendChild(errorEl)
    } else if (state.mode === 'tiedot') {
      modal.appendChild(this.buildProgress(3))
      this.appendTiedotForm(modal, state.routeIds, state.primaryRouteId, state.startDist, state.endDist, state.track)
    } else if (state.mode === 'reititon') {
      this.appendReititonForm(modal)
    }
  }

  setError(msg: string): void {
    const errorEl = this.backdrop?.querySelector('[data-error-el]') as HTMLElement | null
    if (errorEl) {
      errorEl.textContent = msg
      errorEl.hidden = false
    }
  }

  close(): void {
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }

  // T362/B144(a): reitti & ankkurien km NÄKYVIIN. Ennen tätä luonti valitsi reitin hiljaa
  // (3 SMTB-reittiä ≤100 m toisistaan ∴ metrien snap-ero ratkaisi) & järjestäjä näki valinnan
  // vasta tallennuksen jälkeen kartalta. Näkyvä lista on se mikä tekee virheestä peruttavan.
  private appendPathSection(modal: HTMLElement, state: Extract<CreationState, { mode: 'polku' }>): void {
    const route = document.createElement('p')
    route.className = 'segment-creation-info segment-creation-route'
    route.dataset.testid = 'creation-route'
    route.textContent = `Reitti: ${state.routeLabel}`
    modal.appendChild(route)

    // T389/V281/B164: reitin vaihto ilman uutta aloitusta. Pillerit vain kun ehdokkaita on ≥2 —
    // yhden reitin kohdalla valinta ⊥ ole valinta vaan kohinaa. Vaihto NOLLAA ankkurit yhteen
    // (paneeli hoitaa): toisen reitin pisteindeksi ⊥ tarkoita samaa maastoa (V258/B144).
    if (state.routeChoices.length >= 2) {
      const choices = document.createElement('div')
      choices.className = 'segment-creation-route-choices'
      for (const c of state.routeChoices) {
        const pill = document.createElement('button')
        pill.className = 'segment-creation-route-choice'
        if (c.id === state.routeId) pill.classList.add('active')
        pill.dataset.routeId = c.id
        pill.textContent = c.label
        pill.setAttribute('aria-pressed', String(c.id === state.routeId))
        pill.addEventListener('click', () => this.onSwitchRoute?.(c.id))
        choices.appendChild(pill)
      }
      modal.appendChild(choices)
    }

    const list = document.createElement('ol')
    list.className = 'segment-creation-anchors'
    for (const [i, a] of state.anchors.entries()) {
      const li = document.createElement('li')
      li.className = 'segment-creation-anchor'
      const label = i === 0 ? 'Alku' : i === state.anchors.length - 1 ? 'Loppu' : `Välipiste ${i}`
      li.textContent = `${label}: ${(a.dist / 1000).toFixed(1)} km`
      list.appendChild(li)
    }
    modal.appendChild(list)
    // Lista rakennetaan uudelleen joka klikillä ∴ scroll palaisi alkuun & JUURI klikattu ankkuri
    // jäisi näkymättömiin 6. ankkurista eteenpäin (max-height 132px ≈ 6 riviä). Viimeinen rivi
    // on se jota "Poista viimeinen" koskee — se ! olla näkyvissä jotta peruutus on tietoinen.
    list.scrollTop = list.scrollHeight

    const actions = document.createElement('div')
    actions.className = 'segment-creation-path-actions'

    const undoBtn = document.createElement('button')
    undoBtn.className = 'btn btn--secondary btn-segment-anchor-undo'
    undoBtn.textContent = 'Poista viimeinen'
    // Ensimmäistä ankkuria ⊥ voi poistaa erikseen: ilman sitä reitti ⊥ ole lukittu ∴ tila olisi
    // "polku ilman reittiä". Peruuta-nappi (header) on se ulospääsy — yksi tapa, ⊥ kaksi.
    undoBtn.disabled = state.anchors.length < 2
    undoBtn.addEventListener('click', () => this.onUndoAnchor?.())
    actions.appendChild(undoBtn)

    const doneBtn = document.createElement('button')
    doneBtn.className = 'btn btn--confirm btn-segment-path-done'
    doneBtn.textContent = 'Valmis'
    // V258: jälki tarvitsee ≥2 ankkuria. Nappi näkyy heti mutta on disabloitu ∴ järjestäjä
    // näkee mitä puuttuu (⊥ ilmesty yllättäen kesken klikkailun).
    doneBtn.disabled = state.anchors.length < 2
    doneBtn.addEventListener('click', () => this.onPathDone?.())
    actions.appendChild(doneBtn)

    modal.appendChild(actions)
  }

  private buildHeader(titleText = 'Luo uusi pätkä'): HTMLElement {
    const header = document.createElement('div')
    header.className = 'segment-creation-modal-header'

    const title = document.createElement('span')
    title.className = 'segment-creation-modal-title'
    title.textContent = titleText
    header.appendChild(title)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'segment-creation-modal-cancel'
    cancelBtn.setAttribute('aria-label', 'Peruuta')
    cancelBtn.textContent = '✕'
    cancelBtn.addEventListener('click', () => this.onCancel())
    header.appendChild(cancelBtn)

    return header
  }

  private buildProgress(activeSteps: number): HTMLElement {
    const progress = document.createElement('div')
    progress.className = 'segment-creation-progress'
    const steps: string[] = []
    for (let i = 1; i <= 3; i++) {
      if (i > 1) steps.push('<span class="step-sep">—</span>')
      steps.push(`<span class="step ${i <= activeSteps ? 'active' : ''}">${i}</span>`)
    }
    progress.innerHTML = steps.join('')
    return progress
  }

  private appendTiedotForm(
    modal: HTMLElement,
    routeIds: string[],
    primaryRouteId: string,
    startDist: number,
    endDist: number,
    track: SegmentTrack,
  ): void {
    const nameSection = document.createElement('div')
    nameSection.className = 'segment-creation-modal-section'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = 'Pätkän nimi'
    nameSection.appendChild(nameLabel)
    const nameInput = document.createElement('input')
    nameInput.className = 'segment-creation-name-input'
    nameInput.type = 'text'
    this.segmentCounter++
    nameInput.value = `Pätkä ${this.segmentCounter}`
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
      const displayName = nameInput.value.trim() || `Pätkä ${this.segmentCounter}`
      const description = descInput.value.trim() || undefined
      const seg = createAndPushSegment(this.store, {
        routeIds, primaryRouteId, startDist, endDist,
        // T362/V258: jälki syntyy klikatuista ankkureista ∴ pätkä on eksklusiivisen
        // jäsenyyden (V259) piirissä heti — ⊥ odota T361:n backfilliä.
        track,
        equipment: [],
        phase: this.getPhase(),
        displayName,
        description,
      })
      this.close()
      this.onSaved(seg)
    })
    footer.appendChild(saveBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-segment-creation-cancel'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.addEventListener('click', () => this.onCancel())
    footer.appendChild(cancelBtn)

    modal.appendChild(footer)
  }

  // T216/V139/V140: reitittömän (alue)tehtävän luontilomake — ei reitti-klikkiä.
  // Nimi + kuvaus + valinnainen merkkijoukko: (a) eksplisiittinen checklist (linkedMarkerIds),
  // (b) dynaaminen tyyppisuodatin (markerTypeFilter).
  private appendReititonForm(modal: HTMLElement): void {
    const nameSection = document.createElement('div')
    nameSection.className = 'segment-creation-modal-section'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = 'Tehtävän nimi'
    nameSection.appendChild(nameLabel)
    const nameInput = document.createElement('input')
    nameInput.className = 'segment-creation-name-input'
    nameInput.type = 'text'
    this.segmentCounter++
    nameInput.value = `Aluetehtävä ${this.segmentCounter}`
    nameInput.placeholder = 'Esim. Maalialue, Keräyskasat'
    nameSection.appendChild(nameInput)
    modal.appendChild(nameSection)

    const descSection = document.createElement('div')
    descSection.className = 'segment-creation-modal-section'
    const descLabel = document.createElement('label')
    descLabel.textContent = 'Järjestäjän ohjeet'
    descSection.appendChild(descLabel)
    const descInput = document.createElement('textarea')
    descInput.className = 'segment-creation-desc-input'
    descInput.placeholder = 'Esim. Kerää kaikki keräyskasat maastosta'
    descInput.rows = 3
    descSection.appendChild(descInput)
    modal.appendChild(descSection)

    const markers = this.getMarkers()

    // (b) Dynaaminen tyyppisuodatin — valitse merkkityyppi, jonka kaikki osumat kuuluvat tehtävään.
    const typeOptions = distinctTemplateOptions(markers)
    let typeSelect: HTMLSelectElement | null = null
    if (typeOptions.length > 0) {
      const typeSection = document.createElement('div')
      typeSection.className = 'segment-creation-modal-section'
      const typeLabel = document.createElement('label')
      typeLabel.textContent = 'Tyyppisuodatin (valinnainen)'
      typeSection.appendChild(typeLabel)
      typeSelect = document.createElement('select')
      typeSelect.className = 'segment-creation-typefilter'
      const none = document.createElement('option')
      none.value = ''
      none.textContent = '— ei tyyppisuodatinta —'
      typeSelect.appendChild(none)
      for (const opt of typeOptions) {
        const o = document.createElement('option')
        o.value = opt.templateId
        o.textContent = opt.label
        typeSelect.appendChild(o)
      }
      typeSection.appendChild(typeSelect)
      modal.appendChild(typeSection)
    }

    // (a) Eksplisiittinen merkkiliitos — checklist olemassa olevista merkeistä.
    const checkedIds = new Set<string>()
    if (markers.length > 0) {
      const linkSection = document.createElement('div')
      linkSection.className = 'segment-creation-modal-section segment-creation-linklist'
      const linkLabel = document.createElement('label')
      linkLabel.textContent = 'Liitä merkit (valinnainen)'
      linkSection.appendChild(linkLabel)
      const list = document.createElement('div')
      list.className = 'segment-creation-marker-checklist'
      for (const m of markers) {
        const row = document.createElement('label')
        row.className = 'segment-creation-marker-check'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.value = m.id
        cb.addEventListener('change', () => {
          if (cb.checked) checkedIds.add(m.id)
          else checkedIds.delete(m.id)
        })
        const txt = document.createElement('span')
        txt.textContent = m.label ?? m.type ?? m.id.slice(0, 6)
        row.appendChild(cb)
        row.appendChild(txt)
        list.appendChild(row)
      }
      linkSection.appendChild(list)
      modal.appendChild(linkSection)
    }

    const footer = document.createElement('div')
    footer.className = 'segment-creation-modal-footer'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn-segment-creation-save'
    saveBtn.textContent = 'Tallenna'
    saveBtn.addEventListener('click', () => {
      const displayName = nameInput.value.trim() || `Aluetehtävä ${this.segmentCounter}`
      const description = descInput.value.trim() || undefined
      const markerTypeFilter = typeSelect?.value || undefined
      const linkedMarkerIds = checkedIds.size > 0 ? Array.from(checkedIds) : undefined
      // V139: reititön → EI route-kenttiä. createSegment ohittaa V11/V25 (T212).
      const seg = createAndPushSegment(this.store, {
        equipment: [],
        phase: this.getPhase(),
        displayName,
        description,
        linkedMarkerIds,
        markerTypeFilter,
      })
      this.close()
      this.onSaved(seg)
    })
    footer.appendChild(saveBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-segment-creation-cancel'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.addEventListener('click', () => this.onCancel())
    footer.appendChild(cancelBtn)

    modal.appendChild(footer)
  }
}
