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
}

const PHASE_LABEL: Record<Segment['phase'], string> = {
  asettaminen: 'Asetus',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

export function renderKasatPage(container: HTMLElement, opts: KasatPageOpts): void {
  const { piles, phase, hasFix = false, onCollected, onSelect } = opts
  container.innerHTML = ''
  container.classList.add('kasat-page')

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

  const list = document.createElement('ul')
  list.className = 'kasat-list'
  for (const row of piles) list.appendChild(buildRow(row, onCollected, onSelect))
  container.appendChild(list)
}

function buildRow(
  row: PileRow,
  onCollected?: (id: string) => void,
  onSelect?: (id: string) => void,
): HTMLLIElement {
  const { marker, count, distanceM, done } = row
  const li = document.createElement('li')
  li.className = done ? 'kasat-row kasat-row--done' : 'kasat-row'
  li.dataset.id = marker.id

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
