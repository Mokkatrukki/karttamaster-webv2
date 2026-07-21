import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory, renderForbidden, type InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem } from '../src/logic/inventory'

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'Nitoja', qty: 2, unit: 'kpl', location: 'kärry', note: null, ...over }
}

function makeCallbacks(over: Partial<InventoryPageCallbacks> = {}): InventoryPageCallbacks {
  return {
    onAdd: vi.fn(() => true),
    onEdit: vi.fn(() => true),
    onDelete: vi.fn(),
    ...over,
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function setInput(root: HTMLElement, cls: string, value: string): void {
  const el = root.querySelector<HTMLInputElement>(`.${cls}`)!
  el.value = value
}

let container: HTMLElement
beforeEach(() => {
  container = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(container)
})

describe('T242 renderInventory — listaus', () => {
  it('tyhjä lista → "Ei tavaroita"', () => {
    renderInventory(container, [], makeCallbacks())
    expect(container.querySelector('.inv-empty')!.textContent).toContain('Ei tavaroita')
  })

  it('renderöi kortin per rivi', () => {
    renderInventory(container, [item(), item({ id: 'i2', name: 'Teltta', qty: 1, unit: null })], makeCallbacks())
    const cards = container.querySelectorAll('.inv-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].querySelector('.inv-card-name')!.textContent).toBe('Nitoja')
    expect(cards[0].querySelector('.inv-card-qty')!.textContent).toBe('2 kpl')
    // yksikötön → pelkkä numero
    expect(cards[1].querySelector('.inv-card-qty')!.textContent).toBe('1')
  })

  it('sijainti + kommentti näkyvät meta-rivillä', () => {
    renderInventory(container, [item({ location: 'varasto', note: 'iso pino' })], makeCallbacks())
    const meta = container.querySelector('.inv-card-meta')!.textContent!
    expect(meta).toContain('varasto')
    expect(meta).toContain('iso pino')
  })
})

describe('T242 lisäys', () => {
  it('validi syöte → onAdd normalisoiduilla kentillä', async () => {
    const cb = makeCallbacks()
    renderInventory(container, [], cb)
    setInput(container, 'inv-f-name', '  Kepit  ')
    setInput(container, 'inv-f-qty', '50')
    setInput(container, 'inv-f-unit', 'kpl')
    setInput(container, 'inv-f-location', 'kärry')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAdd).toHaveBeenCalledWith({ name: 'Kepit', qty: 50, unit: 'kpl', location: 'kärry', note: null })
  })

  it('tyhjä nimi → virhe näkyy, onAdd EI kutsuta (client-validointi)', async () => {
    const cb = makeCallbacks()
    renderInventory(container, [], cb)
    setInput(container, 'inv-f-name', '   ')
    setInput(container, 'inv-f-qty', '5')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAdd).not.toHaveBeenCalled()
    const err = container.querySelector<HTMLElement>('#inv-add-error')!
    expect(err.hidden).toBe(false)
    expect(err.textContent).toContain('Nimi')
  })

  it('tyhjä määrä → oletus 0, onAdd kutsutaan', async () => {
    const cb = makeCallbacks()
    renderInventory(container, [], cb)
    setInput(container, 'inv-f-name', 'nauha')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'nauha', qty: 0 }))
  })
})

describe('T242 muokkaus + poisto', () => {
  it('Muokkaa → Tallenna → onEdit oikealla id:llä', async () => {
    const cb = makeCallbacks()
    renderInventory(container, [item()], cb)
    const card = container.querySelector<HTMLElement>('.inv-card')!
    card.querySelector<HTMLButtonElement>('.inv-btn-edit')!.click()
    // muokkaustila: kentät esitäytetty
    expect(card.classList.contains('editing')).toBe(true)
    setInput(card, 'inv-f-qty', '1')
    // Tallenna-nappi
    const saveBtn = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Tallenna')!
    saveBtn.click()
    await flush()
    expect(cb.onEdit).toHaveBeenCalledWith('i1', expect.objectContaining({ name: 'Nitoja', qty: 1 }))
  })

  it('Muokkaa → Peruuta → palaa näyttötilaan, onEdit ei kutsuta', () => {
    const cb = makeCallbacks()
    renderInventory(container, [item()], cb)
    const card = container.querySelector<HTMLElement>('.inv-card')!
    card.querySelector<HTMLButtonElement>('.inv-btn-edit')!.click()
    const cancelBtn = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Peruuta')!
    cancelBtn.click()
    expect(card.classList.contains('editing')).toBe(false)
    expect(card.querySelector('.inv-card-name')!.textContent).toBe('Nitoja')
    expect(cb.onEdit).not.toHaveBeenCalled()
  })

  it('Poista → onDelete kutsutaan rivillä', () => {
    const cb = makeCallbacks()
    renderInventory(container, [item()], cb)
    container.querySelector<HTMLButtonElement>('.inv-btn-delete')!.click()
    expect(cb.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
  })
})

describe('T242 V164 — stored-XSS-esto', () => {
  it('nimi jossa HTML renderöityy tekstinä, ei elementtinä', () => {
    const evil = '<img src=x onerror="window.__xss=1">'
    renderInventory(container, [item({ name: evil })], makeCallbacks())
    // Nimi näkyy raakatekstinä
    expect(container.querySelector('.inv-card-name')!.textContent).toBe(evil)
    // MUTTA injektoitua <img>-elementtiä ei synny DOM:iin
    expect(container.querySelector('img')).toBeNull()
  })

  it('kommentti jossa HTML renderöityy tekstinä', () => {
    const evil = '<script>alert(1)</script>'
    renderInventory(container, [item({ note: evil })], makeCallbacks())
    expect(container.querySelector('.inv-card-meta')!.textContent).toContain(evil)
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('T242 renderForbidden', () => {
  it('näyttää järjestäjä-viestin (V163 UI-puoli)', () => {
    renderForbidden(container)
    expect(container.querySelector('.inv-forbidden')!.textContent).toContain('vain järjestäjille')
  })
})
