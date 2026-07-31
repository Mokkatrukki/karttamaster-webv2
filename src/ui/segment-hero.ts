import { defaultUnsetSelection, unsetMarkersOrdered, pendingMarkersOrdered, stepUnset } from '../logic/navigation'
import { segmentTarget } from '../logic/phase-target'
import { displayKm } from '../logic/segment-order'
import { type Segment } from '../logic/segments'
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
// segment/markers vaihtuvat update():ssa; actions on stabiili viittaus.
// T333/V242: setCollapsed POISTETTU tästä ctx:stä — hero ei enää kutista näkymää (B131).
// Älä kytke sitä takaisin: kutistus on käyttäjän oma komento (chevron), ei toiminnon sivuvaikutus.
export interface SegmentHeroContext {
  getSegment(): Segment
  getMarkers(): SignMarker[]
  actions: SegmentViewActions
}

// "Seuraava merkki" -ohjaus (heron renderöinti). Eristetty SegmentView:stä (T234) — puhdas
// rakenteellinen pilkkominen. T422/V313: sama hero palvelee asettamista JA purkua; vaiheen
// sanat & kohdestatus tulevat `phaseTarget`-lookupista.
export class SegmentHero {
  // T232 (C)/V159: hero näyttää yhtä "valittua" asettamatonta merkkiä; ◀▶ selaa. null = oletus
  // (firstUnsetMarker). Aseta/Näytä/overflow/highlight kohdistuvat tähän. render() reconciloi:
  // jos valittu id ei enää ole asettamattomien listalla → palaa firstUnsetMarkeriin.
  private selectedNavId: string | null = null

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentHeroContext,
  ) {}

  // "Seuraava merkki" -ohjaus (hero). Asettaminen & purku (T422). Ohjaa pätkän AVOIMIIN
  // merkkeihin (V313); oletus = ensimmäinen (firstUnsetMarker, pienin segmentKm), ◀▶ selaa
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
    // T422/V313: hero näkyy MYÖS purussa — purku käy samalla tavalla kuin merkkaaminen
    // (käyttäjäpäätös 2026-07-30). Otsikko, kuittausnappi & valmis-teksti tulevat
    // `phaseTarget`-lookupista, ei if-lauseista: `tarkastus` käyttää segmentin omaa
    // inspected-osiota (V91) eikä merkkiheroa.
    if (segment.phase === 'tarkastus') {
      this.el.hidden = true
      actions.onNavigate?.(null)
      return
    }
    const target = segmentTarget(segment)
    this.el.hidden = false
    this.el.innerHTML = ''

    // T328/V237: akseli tulee PÄTKÄSTÄ, ei erillisenä routeId-parametrina — järjestys JA
    // näytetty km samalta akselilta (B129: hero eteni oikein mutta näytti 0.0 km merkille
    // joka on 25.18 km kohdalla). T420/V312: järjestys on sama ∀ phasella.
    const open = unsetMarkersOrdered(markers, segment)
    // T436/V326: VÄLITILA — avoimia ⊥ ole mutta merkkejä on jäänyt päätetilan ulkopuolelle
    // (purussa: ⊥ koskaan kuitattu asetetuksi). Hero ohjaa niihin SAMALLA pinnalla eikä julista
    // valmista (B175: "✓ Kaikki kerätty 🎉" kun kerättyjä oli 1/12). Välitila on ohjauksessa
    // AINA avoimien jälkeen ∴ oikea purkujärjestys säilyy.
    const pendingOrdered = open.length === 0 ? pendingMarkersOrdered(markers, segment) : []
    const pendingMode = open.length === 0 && pendingOrdered.length > 0
    const ordered = pendingMode ? pendingOrdered : open
    // V159 reconcile: valittu id kadonnut listalta (kuitattu/poistettu) → nollaa.
    if (this.selectedNavId && !ordered.some(m => m.id === this.selectedNavId)) this.selectedNavId = null
    // T413/V304: OLETUSVALINTA (⊥ uudelleenvalinta) — reitittömällä tehtävällä lähin GPS-fixiin,
    // muuten km-järjestyksen ensimmäinen. Hysteresis tulee yllä olevasta reconcilesta: valittu id
    // säilyy niin kauan kuin se on asettamattomien listalla ∴ uusi fix ⊥ vaihda merkkiä alta.
    const current = (this.selectedNavId ? ordered.find(m => m.id === this.selectedNavId) : null)
      ?? (pendingMode ? ordered[0] ?? null : defaultUnsetSelection(markers, segment, actions.gpsPosition?.() ?? null))
    this.selectedNavId = current?.id ?? null

    if (!current) {
      // T228: matala done-rivi (⊥ accent-kortti) → kartta esiin, passiivinen tila = matala paino.
      this.el.classList.add('segment-view-next--done')
      const done = document.createElement('div')
      done.className = 'segment-view-next-done'
      const total = markers.length
      done.innerHTML = total === 0
        ? '<span class="segment-view-next-done-title">Ei merkkejä tällä pätkällä</span>'
        : `<span class="segment-view-next-done-title">${target.doneLabel}</span>`
      this.el.appendChild(done)
      // T351/V254 (B140): valmiussignaali & sen kuittaus SAMASSA näkymässä. Ennen tätä nappi oli
      // vain "Kaikki merkit" -tabin pohjalla + yläpalkin ⋯:ssä ∴ talkoolaisen VIIMEINEN askel
      // metsässä vaati tabinvaihdon tai valikon. total===0 ("Ei merkkejä") ⊥ saa nappia — tyhjä
      // pätkä ⊥ ole valmiussignaali. Sanamuoto & tokenit = SegmentView.renderCompleteSection (T230).
      if (total > 0 && actions.onComplete) {
        const completed = segment.completed ?? false
        const btn = document.createElement('button')
        btn.type = 'button'
        // Jaettu `segment-view-complete-btn` = jaetut tokenit (leveys/keskitys); oma
        // `segment-hero-complete-btn` erottaa hero-napin tabin osiosta valitsimissa.
        btn.className = completed
          ? 'btn btn--secondary segment-view-complete-btn segment-hero-complete-btn'
          : 'btn btn--confirm segment-view-complete-btn segment-hero-complete-btn'
        btn.textContent = completed ? '↩ Merkitse keskeneräiseksi' : '✓ Merkitse pätkä valmiiksi'
        btn.addEventListener('click', () => actions.onComplete?.(!completed))
        this.el.appendChild(btn)
      }
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
      ? `${target.nextLabel} · ${idx + 1}/${ordered.length}`
      : target.nextLabel
    this.el.appendChild(label)

    // T232 (C): ◀ merkki ▶ -selailurivi. Nuolet vain jos >1 asettamaton; clamp päihin (disabled).
    const row = document.createElement('div')
    row.className = 'segment-view-next-row'

    if (ordered.length > 1) {
      const prevBtn = document.createElement('button')
      prevBtn.type = 'button'
      prevBtn.className = 'btn btn--ghost segment-view-next-nav segment-view-next-prev'
      prevBtn.setAttribute('aria-label', 'Edellinen merkki')
      prevBtn.textContent = '◀'
      prevBtn.disabled = idx <= 0
      prevBtn.addEventListener('click', () => this.navStep(-1))
      row.appendChild(prevBtn)
    }

    // T312/V224: 3-sarakkeinen rivi — ◀ kiinni vasempaan, joustava keskiosa (ikoni+nimi), ▶ kiinni
    // oikeaan. Keskiosa on OMA flex:1;min-width:0 -laatikko ∴ pitkä merkin nimi ellipsoituu eikä
    // työnnä nuolta: nuolen x-sijainti on vakio merkistä merkkiin (hanskakäsi löytää kohteen).
    const body = document.createElement('div')
    body.className = 'segment-view-next-body'

    body.appendChild(buildMarkerVisual(
      { type: current.type, iconId: current.iconId, label: current.label, parts: current.parts, color: current.color },
      { size: 44, zoomable: false },
    ))

    const info = document.createElement('div')
    info.className = 'segment-view-next-info'
    // T328/V237/B129: lukema PÄTKÄN akselilta — sama akseli kuin järjestys. Skalaari näytti
    // 0.0 km merkille joka on 25.18 km kohdalla (mitattu smtb-30:ltä) ⇒ "hyppii sinne tänne".
    const km = (displayKm(current, segment) / 1000).toFixed(1)
    const nameEl = document.createElement('span')
    nameEl.className = 'segment-view-next-name'
    nameEl.textContent = markerLabel(current)
    const metaEl = document.createElement('span')
    metaEl.className = 'segment-view-next-meta'
    metaEl.textContent = `${km} km`
    info.appendChild(nameEl)
    info.appendChild(metaEl)
    // T436/V326: välitilan syy näkyy merkin rivillä — talkoolainen näkee kentällä onko merkki
    // siellä & voi kerätä sen ilman että joku käy ensin merkitsemässä sen asetetuksi.
    if (pendingMode) {
      const warnEl = document.createElement('span')
      warnEl.className = 'segment-view-next-note segment-view-next-pending'
      warnEl.textContent = target.pendingLabel
      info.appendChild(warnEl)
    }
    if (current.locationNote) {
      const noteEl = document.createElement('span')
      noteEl.className = 'segment-view-next-note'
      noteEl.textContent = current.locationNote
      info.appendChild(noteEl)
    }
    body.appendChild(info)
    row.appendChild(body)

    if (ordered.length > 1) {
      const nextBtn = document.createElement('button')
      nextBtn.type = 'button'
      nextBtn.className = 'btn btn--ghost segment-view-next-nav segment-view-next-fwd'
      nextBtn.setAttribute('aria-label', 'Seuraava merkki')
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
    setBtn.textContent = target.actionLabel
    // T422/V313: kuittaus vie vaiheen kohdestatukseen. Kutsupolut ovat olemassa molemmille
    // (`onSetMarker` T220, `onCollectMarker` T218/V143) ∴ ei uutta mutaatiotietä — vain valinta.
    setBtn.addEventListener('click', () => {
      if (target.targetStatus === 'kerätty') actions.onCollectMarker?.(current.id, true)
      else actions.onSetMarker?.(current.id)
    })
    actionsRow.appendChild(setBtn)

    const showBtn = document.createElement('button')
    showBtn.className = 'btn btn--secondary segment-view-next-show'
    showBtn.textContent = 'Näytä kartalla'
    showBtn.addEventListener('click', () => {
      // T333/V242: panoroi VAIN — ⊥ kutista näkymää. Kutistus vei koko heron (.segment-view-next)
      // ja ainoa paluu oli merkitsemätön chevron ∴ umpikuja kentällä (B131).
      if (actions.onShowOnMap) actions.onShowOnMap(current.id)
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

    // T429/V319: OVERFLOW ON VAIHEEN FUNKTIO. Purussa merkillä on tasan kaksi toimintoa
    // ("Kerätty" + "Ei löytynyt"): Siirretty/Lisää ohje/+ Merkki/Ota kuva ovat SUUNNITTELUN
    // työkaluja & purussa merkki on jo maastossa. Kolmas nappi metsässä on kolmas tapa painaa
    // väärää. Poistetaan ⊥ disabloida — disabloitu rivi on kuollut pinta (V250).
    const purku = segment.phase === 'purku'
    const menu = document.createElement('div')
    menu.className = 'segment-view-next-menu'
    menu.hidden = true

    // Sekundääri on ainoa toiminto joka säilyy kaikissa vaiheissa; sen SANA tulee lookupista.
    const skipItem = document.createElement('button')
    skipItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-skip'
    skipItem.textContent = target.secondaryLabel
    skipItem.addEventListener('click', () => { menu.hidden = true; actions.onSkipMarker?.(current.id) })
    menu.appendChild(skipItem)

    if (!purku) {
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

      // T228/T380/V275: "Lisää ohje" → avaa detail-modaalin ohjekentän (locationNote). Merkin
      // lisätieto on yksisuuntainen ohje ⊥ keskustelu — vanha nimi lupasi lankaa jota ⊥ ollut.
      const commentItem = document.createElement('button')
      commentItem.className = 'btn btn--ghost segment-view-next-menu-item segment-view-next-comment'
      commentItem.textContent = 'Lisää ohje'
      if (actions.onComment) {
        commentItem.addEventListener('click', () => { menu.hidden = true; actions.onComment?.(current.id) })
      } else {
        commentItem.disabled = true
        commentItem.title = 'Tulossa'
      }
      menu.appendChild(commentItem)

      // T232 (E)/T229: "+ Merkki" — talkoolainen lisää suunnittelematon merkki omalle pätkälle.
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
    }

    moreBtn.addEventListener('click', () => { menu.hidden = !menu.hidden })
    this.el.appendChild(menu)
  }

  // T232 (C)/V159: ◀▶ vaihtaa hero:n valittua asettamatonta merkkiä (stepUnset T231, clamp päihin).
  // render() re-render synkkaa kartan korostuksen (onNavigate) uuteen valintaan.
  private navStep(dir: 1 | -1): void {
    if (!this.selectedNavId) return
    const markers = this.ctx.getMarkers()
    const segment = this.ctx.getSegment()
    // Sama akseli kuin render():ssä (V237) — muuten ◀▶ selaisi eri järjestystä kuin lista näyttää.
    // T436/V326: sama VALINTA kuin render():ssä — välitilassa selataan välitilan merkkejä
    // (samat clamp-säännöt kuin stepUnset: ei wrap-aroundia, tuntematon id → ensimmäinen).
    const open = unsetMarkersOrdered(markers, segment)
    let target: SignMarker | null
    if (open.length > 0) {
      target = stepUnset(markers, this.selectedNavId, dir, segment)
    } else {
      const pending = pendingMarkersOrdered(markers, segment)
      if (pending.length === 0) return
      const idx = pending.findIndex(m => m.id === this.selectedNavId)
      target = idx === -1 ? pending[0] : pending[Math.min(pending.length - 1, Math.max(0, idx + dir))]
    }
    if (target && target.id !== this.selectedNavId) {
      this.selectedNavId = target.id
      this.render()
    }
  }
}
