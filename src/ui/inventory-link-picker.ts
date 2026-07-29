import { rankInventoryRows, cleanDisplayName, type InventoryLinkRow } from '../logic/inventory-link'

/**
 * T399 — "mitä varastossa on tälle nimelle" merkkipohjaa LUOTAESSA (V288/V289).
 *
 * Käänteinen suunta T386:lle. Tuotantotodiste 2026-07-29: 124 rivistä 101 linkittämättä & iso
 * osa saa T386:ssa "Ei ehdotuksia" koska niille ⊥ OLE merkkipohjaa — ne ! LUODA ⊥ linkittää.
 * Merkkipohja luodaan yleensä juuri siksi että laatikossa on kyltti ∴ linkitys kuuluu
 * luontihetkeen ⊥ erilliseen jälkikäyntiin.
 *
 * OMA komponentti: `sign-template-modal.ts` on jo 748 riviä ∴ modaali vain mounttaa tämän
 * yhteen kohtaan nimikentän alle.
 *
 * V288: valinta ⊥ ole kirjoitus. Templatea ⊥ ole vielä olemassa ∴ `template_id`:llä ⊥ ole
 * kohdetta; tämä komponentti pitää VALINNAN, modaali kirjoittaa sen tallennuksessa.
 * V289: haun epäonnistuminen → osio jää pois hiljaa, luonti jatkuu ennallaan.
 *
 * XSS: kaikki rivinimet `textContent` (V164).
 */

export interface LinkPickerHooks {
  /** Linkitettävissä olevat rivit (kutsuja on jo suodattanut linkittämättömät). */
  rows: () => Promise<InventoryLinkRow[]>
  /** Nimikentän nykyinen arvo — ehdotukset rankataan tätä vasten. */
  getLabel: () => string
  /** Aseta nimikenttä (valinta täyttää sen siivottuna) + fokus & valinta kutsujan vastuulla. */
  setLabel: (value: string) => void
}

export interface LinkPickerHandle {
  /** Valittu rivi tai null. Modaali lukee tämän tallennuksessa (V288). */
  selected: () => InventoryLinkRow | null
  /** Nimikentän muutos → ehdotuskaista uusiksi. */
  refresh: () => void
}

const DEBOUNCE_MS = 150

/**
 * Mounttaa pickerin `host`iin. Palauttaa kahvan josta modaali lukee valinnan.
 * Rivihaku on async: kunnes se valmistuu, osiota ⊥ ole DOM:issa (⊥ latausvälähdystä
 * merkkipohjan luontiin, joka on itsenäinen toiminto ilman inventaariota).
 */
export function mountInventoryLinkPicker(host: HTMLElement, hooks: LinkPickerHooks): LinkPickerHandle {
  let allRows: InventoryLinkRow[] = []
  let selection: InventoryLinkRow | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null

  const section = document.createElement('div')
  section.className = 'inv-link-section'
  host.appendChild(section)

  const suggestions = document.createElement('div')
  suggestions.className = 'inv-link-suggestions'
  const chip = document.createElement('div')
  chip.className = 'inv-link-chip'
  const browseBtn = document.createElement('button')
  browseBtn.type = 'button'
  browseBtn.className = 'inv-link-browse'

  /** Valinta: täytä nimi siivottuna (V278) & näytä chip. PUT ajetaan vasta tallennuksessa (V288). */
  function select(row: InventoryLinkRow): void {
    selection = row
    // Kirjoitettu teksti on tässä vaiheessa HAKUSANA ⊥ nimi ("bus" → "Shuttle-bus aikataulu")
    // ∴ ylikirjoitetaan aina. ⊥ tiedon menetystä: kutsuja siirtää fokuksen & valitsee tekstin
    // → yksi näppäily kirjoittaa yli.
    hooks.setLabel(cleanDisplayName(row.name) || row.name)
    render()
  }

  function clearSelection(): void {
    selection = null
    render()
  }

  function buildRowButton(row: InventoryLinkRow, cls: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = cls
    btn.dataset.itemId = row.id
    const name = document.createElement('span')
    name.className = 'inv-link-row-name'
    name.textContent = row.name // V164
    const meta = document.createElement('span')
    meta.className = 'inv-link-row-meta'
    meta.textContent = row.locationName ? `${row.qty} kpl · ${row.locationName}` : `${row.qty} kpl` // V164
    btn.append(name, meta)
    return btn
  }

  /** (b) Haettava täysi lista — sama modaalikuori kuin muilla pickereillä, ⊥ omaa kuorta. */
  function openBrowser(): void {
    const backdrop = document.createElement('div')
    backdrop.className = 'inv-sign-picker-backdrop inv-link-browser-backdrop'
    const close = (): void => backdrop.remove()
    backdrop.addEventListener('click', close)

    const modal = document.createElement('div')
    modal.className = 'inv-sign-picker inv-link-browser'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-label', 'Valitse varastorivi')
    modal.addEventListener('click', (e) => e.stopPropagation())

    const title = document.createElement('h2')
    title.className = 'inv-sign-picker-title'
    title.textContent = 'Varastorivit ilman merkkipohjaa'
    const search = document.createElement('input')
    search.type = 'text'
    search.className = 'inv-sign-search'
    search.placeholder = 'Hae varastosta…'
    search.setAttribute('aria-label', 'Hae varastosta')
    const list = document.createElement('div')
    list.className = 'inv-sign-list inv-link-browser-list'

    const renderList = (filter: string): void => {
      list.innerHTML = ''
      const q = filter.trim().toLowerCase()
      const matches = q ? allRows.filter((r) => r.name.toLowerCase().includes(q)) : allRows
      if (matches.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'inv-empty'
        empty.textContent = 'Ei osumia.'
        list.appendChild(empty)
        return
      }
      for (const row of matches) {
        const btn = buildRowButton(row, 'inv-sign-row inv-link-browser-row')
        btn.addEventListener('click', () => {
          close()
          select(row)
        })
        list.appendChild(btn)
      }
    }
    renderList('')
    search.addEventListener('input', () => renderList(search.value))

    const actions = document.createElement('div')
    actions.className = 'inv-sign-picker-actions'
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'inv-btn'
    closeBtn.textContent = 'Sulje'
    closeBtn.addEventListener('click', close)
    actions.appendChild(closeBtn)

    modal.append(title, search, list, actions)
    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    search.focus()
  }

  function render(): void {
    section.innerHTML = ''
    if (allRows.length === 0) return // V289: ei rivejä → ei osiota

    if (selection) {
      chip.innerHTML = ''
      const text = document.createElement('span')
      text.className = 'inv-link-chip-text'
      text.textContent = `Linkitetään: ${selection.name} (${selection.qty} kpl)` // V164
      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'inv-link-chip-clear'
      clear.textContent = 'Poista valinta'
      clear.addEventListener('click', clearSelection)
      chip.append(text, clear)
      section.appendChild(chip)
      return // valittuna ⊥ tarjota lisää ehdotuksia — päätös on tehty
    }

    // (a) Ehdotuskaista: top-3 kynnyksen yli. Ei osumia → koko kaista piilossa (⊥ tyhjää laatikkoa).
    const hits = rankInventoryRows(hooks.getLabel(), allRows).slice(0, 3)
    if (hits.length > 0) {
      suggestions.innerHTML = ''
      const hint = document.createElement('span')
      hint.className = 'inv-link-hint'
      hint.textContent = 'Varastossa samankaltaisia:'
      suggestions.appendChild(hint)
      for (const hit of hits) {
        const btn = buildRowButton(hit.row, 'inv-link-suggestion')
        btn.addEventListener('click', () => select(hit.row))
        suggestions.appendChild(btn)
      }
      section.appendChild(suggestions)
    }

    browseBtn.textContent = `Näytä kaikki varastorivit (${allRows.length})`
    browseBtn.onclick = openBrowser
    section.appendChild(browseBtn)
  }

  // V289: haku epäonnistuu (403 talkoolaiselle, verkkovirhe) → osio jää pois HILJAA.
  // Merkkipohjan luonti on toiminut ilman inventaariota T193:sta asti & ! toimia jatkossakin.
  void hooks
    .rows()
    .then((rows) => {
      allRows = rows
      render()
    })
    .catch(() => {
      allRows = []
      section.innerHTML = ''
    })

  return {
    selected: () => selection,
    refresh: () => {
      if (debounce !== null) clearTimeout(debounce)
      debounce = setTimeout(render, DEBOUNCE_MS)
    },
  }
}
