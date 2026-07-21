import { validateInventoryItem } from '../logic/inventory'
import type { InventoryItem, InventoryFields, InventoryInput } from '../logic/inventory'

export interface InventoryPageCallbacks {
  onAdd: (fields: InventoryFields) => Promise<boolean> | boolean
  onEdit: (id: string, fields: InventoryFields) => Promise<boolean> | boolean
  onDelete: (item: InventoryItem) => void
}

const ERR_TEXT: Record<string, string> = {
  name_required: 'Nimi on pakollinen.',
  invalid_qty: 'Määrä = numero, 0 tai suurempi.',
}

/** Renderöi inventaariosivu: lisäyslomake + tavaralistaus. Kaikki user-teksti textContentillä (V164). */
export function renderInventory(container: HTMLElement, items: InventoryItem[], cb: InventoryPageCallbacks): void {
  container.innerHTML = ''
  container.appendChild(buildAddForm(cb))

  const list = document.createElement('div')
  list.className = 'inv-list'
  list.id = 'inv-list'

  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'inv-empty'
    empty.textContent = 'Ei tavaroita vielä — lisää ensimmäinen ylhäältä.'
    list.appendChild(empty)
  } else {
    for (const item of items) list.appendChild(buildCard(item, cb))
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

// ── Lomake-kentät (jaettu lisäys + muokkaus) ─────────────────────────────────

interface FieldSet {
  root: HTMLElement
  read: () => InventoryInput
  focusName: () => void
}

function buildFieldSet(prefill?: InventoryItem): FieldSet {
  const root = document.createElement('div')
  root.className = 'inv-fields'

  const name = textInput('inv-f-name', 'Nimi', prefill?.name ?? '')
  const qty = numberInput('inv-f-qty', 'Määrä', prefill ? String(prefill.qty) : '')
  const unit = textInput('inv-f-unit', 'Yksikkö', prefill?.unit ?? '')
  const location = textInput('inv-f-location', 'Sijainti', prefill?.location ?? '')
  const note = textInput('inv-f-note', 'Kommentti', prefill?.note ?? '')

  root.append(name.wrap, qty.wrap, unit.wrap, location.wrap, note.wrap)

  return {
    root,
    read: () => ({
      name: name.input.value,
      // tyhjä määrä → undefined → validointi käyttää oletusta 0 (V162)
      qty: qty.input.value.trim() === '' ? undefined : Number(qty.input.value),
      unit: unit.input.value,
      location: location.input.value,
      note: note.input.value,
    }),
    focusName: () => name.input.focus(),
  }
}

function buildAddForm(cb: InventoryPageCallbacks): HTMLElement {
  const form = document.createElement('form')
  form.className = 'inv-add-form'
  form.id = 'inv-add-form'

  const heading = document.createElement('h2')
  heading.className = 'inv-add-heading'
  heading.textContent = 'Lisää tavara'
  form.appendChild(heading)

  const fields = buildFieldSet()
  form.appendChild(fields.root)

  const err = document.createElement('p')
  err.className = 'inv-error'
  err.id = 'inv-add-error'
  err.hidden = true
  form.appendChild(err)

  const addBtn = document.createElement('button')
  addBtn.type = 'submit'
  addBtn.className = 'inv-btn inv-btn-primary'
  addBtn.id = 'inv-add-btn'
  addBtn.textContent = '+ Lisää'
  form.appendChild(addBtn)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const res = validateInventoryItem(fields.read())
    if (!res.ok) {
      showError(err, res.error)
      return
    }
    err.hidden = true
    const ok = await cb.onAdd(res.value)
    if (!ok) showError(err, 'save_failed')
  })

  return form
}

// ── Tavarakortti (näyttö + inline-muokkaus) ──────────────────────────────────

function buildCard(item: InventoryItem, cb: InventoryPageCallbacks): HTMLElement {
  const card = document.createElement('div')
  card.className = 'inv-card'
  card.dataset.itemId = item.id
  renderCardView(card, item, cb)
  return card
}

function renderCardView(card: HTMLElement, item: InventoryItem, cb: InventoryPageCallbacks): void {
  card.innerHTML = ''
  card.classList.remove('editing')

  const main = document.createElement('div')
  main.className = 'inv-card-main'

  const nameEl = document.createElement('span')
  nameEl.className = 'inv-card-name'
  nameEl.textContent = item.name // V164: textContent, ei innerHTML
  main.appendChild(nameEl)

  const qtyEl = document.createElement('span')
  qtyEl.className = 'inv-card-qty'
  qtyEl.textContent = item.unit ? `${item.qty} ${item.unit}` : String(item.qty)
  main.appendChild(qtyEl)

  card.appendChild(main)

  const meta = metaLine(item)
  if (meta) card.appendChild(meta)

  const actions = document.createElement('div')
  actions.className = 'inv-card-actions'

  const editBtn = document.createElement('button')
  editBtn.type = 'button'
  editBtn.className = 'inv-btn inv-btn-edit'
  editBtn.textContent = 'Muokkaa'
  editBtn.addEventListener('click', () => renderCardEdit(card, item, cb))
  actions.appendChild(editBtn)

  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.className = 'inv-btn inv-btn-delete'
  delBtn.textContent = 'Poista'
  delBtn.addEventListener('click', () => cb.onDelete(item))
  actions.appendChild(delBtn)

  card.appendChild(actions)
}

function metaLine(item: InventoryItem): HTMLElement | null {
  const parts: string[] = []
  if (item.location) parts.push(`📍 ${item.location}`)
  if (item.note) parts.push(item.note)
  if (parts.length === 0) return null
  const meta = document.createElement('div')
  meta.className = 'inv-card-meta'
  // Yksi span per osa → textContent (V164), ei mergeä innerHTML:ään.
  parts.forEach((p, i) => {
    if (i > 0) {
      const sep = document.createElement('span')
      sep.className = 'inv-meta-sep'
      sep.textContent = ' · '
      meta.appendChild(sep)
    }
    const span = document.createElement('span')
    span.textContent = p
    meta.appendChild(span)
  })
  return meta
}

function renderCardEdit(card: HTMLElement, item: InventoryItem, cb: InventoryPageCallbacks): void {
  card.innerHTML = ''
  card.classList.add('editing')

  const fields = buildFieldSet(item)
  card.appendChild(fields.root)

  const err = document.createElement('p')
  err.className = 'inv-error'
  err.hidden = true
  card.appendChild(err)

  const actions = document.createElement('div')
  actions.className = 'inv-card-actions'

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'inv-btn inv-btn-primary'
  saveBtn.textContent = 'Tallenna'
  saveBtn.addEventListener('click', async () => {
    const res = validateInventoryItem(fields.read())
    if (!res.ok) {
      showError(err, res.error)
      return
    }
    const ok = await cb.onEdit(item.id, res.value)
    if (!ok) showError(err, 'save_failed')
    // onnistuessa load() re-renderöi koko listan → ei tarvitse palauttaa view-tilaa käsin
  })
  actions.appendChild(saveBtn)

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'inv-btn'
  cancelBtn.textContent = 'Peruuta'
  cancelBtn.addEventListener('click', () => renderCardView(card, item, cb))
  actions.appendChild(cancelBtn)

  card.appendChild(actions)
  fields.focusName()
}

// ── Apurit ───────────────────────────────────────────────────────────────────

function showError(el: HTMLElement, code: string): void {
  el.textContent = ERR_TEXT[code] ?? 'Tallennus epäonnistui.'
  el.hidden = false
}

function textInput(cls: string, placeholder: string, value: string): { wrap: HTMLElement; input: HTMLInputElement } {
  return makeInput('text', cls, placeholder, value)
}

function numberInput(cls: string, placeholder: string, value: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const f = makeInput('number', cls, placeholder, value)
  f.input.min = '0'
  f.input.step = 'any'
  f.input.inputMode = 'decimal'
  return f
}

function makeInput(type: string, cls: string, placeholder: string, value: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('label')
  wrap.className = 'inv-field'

  const span = document.createElement('span')
  span.className = 'inv-field-label'
  span.textContent = placeholder
  wrap.appendChild(span)

  const input = document.createElement('input')
  input.type = type
  input.className = cls
  input.placeholder = placeholder
  input.value = value
  wrap.appendChild(input)

  return { wrap, input }
}
