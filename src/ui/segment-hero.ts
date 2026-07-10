import { firstUnsetMarker, unsetMarkersOrdered, stepUnset } from '../logic/navigation'
import type { Segment } from '../logic/segments'
import { buildMarkerVisual } from './marker-visual-row'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignMarker } from '../logic/types'
import type { SegmentViewActions } from './segment-view'

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

// Merkin ihmisluettava nimi: oma label > kirjaston tyyppilabel > tyyppikoodi.
// Jaettu heron ja SegmentView:n keräyslistan (renderCollectionList) kesken.
export function markerLabel(m: SignMarker): string {
  if (m.label) return m.label
  return TYPE_LABELS[m.type] ?? SIGN_TYPES.find(s => s.type === m.type)?.label ?? m.type
}

// T234: heron tarvitsema tila/callbackit SegmentView:stä (koordinaattori). Getterit koska
// segment/markers vaihtuvat update():ssa; actions on stabiili viittaus; setCollapsed on delegaatti.
export interface SegmentHeroContext {
  getSegment(): Segment
  getMarkers(): SignMarker[]
  actions: SegmentViewActions
  setCollapsed(collapsed: boolean): void
}

// "Seuraava merkki" -ohjaus (asettaminen-heron renderöinti). Eristetty SegmentView:stä (T234) —
// puhdas rakenteellinen pilkkominen, käyttäytyminen identtinen.
export class SegmentHero {
  // T232 (C)/V159: hero näyttää yhtä "valittua" asettamatonta merkkiä; ◀▶ selaa. null = oletus
  // (firstUnsetMarker). Aseta/Näytä/overflow/highlight kohdistuvat tähän. render() reconciloi:
  // jos valittu id ei enää ole asettamattomien listalla → palaa firstUnsetMarkeriin.
  private selectedNavId: string | null = null

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentHeroContext,
  ) {}

  // "Seuraava merkki" -ohjaus (hero). Vain asettaminen-phasessa. Ohjaa pätkän asettamattomiin
  // merkkeihin; oletus = ensimmäinen (firstUnsetMarker, pienin distanceFromStart), ◀▶ selaa
  // (stepUnset T231). Aseta/Näytä/overflow/highlight kohdistuvat valittuun merkkiin (V159).
  render(): void {
    const segment = this.ctx.getSegment()
    const markers = this.ctx.getMarkers()
    const actions = this.ctx.actions

    // T218/V143: keräyskasa-tehtävä (markerTypeFilter) käyttää elävää keräyslistaa, EI asettaminen-
    // heroa — merkit sijoitetaan/kerätään tyypin perusteella, ei ennalta suunniteltuina "seuraavina".
    if (segment.markerTypeFilter) {
      this.el.hidden = true
      actions.onNavigate?.(null)
      return
    }
    if (segment.phase !== 'asettaminen') {
      this.el.hidden = true
      actions.onNavigate?.(null)
      return
    }
    this.el.hidden = false
    this.el.innerHTML = ''

    const ordered = unsetMarkersOrdered(markers)
    // V159 reconcile: valittu id kadonnut asettamattomien joukosta (asetettu/poistettu) → nollaa.
    if (this.selectedNavId && !ordered.some(m => m.id === this.selectedNavId)) this.selectedNavId = null
    const current = (this.selectedNavId ? ordered.find(m => m.id === this.selectedNavId) : null)
      ?? firstUnsetMarker(markers)
    this.selectedNavId = current?.id ?? null

    if (!current) {
      // T228: matala done-rivi (⊥ accent-kortti) → kartta esiin, passiivinen tila = matala paino.
      this.el.classList.add('segment-view-next--done')
      const done = document.createElement('div')
      done.className = 'segment-view-next-done'
      const total = markers.length
      done.innerHTML = total === 0
        ? '<span class="segment-view-next-done-title">Ei merkkejä tällä pätkällä</span>'
        : '<span class="segment-view-next-done-title">✓ Kaikki asetettu 🎉</span>'
      this.el.appendChild(done)
      actions.onNavigate?.(null)
      return
    }
    this.el.classList.remove('segment-view-next--done')
    // V159: synkkaa kartan korostus valittuun merkkiin (◀▶ ja reconcile mukaan lukien).
    actions.onNavigate?.(current.id)

    // Otsikkorivi: "Seuraava merkki" + sijaintilaskuri (n/N) kun useampi asettamaton.
    const idx = ordered.findIndex(m => m.id === current.id)
    const label = document.createElement('div')
    label.className = 'segment-view-next-label'
    label.textContent = ordered.length > 1
      ? `Seuraava merkki · ${idx + 1}/${ordered.length}`
      : 'Seuraava merkki'
    this.el.appendChild(label)

    // T232 (C): ◀ merkki ▶ -selailurivi. Nuolet vain jos >1 asettamaton; clamp päihin (disabled).
    const row = document.createElement('div')
    row.className = 'segment-view-next-row'

    if (ordered.length > 1) {
      const prevBtn = document.createElement('button')
      prevBtn.type = 'button'
      prevBtn.className = 'btn btn--ghost segment-view-next-nav segment-view-next-prev'
      prevBtn.setAttribute('aria-label', 'Edellinen asettamaton merkki')
      prevBtn.textContent = '◀'
      prevBtn.disabled = idx <= 0
      prevBtn.addEventListener('click', () => this.navStep(-1))
      row.appendChild(prevBtn)
    }

    row.appendChild(buildMarkerVisual(
      { type: current.type, iconId: current.iconId, label: current.label, parts: current.parts, color: current.color },
      { size: 44, zoomable: false },
    ))

    const info = document.createElement('div')
    info.className = 'segment-view-next-info'
    const km = (current.distanceFromStart / 1000).toFixed(1)
    const nameEl = document.createElement('span')
    nameEl.className = 'segment-view-next-name'
    nameEl.textContent = markerLabel(current)
    const metaEl = document.createElement('span')
    metaEl.className = 'segment-view-next-meta'
    metaEl.textContent = `${km} km`
    info.appendChild(nameEl)
    info.appendChild(metaEl)
    if (current.locationNote) {
      const noteEl = document.createElement('span')
      noteEl.className = 'segment-view-next-note'
      noteEl.textContent = current.locationNote
      info.appendChild(noteEl)
    }
    row.appendChild(info)

    if (ordered.length > 1) {
      const nextBtn = document.createElement('button')
      nextBtn.type = 'button'
      nextBtn.className = 'btn btn--ghost segment-view-next-nav segment-view-next-fwd'
      nextBtn.setAttribute('aria-label', 'Seuraava asettamaton merkki')
      nextBtn.textContent = '▶'
      nextBtn.disabled = idx >= ordered.length - 1
      nextBtn.addEventListener('click', () => this.navStep(1))
      row.appendChild(nextBtn)
    }
    this.el.appendChild(row)

    // T224 (B): primary 2 nappia (VISION max 2) — Aseta + Näytä kartalla. Loput ⋯-valikossa.
    const actionsRow = document.createElement('div')
    actionsRow.className = 'segment-view-next-actions'

    const setBtn = document.createElement('button')
    setBtn.className = 'btn btn--confirm segment-view-next-set'
    setBtn.textContent = '✓ Aseta'
    setBtn.addEventListener('click', () => actions.onSetMarker?.(current.id))
    actionsRow.appendChild(setBtn)

    const showBtn = document.createElement('button')
    showBtn.className = 'btn btn--secondary segment-view-next-show'
    showBtn.textContent = 'Näytä kartalla'
    showBtn.addEventListener('click', () => {
      if (actions.onShowOnMap) { actions.onShowOnMap(current.id); this.ctx.setCollapsed(true) }
      else actions.onFocusMarker?.(current.id)
    })
    actionsRow.appendChild(showBtn)

    const moreBtn = document.createElement('button')
    moreBtn.className = 'btn btn--ghost segment-view-next-more'
    moreBtn.setAttribute('aria-label', 'Lisää toimintoja')
    moreBtn.setAttribute('aria-haspopup', 'true')
    moreBtn.textContent = '⋯'
    actionsRow.appendChild(moreBtn)

    this.el.appendChild(actionsRow)

    // Overflow-valikko: Ei tarpeen · Siirretty · Laita kommentti · + Merkki · Ota kuva (tulossa)
    const menu = document.createElement('div')
    menu.className = 'segment-view-next-menu'
    menu.hidden = true

    const skipItem = document.createElement('button')
    skipItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-skip'
    skipItem.textContent = 'Ei tarpeen'
    skipItem.addEventListener('click', () => { menu.hidden = true; actions.onSkipMarker?.(current.id) })
    menu.appendChild(skipItem)

    const moveItem = document.createElement('button')
    moveItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-move'
    moveItem.textContent = 'Siirretty'
    if (actions.onMoveMarker) {
      moveItem.addEventListener('click', () => { menu.hidden = true; actions.onMoveMarker?.(current.id) })
    } else {
      moveItem.disabled = true
      moveItem.title = 'Tulossa'
    }
    menu.appendChild(moveItem)

    // T228: "Laita kommentti" → avaa detail-modaalin Kommentti-kenttä (löydettävä per-merkki-kommentti).
    const commentItem = document.createElement('button')
    commentItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-comment'
    commentItem.textContent = 'Laita kommentti'
    if (actions.onComment) {
      commentItem.addEventListener('click', () => { menu.hidden = true; actions.onComment?.(current.id) })
    } else {
      commentItem.disabled = true
      commentItem.title = 'Tulossa'
    }
    menu.appendChild(commentItem)

    // T232 (E)/T229: "+ Merkki" — talkoolainen lisää suunnittelematon merkki omalle pätkälle.
    // Siirretty yläpalkista hero-overflowiin (löydettävä, ei kilpaile primary-napeista).
    const addItem = document.createElement('button')
    addItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-add'
    addItem.textContent = '+ Merkki'
    if (actions.onAddMarker) {
      addItem.addEventListener('click', () => { menu.hidden = true; actions.onAddMarker?.() })
    } else {
      addItem.disabled = true
      addItem.title = 'Tulossa'
    }
    menu.appendChild(addItem)

    // "Ota kuva" — talkoolaisen kuvankaappaus tulossa (T221/T103-alue).
    const photoItem = document.createElement('button')
    photoItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-photo'
    photoItem.textContent = 'Ota kuva'
    photoItem.disabled = true
    photoItem.title = 'Tulossa'
    menu.appendChild(photoItem)

    moreBtn.addEventListener('click', () => { menu.hidden = !menu.hidden })
    this.el.appendChild(menu)
  }

  // T232 (C)/V159: ◀▶ vaihtaa hero:n valittua asettamatonta merkkiä (stepUnset T231, clamp päihin).
  // render() re-render synkkaa kartan korostuksen (onNavigate) uuteen valintaan.
  private navStep(dir: 1 | -1): void {
    if (!this.selectedNavId) return
    const target = stepUnset(this.ctx.getMarkers(), this.selectedNavId, dir)
    if (target && target.id !== this.selectedNavId) {
      this.selectedNavId = target.id
      this.render()
    }
  }
}
