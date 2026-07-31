// T448/V332: `/kasat` — AUTOPORUKAN OMA NÄKYMÄ.
//
// Autoporukka ei avaa pätkänäkymää lainkaan: hän ajaa teitä, ei polkuja ∴ hänen karttansa on
// kasat + oma sijainti, ei reittejä. T425 rakensi keräyslistan pätkän SISÄÄN ∴ työlle ei ollut
// aloituspistettä ("en tiedä mistä voin tehdä kasan keräyspätkän", käyttäjä 2026-07-31).
//
// Lista tulee `listPiles`istä (`src/logic/pile-list.ts`) — tämä moduuli EI suodata eikä
// järjestä mitään: kaksi mielipidettä järjestyksestä on kaksi eri listaa.
//
// DOM ilman Leafletia → Vitest-jsdom. Kartta on `src/kasat.ts`:n asia.

import type { PileRow } from '../logic/pile-list'
import { formatPileDistance, formatPileSummary, PILE_TARGET } from '../logic/pile-list'
import { navTarget, navUrl } from '../logic/nav-link'
import { pileClaim, formatClaimLabel } from '../logic/pile-claim'
import type { Segment } from '../logic/segments'

export interface KasatPageOpts {
  piles: PileRow[]
  /** Tapahtuman GLOBAALI vaihe (§C) — kasapinta elää vain purussa. */
  phase: Segment['phase']
  /** Onko GPS-fix saatu. Ilman sitä lista on luontijärjestyksessä & se sanotaan ääneen. */
  hasFix?: boolean
  /** "✓ Haettu". Puuttuu → nappia ei renderöidä (lukunäkymä). */
  onCollected?(id: string): void
  /** Rivin napautus → kartta kasalle. */
  onSelect?(id: string): void

  // ── T449/V333: varaus, VALINNAINEN toinen vaihde ──────────────────────────────────────────
  /** Onko monivalinta päällä. OLETUS false: yhden auton porukka ⊥ näe varauskoneistoa. */
  selectMode?: boolean
  /** Monivalinnassa valitut. */
  selected?: Set<string>
  /** Kytkin "Valitse useita" ↔ "Valmis". Puuttuu → varausta ⊥ renderöidä lainkaan. */
  onToggleSelectMode?(): void
  onToggleSelect?(id: string): void
  /** "Otan valitut (N)". */
  onClaimSelected?(ids: string[]): void
  /** "Vapauta" — kenen tahansa käytettävissä (V333). */
  onRelease?(id: string): void

  /**
   * V333/V322: epäonnistuneen varauksen/vapautuksen viesti. Banneri ⊥ toast: varaus on ainoa
   * toiminto joka vaatii verkon & sen epäonnistuminen ! näkyä hanskat kädessä auringossa ∴
   * viesti jää ruudulle kunnes se kuitataan, ⊥ katoa 3 sekunnissa selän takana.
   */
  error?: string | null
  /** Bannerin ✕ — kuittaus on käyttäjän, ⊥ ajastimen. Puuttuu → banneri ilman sulkunappia. */
  onDismissError?(): void
}

const PHASE_LABEL: Record<Segment['phase'], string> = {
  asettaminen: 'Asetus',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

export function renderKasatPage(container: HTMLElement, opts: KasatPageOpts): void {
  const {
    piles, phase, hasFix = false, onCollected, onSelect,
    selectMode = false, selected = new Set<string>(),
    onToggleSelectMode, onToggleSelect, onClaimSelected, onRelease,
    error = null, onDismissError,
  } = opts
  container.innerHTML = ''
  container.classList.add('kasat-page')

  // V333: epäonnistunut varaus ENSIMMÄISENÄ & isolla. Rivi on jo palautunut varaamattomaksi
  // (kasat.ts hakee serverin tilan) ∴ banneri kertoo MIKSI mitään ei tapahtunut — ilman sitä
  // näkymä väittäisi hiljaisuudella että nappia ⊥ painettu.
  if (error) {
    const banner = document.createElement('div')
    banner.className = 'kasat-error'
    banner.setAttribute('role', 'alert')
    const text = document.createElement('p')
    text.className = 'kasat-error-text'
    text.textContent = error
    banner.appendChild(text)
    if (onDismissError) {
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'kasat-error-close'
      close.setAttribute('aria-label', 'Sulje virheilmoitus')
      close.textContent = '✕'
      close.addEventListener('click', () => onDismissError())
      banner.appendChild(close)
    }
    container.appendChild(banner)
  }

  // §C: koko kasapinta elää VAIN kun globaali vaihe on purku. Kasat ovat tapahtuman tosiasia,
  // ⊥ järjestäjän näkymävalinta (V321-jako) ∴ tässä ⊥ lueta katseluvaihetta.
  // V21-linja: tyhjä ruutu luetaan rikkinäiseksi ∴ kerro MIKSI täällä ei ole mitään.
  if (phase !== 'purku') {
    const notice = document.createElement('p')
    notice.className = 'kasat-empty kasat-notice'
    notice.textContent = `Kasat haetaan purkuvaiheessa. Menossa on ${PHASE_LABEL[phase].toLowerCase()}.`
    container.appendChild(notice)
    return
  }

  const header = document.createElement('div')
  header.className = 'kasat-header'
  const title = document.createElement('h2')
  const open = piles.filter(p => !p.done).length
  title.textContent = `Kasat (${open})`
  header.appendChild(title)
  if (!hasFix && piles.length > 0) {
    // Ilman fixiä järjestys ⊥ ole etäisyys ∴ sitä ⊥ saa esittää etäisyysjärjestyksenä.
    const note = document.createElement('p')
    note.className = 'kasat-fix-note'
    note.textContent = 'Ei sijaintia — lista ei ole etäisyysjärjestyksessä.'
    header.appendChild(note)
  }
  container.appendChild(header)

  if (piles.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'kasat-empty'
    empty.textContent = 'Ei kasoja vielä. Purkajat jättävät kasat maastoon — ne ilmestyvät tähän itsestään.'
    container.appendChild(empty)
    return
  }

  if (open === 0) {
    const done = document.createElement('p')
    done.className = 'kasat-empty kasat-done'
    // Onnistuminen ⊥ ole tyhjä lista: se sanotaan ääneen (V21-suku).
    done.textContent = PILE_TARGET.doneLabel
    container.appendChild(done)
  }

  // T449a/V333: kytkin on AINOA varauskoneiston jälki oletusnäkymässä. Yhden auton porukka
  // ⊥ napauta sitä koskaan & hänen listansa on rivi = toiminto, kuten ennenkin.
  if (onToggleSelectMode) {
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'btn kasat-select-toggle'
    toggle.textContent = selectMode ? 'Valmis' : 'Valitse useita'
    toggle.setAttribute('aria-pressed', String(selectMode))
    toggle.addEventListener('click', () => onToggleSelectMode())
    container.appendChild(toggle)
  }

  const list = document.createElement('ul')
  list.className = 'kasat-list'
  for (const row of piles) {
    list.appendChild(buildRow(row, {
      onCollected, onSelect, onRelease,
      selectMode: selectMode && onToggleSelect !== undefined,
      checked: selected.has(row.marker.id),
      onToggleSelect,
    }))
  }
  container.appendChild(list)

  // "Otan valitut (N)" ilmestyy VAIN valintatilassa & vain kun valittuja on: nolla-valinnan
  // nappi olisi hiljainen no-op, joka hanskat kädessä lukeutuu rikkinäiseksi napiksi.
  if (selectMode && onClaimSelected && selected.size > 0) {
    const bar = document.createElement('div')
    bar.className = 'kasat-claim-bar'
    const claim = document.createElement('button')
    claim.type = 'button'
    claim.className = 'btn btn-primary kasat-claim-btn'
    claim.textContent = `Otan valitut (${selected.size})`
    claim.addEventListener('click', () => onClaimSelected([...selected]))
    bar.appendChild(claim)
    container.appendChild(bar)
  }
}

interface RowOpts {
  onCollected?(id: string): void
  onSelect?(id: string): void
  onRelease?(id: string): void
  selectMode: boolean
  checked: boolean
  onToggleSelect?(id: string): void
}

function buildRow(row: PileRow, opts: RowOpts): HTMLLIElement {
  const { onCollected, onSelect, onRelease, selectMode, checked, onToggleSelect } = opts
  const { marker, count, distanceM, done } = row
  const claim = pileClaim(marker)
  const li = document.createElement('li')
  li.className = done ? 'kasat-row kasat-row--done' : 'kasat-row'
  if (claim) li.classList.add('kasat-row--claimed')
  li.dataset.id = marker.id

  // T449b: valintaruutu ILMESTYY vain valintatilassa. Oma elementti rivin edessä ⊥ rivin
  // sisällä: rivi on `<button>` & sisäkkäinen kontrolli ⊥ ole validia HTML:ää.
  if (selectMode && onToggleSelect) {
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'kasat-row-check'
    cb.checked = checked
    cb.setAttribute('aria-label', `Valitse ${marker.label?.trim() || 'kasa'}`)
    cb.addEventListener('change', () => onToggleSelect(marker.id))
    li.appendChild(cb)
  }

  const info = document.createElement('button')
  info.type = 'button'
  info.className = 'kasat-row-info'
  const name = document.createElement('span')
  name.className = 'kasat-row-name'
  name.textContent = marker.label?.trim() || 'Kasa'
  const meta = document.createElement('span')
  meta.className = 'kasat-row-meta'
  const parts = [formatPileSummary(count)]
  const dist = formatPileDistance(distanceM)
  if (dist) parts.push(dist)
  if (done) parts.push(`✓ ${PILE_TARGET.label}`)
  meta.textContent = parts.join(' · ')
  info.append(name, meta)
  // V333: varattu kasa ⊥ katoa listalta — piilotettu varaus on tieto jota toinen porukka
  // ⊥ voi kyseenalaistaa. Nimi & IKÄ näkyvät kaikille ("Mikko, 45 min sitten").
  if (claim) {
    const claimEl = document.createElement('span')
    claimEl.className = 'kasat-row-claim'
    claimEl.textContent = `🚗 ${formatClaimLabel(claim)}`
    info.appendChild(claimEl)
  }
  info.addEventListener('click', () => onSelect?.(marker.id))
  li.appendChild(info)

  const actions = document.createElement('div')
  actions.className = 'kasat-row-actions'

  // V286: YKSI ankkuri yhteen kohteeseen — ⊥ nav-appivalitsinta. Kelvottomat koordinaatit →
  // nappia ⊥ renderöidä lainkaan (⊥ disabloitua kuollutta pintaa, V250).
  const url = navUrl(navTarget(marker))
  if (url) {
    const nav = document.createElement('a')
    nav.className = 'kasat-row-nav btn'
    nav.href = url
    nav.target = '_blank'
    nav.rel = 'noopener'
    nav.textContent = '📍 Navigoi'
    actions.appendChild(nav)
  }

  // Haettu kasa ⊥ saa uutta "Haettu"-nappia: toiminto joka ⊥ tee mitään lukeutuu hanskat
  // kädessä rikkinäiseksi napiksi. Peruutus tulee T437:n kanssa, ⊥ tässä.
  // V333: vapautus on KENEN TAHANSA käytettävissä — metsässä ⊥ ole ketään joka voisi ratkoa
  // oikeuskiistaa, & loki (V231) kertoo kuka teki mitä jos asiaa kysytään jälkikäteen.
  if (claim && onRelease && !done) {
    const rel = document.createElement('button')
    rel.type = 'button'
    rel.className = 'btn kasat-row-release'
    rel.textContent = 'Vapauta'
    rel.addEventListener('click', () => onRelease(marker.id))
    actions.appendChild(rel)
  }

  if (onCollected && !done) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'kasat-row-done btn btn-primary'
    btn.textContent = PILE_TARGET.actionLabel
    btn.addEventListener('click', () => onCollected(marker.id))
    actions.appendChild(btn)
  }

  li.appendChild(actions)
  return li
}
