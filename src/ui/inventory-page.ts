import { validateInventoryItem, resolveItemName, adjustQty } from '../logic/inventory'
import type { InventoryItem, InventoryLocation, InventoryFields } from '../logic/inventory'
import type { SignTemplate } from '../logic/sign-library'
import { buildMarkerVisual } from './marker-visual-row'
import { createBackdrop, registerEscClose } from './modal-helpers'

/** Valittu paikka: 'all' (kokooma), 'none' (orvot V166) tai location.id. */
export type LocationSelection = string | 'all' | 'none'

/** T251: read = tiivis katselu (mutaatiot piilossa), edit = muokkaus (napit näkyvissä). */
export type InventoryViewMode = 'read' | 'edit'

export interface InventoryView {
  locations: InventoryLocation[]
  items: InventoryItem[] // valitun paikan tavarat; 'all'-tilassa KAIKKI itemit (page ryhmittää)
  selectedLocationId: LocationSelection
  templates: Map<string, SignTemplate>
  viewMode: InventoryViewMode // T251: oletus 'read' (V169); sessiokohtainen entryssä (V170)
}

export interface InventoryPageCallbacks {
  onSelectLocation: (sel: LocationSelection) => void
  onAddLocation: (name: string) => Promise<boolean> | boolean
  onAddItem: (fields: InventoryFields) => Promise<boolean> | boolean
  onEditItem: (id: string, fields: InventoryFields) => Promise<boolean> | boolean
  onDeleteItem: (item: InventoryItem) => void
  onRenameLocation?: (id: string, name: string) => Promise<boolean> | boolean // T248
  onDeleteLocation?: (loc: InventoryLocation) => void // T248
  onAddSign?: (locationId: string | null) => void // T246
  onOpenSign?: (templateId: string) => void // T247: avaa SignTemplateModal (muokkaus)
  onConvertToSign?: (item: InventoryItem) => void // T250: tekstirivi → merkki (uusi malli esitäytetyllä nimellä)
  onToggleViewMode?: () => void // T251: read ↔ edit (state entryssä, sessiokohtainen V170)
}

const ERR_TEXT: Record<string, string> = {
  name_required: 'Nimi on pakollinen.',
  invalid_qty: 'Määrä = numero, 0 tai suurempi.',
}

/** Oletuspaikka: "Kärry" nimen mukaan, muuten ensimmäinen paikka (entry käyttää oletusvalintaan). */
export function defaultLocationId(locations: InventoryLocation[]): string | null {
  return locations.find((l) => l.name.trim().toLowerCase() === 'kärry')?.id ?? locations[0]?.id ?? null
}

/** Oletusvalinta avattaessa: Kärry/ensimmäinen paikka, muuten "Ei paikkaa" (EI 'all'). */
export function defaultSelection(locations: InventoryLocation[]): LocationSelection {
  return defaultLocationId(locations) ?? 'none'
}

/** Lisäyslomakkeen keskeneräinen syöte (nimi+määrä) jota ei ole vielä painettu "Lisää". */
interface AddDraft { name: string; qty: string }

/** Lue add-formin nykyinen syöte ENNEN re-renderiä → säilytä stepper/edit-reloadien yli (B). */
function readAddDraft(container: HTMLElement): AddDraft | undefined {
  const name = container.querySelector<HTMLInputElement>('.inv-f-name')
  const qty = container.querySelector<HTMLInputElement>('.inv-f-qty')
  if (!name && !qty) return undefined
  return { name: name?.value ?? '', qty: qty?.value ?? '' }
}

export function renderInventory(container: HTMLElement, view: InventoryView, cb: InventoryPageCallbacks): void {
  const editable = view.viewMode === 'edit' // T251: mutaationapit näkyvät vain edit-modessa (V169)
  container.classList.toggle('inv-edit-mode', editable) // kevyt yläpalkki-aksentti + tiivis rivi read-modessa
  // B: jokainen stepper/edit-toiminto reloadaa → koko sivu re-renderöityy. Ilman tätä
  // keskeneräinen lisäysnimi katosi kun käyttäjä säätää jonkun rivin määrää. Säilytä draft.
  // (add-form on olemassa vain edit-modessa, joten draftia luetaan vain silloin.)
  const draft = editable ? readAddDraft(container) : undefined
  container.innerHTML = ''
  mountModeToggle(container, view, cb) // T251: moodi-toggle sivun headeriin (fallback: topbar)
  container.appendChild(buildLocationBar(view, cb, editable))
  container.appendChild(buildContext(view)) // T251: paikka + lukumäärä (+ Muokkaustila-merkki editissä)
  if (editable) container.appendChild(buildAddForm(view, cb, draft)) // read-modessa ei lisäystä (V169)

  const list = document.createElement('div')
  list.className = 'inv-list' + (editable ? '' : ' inv-list--read') // read = tiivis rekisteri (ei korttilaatikoita)
  list.id = 'inv-list'

  if (view.selectedLocationId === 'all') {
    renderGrouped(list, view, cb, editable)
  } else if (view.items.length === 0) {
    list.appendChild(emptyHint())
  } else {
    for (const item of view.items) list.appendChild(buildCard(item, view, cb, editable))
  }
  container.appendChild(list)
}

/** T251: moodi-toggle "✎ Muokkaa" ↔ "✓ Valmis" — päänappi (accent-outline read, accent-täyttö edit). */
function buildModeToggle(view: InventoryView, cb: InventoryPageCallbacks): HTMLButtonElement {
  const editable = view.viewMode === 'edit'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'inv-mode-toggle' + (editable ? ' active' : '')
  toggle.id = 'inv-mode-toggle'
  toggle.textContent = editable ? '✓ Valmis' : '✎ Muokkaa'
  toggle.setAttribute('aria-pressed', editable ? 'true' : 'false')
  toggle.addEventListener('click', () => cb.onToggleViewMode?.())
  return toggle
}

/**
 * T251: mounttaa moodi-toggle sivun headeriin (`#inventory-header`) ← Kartta -napin viereen —
 * yksi komentopalkki, ei orpoa yläpalkkia. Testeissä/eristetyssä mountissa (ei headeria) fallback:
 * kevyt `.inv-topbar` containeriin, jotta `#inv-mode-toggle` löytyy samasta juuresta.
 */
function mountModeToggle(container: HTMLElement, view: InventoryView, cb: InventoryPageCallbacks): void {
  const toggle = buildModeToggle(view, cb)
  const actions = document.getElementById('inventory-header')?.querySelector('.inventory-header-actions')
  if (actions) {
    actions.querySelector('.inv-mode-toggle')?.remove() // dedup: load() re-renderöi joka mutaatiolla
    actions.insertBefore(toggle, actions.firstChild) // ← Kartta / Kirjaudu ulos jäävät perään
  } else {
    const bar = document.createElement('div')
    bar.className = 'inv-topbar'
    bar.id = 'inv-topbar'
    bar.appendChild(toggle)
    container.appendChild(bar)
  }
}

/** T251: kontekstirivi tabien alle — "<paikka> · N tavaraa" (+ Muokkaustila-merkki editissä). Antaa ryhdin. */
function buildContext(view: InventoryView): HTMLElement {
  const row = document.createElement('div')
  row.className = 'inv-context'

  const label = document.createElement('span')
  label.className = 'inv-context-label'
  label.textContent = contextLabel(view) // V164 textContent (paikannimi voi olla user-syöte)
  row.appendChild(label)

  if (view.viewMode === 'edit') {
    const badge = document.createElement('span')
    badge.className = 'inv-mode-badge'
    badge.textContent = 'Muokkaustila'
    row.appendChild(badge)
  }
  return row
}

/** Kontekstiotsikko: paikan nimi (tai koonti/orvot) + tavaramäärä. N tavara(a) suomen monikko. */
function contextLabel(view: InventoryView): string {
  const n = view.items.length
  const noun = n === 1 ? 'tavara' : 'tavaraa'
  let place: string
  if (view.selectedLocationId === 'all') place = 'Kaikki paikat'
  else if (view.selectedLocationId === 'none') place = 'Ei paikkaa'
  else place = view.locations.find((l) => l.id === view.selectedLocationId)?.name ?? 'Paikka'
  return `${place} · ${n} ${noun}`
}

function emptyHint(): HTMLElement {
  const empty = document.createElement('p')
  empty.className = 'inv-empty'
  empty.textContent = 'Ei tavaroita täällä — lisää ylhäältä.'
  return empty
}

/** 'Kaikki'-kokooma: itemit ryhmiteltynä paikoittain väliotsikoin (+ "Ei paikkaa" orvoille). */
function renderGrouped(list: HTMLElement, view: InventoryView, cb: InventoryPageCallbacks, editable: boolean): void {
  if (view.items.length === 0) {
    list.appendChild(emptyHint())
    return
  }
  const byLoc = new Map<string | null, InventoryItem[]>()
  for (const it of view.items) {
    const key = it.locationId ?? null
    const arr = byLoc.get(key) ?? []
    arr.push(it)
    byLoc.set(key, arr)
  }
  // Paikat järjestyksessä, sitten "Ei paikkaa"
  for (const loc of view.locations) {
    const items = byLoc.get(loc.id)
    if (items && items.length) list.appendChild(buildSection(loc.name, items, view, cb, editable))
  }
  const orphans = byLoc.get(null)
  if (orphans && orphans.length) list.appendChild(buildSection('Ei paikkaa', orphans, view, cb, editable))
}

function buildSection(title: string, items: InventoryItem[], view: InventoryView, cb: InventoryPageCallbacks, editable: boolean): HTMLElement {
  const section = document.createElement('div')
  section.className = 'inv-section'
  const head = document.createElement('h3')
  head.className = 'inv-section-title'
  head.textContent = title // V164 textContent
  section.appendChild(head)
  for (const item of items) section.appendChild(buildCard(item, view, cb, editable))
  return section
}

export function renderForbidden(container: HTMLElement): void {
  container.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'inv-forbidden'
  const p = document.createElement('p')
  p.textContent = 'Inventaario on vain järjestäjille.'
  wrap.appendChild(p)
  container.appendChild(wrap)
}

// ── Paikkapalkki: tabit + lisää paikka ───────────────────────────────────────

function buildLocationBar(view: InventoryView, cb: InventoryPageCallbacks, editable: boolean): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'inv-location-bar'
  bar.id = 'inv-location-bar'

  // Paikat ensin (ensisijainen), sitten "Ei paikkaa", sitten "Kaikki"-koonti (ei ensimmäisenä, EI oletus).
  // Tabit näkyvät MOLEMMISSA moodeissa — read-modessa selailu säilyy (V169).
  for (const loc of view.locations) {
    bar.appendChild(locationTab(loc.name, loc.id, view.selectedLocationId === loc.id, () => cb.onSelectLocation(loc.id)))
  }
  bar.appendChild(locationTab('Ei paikkaa', 'none', view.selectedLocationId === 'none', () => cb.onSelectLocation('none')))
  bar.appendChild(locationTab('Kaikki', 'all', view.selectedLocationId === 'all', () => cb.onSelectLocation('all')))

  // Paikkojen mutaationapit (+ Paikka, ✎ Muokkaa) VAIN edit-modessa (V169).
  if (!editable) return bar

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'inv-loc-add'
  addBtn.id = 'inv-loc-add'
  addBtn.textContent = '+ Paikka'
  addBtn.addEventListener('click', () => openAddLocationModal(cb)) // peruttava modaali (Modal footer -pattern)
  bar.appendChild(addBtn)

  // T248: paikkojen muokkaus (rename/poista) — peruttava modaali, vain jos paikkoja on
  if (view.locations.length > 0 && (cb.onRenameLocation || cb.onDeleteLocation)) {
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'inv-loc-edit-toggle'
    editBtn.id = 'inv-loc-edit-toggle'
    editBtn.textContent = '✎ Muokkaa'
    editBtn.addEventListener('click', () => openManageLocationsModal(view, cb))
    bar.appendChild(editBtn)
  }

  return bar
}

// ── Paikkamodaalit (Modal footer -pattern, peruttava: backdrop + Esc + Peruuta) ──

/** Jaettu modaalikuori: backdrop (klikki sulkee) + kortti + Esc-sulku. Kutsuja täyttää modalin. */
function openInvModal(titleText: string): { modal: HTMLElement; close: () => void } {
  const close = (): void => { backdrop.remove(); unregEsc() }
  const backdrop = createBackdrop('inv-sign-picker-backdrop', close)
  const modal = document.createElement('div')
  modal.className = 'inv-sign-picker'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.addEventListener('click', (e) => e.stopPropagation())

  const title = document.createElement('h2')
  title.className = 'inv-sign-picker-title'
  title.textContent = titleText
  modal.appendChild(title)

  backdrop.appendChild(modal)
  document.body.appendChild(backdrop)
  const unregEsc = registerEscClose(close)
  return { modal, close }
}

/** "+ Paikka" → peruttava luonti-modaali (title + nimi-input + [Luo][Peruuta]). */
function openAddLocationModal(cb: InventoryPageCallbacks): void {
  const { modal, close } = openInvModal('Uusi paikka')

  const form = document.createElement('form')
  form.className = 'inv-modal-form'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'inv-sign-search' // reuse: surface-app, 44px, 16px (iOS-zoom-esto)
  input.placeholder = 'Paikan nimi (esim. Kärry)'
  input.setAttribute('aria-label', 'Paikan nimi')

  const err = document.createElement('p')
  err.className = 'inv-error'
  err.hidden = true

  const footer = document.createElement('div')
  footer.className = 'modal-footer'
  const actions = document.createElement('div')
  actions.className = 'modal-footer-actions'
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'modal-btn-primary'
  save.id = 'inv-loc-modal-save'
  save.textContent = 'Luo'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'modal-btn-secondary'
  cancel.textContent = 'Peruuta'
  cancel.addEventListener('click', close)
  actions.append(save, cancel)
  footer.appendChild(actions)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = input.value.trim()
    if (!name) { input.focus(); return }
    const ok = await cb.onAddLocation(name)
    if (ok) close()
    else { err.textContent = 'Tallennus epäonnistui.'; err.hidden = false }
  })

  form.append(input, err, footer)
  modal.appendChild(form)
  input.focus()
}

/** "✎ Muokkaa" → peruttava hallinta-modaali: nimi-input + Poista per paikka, [Tallenna][Peruuta]. */
function openManageLocationsModal(view: InventoryView, cb: InventoryPageCallbacks): void {
  const { modal, close } = openInvModal('Muokkaa paikkoja')

  const list = document.createElement('div')
  list.className = 'inv-manage-list'
  const rows: Array<{ id: string; original: string; input: HTMLInputElement }> = []

  for (const loc of view.locations) {
    const row = document.createElement('div')
    row.className = 'inv-manage-row'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'inv-manage-input'
    input.value = loc.name
    input.setAttribute('aria-label', `Paikan nimi: ${loc.name}`)
    rows.push({ id: loc.id, original: loc.name, input })

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'modal-btn-destructive inv-manage-del'
    del.textContent = 'Poista'
    del.addEventListener('click', () => {
      close() // sulje ensin — onDeleteLocation reloadaa sivun (V166: tavarat → "Ei paikkaa")
      cb.onDeleteLocation?.(loc)
    })

    row.append(input, del)
    list.appendChild(row)
  }
  modal.appendChild(list)

  const footer = document.createElement('div')
  footer.className = 'modal-footer'
  const actions = document.createElement('div')
  actions.className = 'modal-footer-actions'
  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'modal-btn-primary'
  save.textContent = 'Tallenna'
  save.addEventListener('click', async () => {
    // Vain muuttuneet nimet → rename PUT. Peruuta hylkää kaiken (ei kirjoituksia).
    const changed = rows.filter((r) => r.input.value.trim() && r.input.value.trim() !== r.original)
    close()
    for (const r of changed) await cb.onRenameLocation?.(r.id, r.input.value.trim())
  })
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'modal-btn-secondary'
  cancel.textContent = 'Peruuta'
  cancel.addEventListener('click', close)
  actions.append(save, cancel)
  footer.appendChild(actions)
  modal.appendChild(footer)

  rows[0]?.input.focus()
}

function locationTab(label: string, id: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.className = 'inv-loc-tab' + (active ? ' active' : '')
  tab.dataset.locationId = id
  tab.textContent = label
  tab.addEventListener('click', onClick)
  return tab
}

// ── Lisäyslomake (minimaalinen: nimi + määrä) ────────────────────────────────

function buildAddForm(view: InventoryView, cb: InventoryPageCallbacks, draft?: AddDraft): HTMLElement {
  const form = document.createElement('form')
  form.className = 'inv-add-form'
  form.id = 'inv-add-form'

  // 'Kaikki' = vain koontinäkymä → ei lisäystä. Ohje ohjaa valitsemaan paikan (yksi paikka-totuus = tabit).
  if (view.selectedLocationId === 'all') {
    const hint = document.createElement('p')
    hint.className = 'inv-add-hint'
    hint.textContent = 'Valitse paikka yltä lisätäksesi tavaraa.'
    form.appendChild(hint)
    return form
  }

  // Paikka-tabi (Kärry/Varasto/Ei paikkaa): lisäys menee valittuun paikkaan (konteksti tabista, ei selectiä).
  const row = document.createElement('div')
  row.className = 'inv-add-row'

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.className = 'inv-f-name'
  nameInput.placeholder = 'Tavaran nimi'
  nameInput.setAttribute('aria-label', 'Tavaran nimi')

  const qtyInput = document.createElement('input')
  qtyInput.type = 'number'
  qtyInput.className = 'inv-f-qty'
  qtyInput.min = '0'
  qtyInput.step = 'any'
  qtyInput.inputMode = 'decimal'
  qtyInput.placeholder = 'Määrä'
  qtyInput.setAttribute('aria-label', 'Määrä')

  // Säilytä keskeneräinen syöte re-renderin yli (stepper/edit ei saa hukata nimeä).
  if (draft) { nameInput.value = draft.name; qtyInput.value = draft.qty }

  const addBtn = document.createElement('button')
  addBtn.type = 'submit'
  addBtn.className = 'inv-btn inv-btn-primary'
  addBtn.id = 'inv-add-btn'
  addBtn.textContent = '+ Lisää'

  row.append(nameInput, qtyInput, addBtn)
  form.appendChild(row)

  // T246: "+ Merkki" -nappi (näkyy vain jos onAddSign kytketty)
  if (cb.onAddSign) {
    const signBtn = document.createElement('button')
    signBtn.type = 'button'
    signBtn.className = 'inv-btn inv-btn-sign'
    signBtn.id = 'inv-add-sign-btn'
    signBtn.textContent = '+ Merkki kirjastosta'
    signBtn.addEventListener('click', () => cb.onAddSign!(locationIdFromSelection(view.selectedLocationId)))
    form.appendChild(signBtn)
  }

  const err = document.createElement('p')
  err.className = 'inv-error'
  err.id = 'inv-add-error'
  err.hidden = true
  form.appendChild(err)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const res = validateInventoryItem({
      name: nameInput.value,
      qty: qtyInput.value.trim() === '' ? undefined : Number(qtyInput.value),
      locationId: locationIdFromSelection(view.selectedLocationId),
    })
    if (!res.ok) {
      showError(err, res.error)
      return
    }
    err.hidden = true
    // Tyhjennä ENNEN onAddItemia: onnistuessa se reloadaa → readAddDraft lukee tyhjän
    // (ei palauta juuri lisättyä nimeä). Epäonnistuessa (ei reloadia) palauta syöte.
    const savedName = nameInput.value, savedQty = qtyInput.value
    nameInput.value = ''; qtyInput.value = ''
    const ok = await cb.onAddItem(res.value)
    if (!ok) { nameInput.value = savedName; qtyInput.value = savedQty; showError(err, 'save_failed') }
  })

  return form
}

/** Paikka-<select>: option per paikka; withNone lisää "Ei paikkaa" (tyhjä value). */
function buildLocationSelect(locations: InventoryLocation[], selectedId: string | null, withNone: boolean): HTMLSelectElement {
  const sel = document.createElement('select')
  sel.className = 'inv-location-select'
  if (withNone) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = 'Ei paikkaa'
    if (!selectedId) opt.selected = true
    sel.appendChild(opt)
  }
  for (const loc of locations) {
    const opt = document.createElement('option')
    opt.value = loc.id
    opt.textContent = loc.name // V164 textContent
    if (loc.id === selectedId) opt.selected = true
    sel.appendChild(opt)
  }
  return sel
}

// ── Tavarakortti: nimi + määräsäädin + meta + toiminnot ──────────────────────

function buildCard(item: InventoryItem, view: InventoryView, cb: InventoryPageCallbacks, editable: boolean): HTMLElement {
  const card = document.createElement('div')
  card.className = 'inv-card' + (editable ? '' : ' inv-card--read') // read = tiivis yksirivi (V169)
  card.dataset.itemId = item.id

  const head = document.createElement('div')
  head.className = 'inv-card-head'

  // Merkki-rivi: kyltin visuaali nimen vieressä (V167, buildMarkerVisual-reuse). Zoomable → lightbox iso kuva.
  const tpl = item.templateId ? view.templates.get(item.templateId) : undefined
  if (tpl) {
    head.appendChild(buildMarkerVisual(
      // T200-konventio: buildMarkerVisual lukee kuva-avaimen `type`-kentästä (signImageSrc).
      // SignTemplaten kuva-avain on imageId ?? id → järjestäjän lataama kuva (T196) näkyy
      // ensisijaisesti, muuten bundled-webp/ikoni/label (V99-precedence).
      { type: tpl.imageId ?? tpl.id, iconId: tpl.iconId, label: tpl.label, parts: tpl.parts, color: tpl.color },
      { size: 40, zoomable: true },
    ))
  }

  // Merkki-rivin nimi = klikattava (avaa SignTemplateModal, T247); tarvike = span.
  const nameText = resolveItemName(item, view.templates) // V164 textContent, V165 elävä label
  let nameEl: HTMLElement
  if (item.templateId && cb.onOpenSign) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'inv-card-name inv-card-name-sign inv-card-name-btn'
    btn.textContent = nameText
    const tid = item.templateId
    btn.addEventListener('click', () => cb.onOpenSign!(tid))
    nameEl = btn
  } else {
    const span = document.createElement('span')
    span.className = 'inv-card-name'
    span.textContent = nameText
    if (item.templateId) span.classList.add('inv-card-name-sign')
    nameEl = span
  }
  head.appendChild(nameEl)

  const unitEl = (): HTMLElement => {
    const el = document.createElement('span')
    el.className = 'inv-card-unit'
    el.textContent = item.unit! // V164
    return el
  }

  // Edit: yksikkö stepperin VASEMMALLA → stepper pysyy samalla x:llä (T247).
  // Read: määrä pelkkänä tekstinä, yksikkö sen JÄLKEEN → rekisteririvi lukee "40 kpl" (V169).
  if (editable) {
    if (item.unit) head.appendChild(unitEl())
    head.appendChild(buildStepper(item, cb))
  } else {
    const qtyEl = document.createElement('span')
    qtyEl.className = 'inv-card-qty'
    qtyEl.textContent = String(item.qty) // V164 textContent
    head.appendChild(qtyEl)
    if (item.unit) head.appendChild(unitEl())
  }
  card.appendChild(head)

  const meta = metaLine(item)
  if (meta) card.appendChild(meta)

  // Toimintonapit (✎ Tiedot, Poista) VAIN edit-modessa (V169).
  if (!editable) return card

  const actions = document.createElement('div')
  actions.className = 'inv-card-actions'

  const detailsBtn = document.createElement('button')
  detailsBtn.type = 'button'
  detailsBtn.className = 'inv-btn inv-btn-details'
  detailsBtn.textContent = '✎ Tiedot'
  detailsBtn.addEventListener('click', () => toggleDetailsEditor(card, item, view, cb))
  actions.appendChild(detailsBtn)

  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.className = 'inv-btn inv-btn-delete'
  delBtn.textContent = 'Poista'
  delBtn.addEventListener('click', () => cb.onDeleteItem(item))
  actions.appendChild(delBtn)

  card.appendChild(actions)
  return card
}

function buildStepper(item: InventoryItem, cb: InventoryPageCallbacks): HTMLElement {
  const stepper = document.createElement('div')
  stepper.className = 'inv-stepper'

  const minus = stepBtn('−', 'inv-step-minus', () => cb.onEditItem(item.id, fieldsOf(item, { qty: adjustQty(item.qty, -1) })))
  const plus = stepBtn('+', 'inv-step-plus', () => cb.onEditItem(item.id, fieldsOf(item, { qty: adjustQty(item.qty, 1) })))

  // Määrä = nappi → tap avaa tarkka-syötön
  const qtyBtn = document.createElement('button')
  qtyBtn.type = 'button'
  qtyBtn.className = 'inv-step-qty'
  qtyBtn.textContent = String(item.qty)
  qtyBtn.setAttribute('aria-label', 'Aseta tarkka määrä')
  qtyBtn.addEventListener('click', () => openExactQty(qtyBtn, item, cb))

  stepper.append(minus, qtyBtn, plus)
  return stepper
}

function stepBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `inv-btn inv-step ${cls}`
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function openExactQty(qtyBtn: HTMLElement, item: InventoryItem, cb: InventoryPageCallbacks): void {
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '0'
  input.step = 'any'
  input.inputMode = 'decimal'
  input.className = 'inv-step-qty-input'
  input.value = String(item.qty)
  const commit = async (): Promise<void> => {
    const res = validateInventoryItem({ ...inputAsInput(item), qty: input.value.trim() === '' ? 0 : Number(input.value) })
    if (res.ok) await cb.onEditItem(item.id, res.value)
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); void commit() }
    if (e.key === 'Escape') qtyBtn.replaceWith(qtyBtn)
  })
  input.addEventListener('blur', () => void commit())
  qtyBtn.replaceWith(input)
  input.focus()
  input.select()
}

// ── Meta + tiedot-editori (yksikkö + kommentti, sekundäärinen) ───────────────

function metaLine(item: InventoryItem): HTMLElement | null {
  if (!item.note) return null
  const meta = document.createElement('div')
  meta.className = 'inv-card-meta'
  const span = document.createElement('span')
  span.textContent = item.note // V164 textContent
  meta.appendChild(span)
  return meta
}

function toggleDetailsEditor(card: HTMLElement, item: InventoryItem, view: InventoryView, cb: InventoryPageCallbacks): void {
  const existing = card.querySelector('.inv-details-editor')
  if (existing) { existing.remove(); return }

  const editor = document.createElement('div')
  editor.className = 'inv-details-editor'

  const unit = labeledInput('Yksikkö', 'inv-d-unit', item.unit ?? '')
  const note = labeledInput('Kommentti', 'inv-d-note', item.note ?? '')
  editor.append(unit.wrap, note.wrap)

  // Siirto: paikka-<select> (T247) — nykyinen esivalittuna, "Ei paikkaa" mukana.
  let locSelect: HTMLSelectElement | null = null
  if (view.locations.length > 0) {
    locSelect = buildLocationSelect(view.locations, item.locationId ?? null, true)
    locSelect.classList.add('inv-d-location')
    const locWrap = document.createElement('label')
    locWrap.className = 'inv-field'
    const lbl = document.createElement('span')
    lbl.className = 'inv-field-label'
    lbl.textContent = 'Paikka (siirrä)'
    locWrap.append(lbl, locSelect)
    editor.appendChild(locWrap)
  }

  // V17x: kiinnitystapa RIVILLÄ (vain merkkirivi) — täppä pois = irto → nimeen " - irto".
  // Sama kylttipinta (tunnus) voi olla kepillä TAI irto, ei kahta erillistä mallia.
  let keppiCheckbox: HTMLInputElement | null = null
  if (item.templateId) {
    const keppiWrap = document.createElement('label')
    keppiWrap.className = 'inv-field inv-field-keppi'
    keppiCheckbox = document.createElement('input')
    keppiCheckbox.type = 'checkbox'
    keppiCheckbox.className = 'inv-d-keppi'
    keppiCheckbox.checked = item.keppi !== false // null/true = keppi (oletus), false = irto
    const lbl = document.createElement('span')
    lbl.className = 'inv-field-label'
    lbl.textContent = 'Keppi (pois = irto)'
    keppiWrap.append(keppiCheckbox, lbl)
    editor.appendChild(keppiWrap)
  }

  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'inv-btn inv-btn-primary'
  save.textContent = 'Tallenna'
  save.addEventListener('click', async () => {
    const overrides: Partial<InventoryFields> = { unit: strOrNull(unit.input.value), note: strOrNull(note.input.value) }
    if (locSelect) overrides.locationId = locSelect.value || null
    if (keppiCheckbox) overrides.keppi = keppiCheckbox.checked ? true : false
    await cb.onEditItem(item.id, fieldsOf(item, overrides))
  })
  editor.appendChild(save)

  // T250: "Muuta merkiksi" — VAIN tarvike-/tekstirivi (ei template_id). Avaa uuden mallin
  // esitäytetyllä nimellä; käyttäjä poistaa "irto"-sanan + valitsee kuvan → rivi linkittyy merkkiin.
  if (!item.templateId && cb.onConvertToSign) {
    const convert = document.createElement('button')
    convert.type = 'button'
    convert.className = 'inv-btn inv-btn-convert'
    convert.textContent = 'Muuta merkiksi'
    convert.addEventListener('click', () => cb.onConvertToSign!(item))
    editor.appendChild(convert)
  }

  card.appendChild(editor)
  unit.input.focus()
}

// ── Apurit ───────────────────────────────────────────────────────────────────

function fieldsOf(item: InventoryItem, overrides: Partial<InventoryFields>): InventoryFields {
  return {
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    location: item.location,
    note: item.note,
    locationId: item.locationId ?? null,
    templateId: item.templateId ?? null,
    keppi: item.keppi ?? null,
    ...overrides,
  }
}

function inputAsInput(item: InventoryItem): Record<string, unknown> {
  return { name: item.name, unit: item.unit, note: item.note, locationId: item.locationId ?? undefined, templateId: item.templateId ?? undefined, keppi: item.keppi ?? undefined }
}

function locationIdFromSelection(sel: LocationSelection): string | null {
  return sel === 'none' || sel === 'all' ? null : sel
}

function strOrNull(x: string): string | null {
  const t = x.trim()
  return t.length ? t : null
}

function showError(el: HTMLElement, code: string): void {
  el.textContent = ERR_TEXT[code] ?? 'Tallennus epäonnistui.'
  el.hidden = false
}

// ── Merkki-picker (T246): hae olemassa oleva merkkikirjaston malli tai luo uusi ──

export interface SignPickerCallbacks {
  onPick: (templateId: string) => void
  onCreateNew: () => void
  onClose: () => void
}

/** Modaali: listaa merkkikirjaston mallit (haku) + "Uusi merkki". Palauttaa backdropin (kutsuja poistaa). */
export function renderSignPicker(
  host: HTMLElement,
  templates: Array<{ id: string; label: string }>,
  cb: SignPickerCallbacks,
): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'inv-sign-picker-backdrop'
  backdrop.addEventListener('click', () => cb.onClose())

  const modal = document.createElement('div')
  modal.className = 'inv-sign-picker'
  modal.setAttribute('role', 'dialog')
  modal.addEventListener('click', (e) => e.stopPropagation())

  const title = document.createElement('h2')
  title.className = 'inv-sign-picker-title'
  title.textContent = 'Lisää merkki'
  modal.appendChild(title)

  const search = document.createElement('input')
  search.type = 'text'
  search.className = 'inv-sign-search'
  search.placeholder = 'Hae merkkiä…'
  search.setAttribute('aria-label', 'Hae merkkiä')
  modal.appendChild(search)

  const list = document.createElement('div')
  list.className = 'inv-sign-list'
  modal.appendChild(list)

  const renderList = (filter: string): void => {
    list.innerHTML = ''
    const q = filter.trim().toLowerCase()
    const matches = templates.filter((t) => t.label.toLowerCase().includes(q))
    if (matches.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'inv-empty'
      empty.textContent = 'Ei osumia — luo uusi.'
      list.appendChild(empty)
      return
    }
    for (const t of matches) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'inv-sign-row'
      row.dataset.templateId = t.id
      row.textContent = t.label // V164 textContent
      row.addEventListener('click', () => {
        cb.onClose()
        cb.onPick(t.id)
      })
      list.appendChild(row)
    }
  }
  renderList('')
  search.addEventListener('input', () => renderList(search.value))

  const actions = document.createElement('div')
  actions.className = 'inv-sign-picker-actions'

  const newBtn = document.createElement('button')
  newBtn.type = 'button'
  newBtn.className = 'inv-btn inv-btn-primary'
  newBtn.id = 'inv-sign-new'
  newBtn.textContent = '+ Uusi merkki'
  newBtn.addEventListener('click', () => {
    cb.onClose()
    cb.onCreateNew()
  })

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'inv-btn'
  closeBtn.textContent = 'Sulje'
  closeBtn.addEventListener('click', () => cb.onClose())

  actions.append(newBtn, closeBtn)
  modal.appendChild(actions)

  backdrop.appendChild(modal)
  host.appendChild(backdrop)
  search.focus()
  return backdrop
}

function labeledInput(label: string, cls: string, value: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('label')
  wrap.className = 'inv-field'
  const span = document.createElement('span')
  span.className = 'inv-field-label'
  span.textContent = label
  const input = document.createElement('input')
  input.type = 'text'
  input.className = cls
  input.value = value
  wrap.append(span, input)
  return { wrap, input }
}
