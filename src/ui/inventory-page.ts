import { validateInventoryItem, resolveItemName, adjustQty } from '../logic/inventory'
import type { InventoryItem, InventoryLocation, InventoryFields } from '../logic/inventory'

/** Valittu paikka: joko location.id tai 'none' (paikattomat orvot, V166). */
export type LocationSelection = string | 'none'

export interface InventoryView {
  locations: InventoryLocation[]
  items: InventoryItem[] // valitun paikan tavarat (server-suodatettu)
  selectedLocationId: LocationSelection
  templates: Map<string, { label: string }>
}

export interface InventoryPageCallbacks {
  onSelectLocation: (sel: LocationSelection) => void
  onAddLocation: (name: string) => Promise<boolean> | boolean
  onAddItem: (fields: InventoryFields) => Promise<boolean> | boolean
  onEditItem: (id: string, fields: InventoryFields) => Promise<boolean> | boolean
  onDeleteItem: (item: InventoryItem) => void
  onDeleteLocation?: (loc: InventoryLocation) => void
  onAddSign?: (locationId: string | null) => void // T246
}

const ERR_TEXT: Record<string, string> = {
  name_required: 'Nimi on pakollinen.',
  invalid_qty: 'Määrä = numero, 0 tai suurempi.',
}

export function renderInventory(container: HTMLElement, view: InventoryView, cb: InventoryPageCallbacks): void {
  container.innerHTML = ''
  container.appendChild(buildLocationBar(view, cb))
  container.appendChild(buildAddForm(view, cb))

  const list = document.createElement('div')
  list.className = 'inv-list'
  list.id = 'inv-list'
  if (view.items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'inv-empty'
    empty.textContent = 'Ei tavaroita täällä — lisää ylhäältä.'
    list.appendChild(empty)
  } else {
    for (const item of view.items) list.appendChild(buildCard(item, view, cb))
  }
  container.appendChild(list)
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

function buildLocationBar(view: InventoryView, cb: InventoryPageCallbacks): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'inv-location-bar'
  bar.id = 'inv-location-bar'

  for (const loc of view.locations) {
    bar.appendChild(locationTab(loc.name, loc.id, view.selectedLocationId === loc.id, () => cb.onSelectLocation(loc.id)))
  }
  // "Ei paikkaa" -orvot aina valittavissa
  bar.appendChild(locationTab('Ei paikkaa', 'none', view.selectedLocationId === 'none', () => cb.onSelectLocation('none')))

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'inv-loc-add'
  addBtn.id = 'inv-loc-add'
  addBtn.textContent = '+ Paikka'
  addBtn.addEventListener('click', () => promptAddLocation(bar, cb))
  bar.appendChild(addBtn)

  return bar
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

function promptAddLocation(bar: HTMLElement, cb: InventoryPageCallbacks): void {
  const existing = bar.querySelector('.inv-loc-add-form')
  if (existing) return
  const form = document.createElement('form')
  form.className = 'inv-loc-add-form'
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'inv-loc-add-input'
  input.placeholder = 'Paikan nimi (esim. Kärry)'
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'inv-btn inv-btn-primary'
  save.textContent = 'Luo'
  form.append(input, save)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = input.value.trim()
    if (!name) return
    await cb.onAddLocation(name)
  })
  bar.appendChild(form)
  input.focus()
}

// ── Lisäyslomake (minimaalinen: nimi + määrä) ────────────────────────────────

function buildAddForm(view: InventoryView, cb: InventoryPageCallbacks): HTMLElement {
  const form = document.createElement('form')
  form.className = 'inv-add-form'
  form.id = 'inv-add-form'

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
    const ok = await cb.onAddItem(res.value)
    if (!ok) showError(err, 'save_failed')
  })

  return form
}

// ── Tavarakortti: nimi + määräsäädin + meta + toiminnot ──────────────────────

function buildCard(item: InventoryItem, view: InventoryView, cb: InventoryPageCallbacks): HTMLElement {
  const card = document.createElement('div')
  card.className = 'inv-card'
  card.dataset.itemId = item.id

  const head = document.createElement('div')
  head.className = 'inv-card-head'

  const nameEl = document.createElement('span')
  nameEl.className = 'inv-card-name'
  nameEl.textContent = resolveItemName(item, view.templates) // V164 textContent, V165 elävä label
  if (item.templateId) nameEl.classList.add('inv-card-name-sign')
  head.appendChild(nameEl)

  head.appendChild(buildStepper(item, cb))
  card.appendChild(head)

  const meta = metaLine(item)
  if (meta) card.appendChild(meta)

  const actions = document.createElement('div')
  actions.className = 'inv-card-actions'

  const detailsBtn = document.createElement('button')
  detailsBtn.type = 'button'
  detailsBtn.className = 'inv-btn inv-btn-details'
  detailsBtn.textContent = '✎ Tiedot'
  detailsBtn.addEventListener('click', () => toggleDetailsEditor(card, item, cb))
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
  if (item.unit) {
    const u = document.createElement('span')
    u.className = 'inv-step-unit'
    u.textContent = item.unit
    stepper.appendChild(u)
  }
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

function toggleDetailsEditor(card: HTMLElement, item: InventoryItem, cb: InventoryPageCallbacks): void {
  const existing = card.querySelector('.inv-details-editor')
  if (existing) { existing.remove(); return }

  const editor = document.createElement('div')
  editor.className = 'inv-details-editor'

  const unit = labeledInput('Yksikkö', 'inv-d-unit', item.unit ?? '')
  const note = labeledInput('Kommentti', 'inv-d-note', item.note ?? '')
  editor.append(unit.wrap, note.wrap)

  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'inv-btn inv-btn-primary'
  save.textContent = 'Tallenna'
  save.addEventListener('click', async () => {
    await cb.onEditItem(item.id, fieldsOf(item, { unit: strOrNull(unit.input.value), note: strOrNull(note.input.value) }))
  })
  editor.appendChild(save)

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
    ...overrides,
  }
}

function inputAsInput(item: InventoryItem): Record<string, unknown> {
  return { name: item.name, unit: item.unit, note: item.note, locationId: item.locationId ?? undefined, templateId: item.templateId ?? undefined }
}

function locationIdFromSelection(sel: LocationSelection): string | null {
  return sel === 'none' ? null : sel
}

function strOrNull(x: string): string | null {
  const t = x.trim()
  return t.length ? t : null
}

function showError(el: HTMLElement, code: string): void {
  el.textContent = ERR_TEXT[code] ?? 'Tallennus epäonnistui.'
  el.hidden = false
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
