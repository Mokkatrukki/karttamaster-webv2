import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory, renderForbidden } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

function tpl(id: string, label: string): SignTemplate {
  return { id, label, color: '#10b981', description: '', favorite: false }
}

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'Kepit', qty: 5, unit: null, location: null, note: null, locationId: 'loc-karry', templateId: null, ...over }
}
function loc(over: Partial<InventoryLocation> = {}): InventoryLocation {
  return { id: 'loc-karry', name: 'Kärry', sortOrder: 0, ...over }
}

function view(over: Partial<InventoryView> = {}): InventoryView {
  return {
    locations: [loc()],
    items: [item()],
    selectedLocationId: 'loc-karry',
    templates: new Map(),
    ...over,
  }
}

function makeCb(over: Partial<InventoryPageCallbacks> = {}): InventoryPageCallbacks {
  return {
    onSelectLocation: vi.fn(),
    onAddLocation: vi.fn(() => true),
    onAddItem: vi.fn(() => true),
    onEditItem: vi.fn(() => true),
    onDeleteItem: vi.fn(),
    ...over,
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}
function setVal(root: HTMLElement, cls: string, v: string): void {
  root.querySelector<HTMLInputElement>(`.${cls}`)!.value = v
}

let container: HTMLElement
beforeEach(() => {
  container = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(container)
})

describe('T245 paikkanavigointi', () => {
  it('tab-järjestys: paikat, "Ei paikkaa", sitten "Kaikki" (ei ensimmäisenä)', () => {
    renderInventory(container, view({ locations: [loc(), loc({ id: 'loc-varasto', name: 'Varasto' })] }), makeCb())
    const tabs = [...container.querySelectorAll('.inv-loc-tab')].map((t) => t.textContent)
    expect(tabs).toEqual(['Kärry', 'Varasto', 'Ei paikkaa', 'Kaikki'])
  })

  it('valittu paikka saa .active', () => {
    renderInventory(container, view({ selectedLocationId: 'loc-karry' }), makeCb())
    const active = container.querySelector('.inv-loc-tab.active')!
    expect(active.textContent).toBe('Kärry')
  })

  it('tabin klikkaus → onSelectLocation', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    const eiPaikkaa = [...container.querySelectorAll<HTMLButtonElement>('.inv-loc-tab')].find((t) => t.textContent === 'Ei paikkaa')!
    eiPaikkaa.click()
    expect(cb.onSelectLocation).toHaveBeenCalledWith('none')
  })

  it('+ Paikka → peruttava modaali → Luo → onAddLocation', async () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-add')!.click()
    // Modaali renderöityy document.bodyyn (Modal footer -pattern)
    const input = document.querySelector<HTMLInputElement>('.inv-modal-form input')!
    input.value = 'Peräkärry'
    document.querySelector<HTMLFormElement>('.inv-modal-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddLocation).toHaveBeenCalledWith('Peräkärry')
  })

  it('B: keskeneräinen lisäysnimi säilyy re-renderin yli (stepper-reload)', () => {
    renderInventory(container, view(), makeCb())
    setVal(container, 'inv-f-name', 'Nippuside')
    setVal(container, 'inv-f-qty', '250')
    // Simuloi stepper +/- → onEditItem → load() → renderInventory samaan containeriin
    renderInventory(container, view(), makeCb())
    expect(container.querySelector<HTMLInputElement>('.inv-f-name')!.value).toBe('Nippuside')
    expect(container.querySelector<HTMLInputElement>('.inv-f-qty')!.value).toBe('250')
  })

  it('onnistunut lisäys tyhjentää nimen (ei jää draftina seuraavaan renderiin)', async () => {
    const cb = makeCb({ onAddItem: vi.fn(() => true) })
    renderInventory(container, view(), cb)
    setVal(container, 'inv-f-name', 'Kertakäyttö')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    // Lomake tyhjennettiin submitissa → re-render lukee tyhjän draftin
    renderInventory(container, view(), cb)
    expect(container.querySelector<HTMLInputElement>('.inv-f-name')!.value).toBe('')
  })

  it('+ Paikka → Peruuta → ei onAddLocation, modaali sulkeutuu', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-add')!.click()
    const input = document.querySelector<HTMLInputElement>('.inv-modal-form input')!
    input.value = 'Peräkärry'
    document.querySelector<HTMLButtonElement>('.modal-btn-secondary')!.click()
    expect(cb.onAddLocation).not.toHaveBeenCalled()
    expect(document.querySelector('.inv-sign-picker[role="dialog"]')).toBeNull()
  })
})

describe('T245 lista + lisäys', () => {
  it('tyhjä lista → "Ei tavaroita"', () => {
    renderInventory(container, view({ items: [] }), makeCb())
    expect(container.querySelector('.inv-empty')!.textContent).toContain('Ei tavaroita')
  })

  it('minimilisäys nimi+määrä → onAddItem, locationId kontekstista', async () => {
    const cb = makeCb()
    renderInventory(container, view({ selectedLocationId: 'loc-karry' }), cb)
    setVal(container, 'inv-f-name', 'Nauha')
    setVal(container, 'inv-f-qty', '3')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nauha', qty: 3, locationId: 'loc-karry' }))
  })

  it('lisäys "Ei paikkaa"-valinnalla → locationId null', async () => {
    const cb = makeCb()
    renderInventory(container, view({ selectedLocationId: 'none' }), cb)
    setVal(container, 'inv-f-name', 'orpo')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'orpo', locationId: null }))
  })

  it('tyhjä tarvike-nimi → virhe, onAddItem ei kutsuta', async () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    setVal(container, 'inv-f-name', '  ')
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddItem).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLElement>('#inv-add-error')!.hidden).toBe(false)
  })
})

describe('T245 määräsäädin', () => {
  it('+ → onEditItem qty+1', () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item({ qty: 5 })] }), cb)
    container.querySelector<HTMLButtonElement>('.inv-step-plus')!.click()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ qty: 6 }))
  })

  it('− → onEditItem qty-1', () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item({ qty: 5 })] }), cb)
    container.querySelector<HTMLButtonElement>('.inv-step-minus')!.click()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ qty: 4 }))
  })

  it('− nollasta → pysyy 0 (adjustQty-clamp)', () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item({ qty: 0 })] }), cb)
    container.querySelector<HTMLButtonElement>('.inv-step-minus')!.click()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ qty: 0 }))
  })

  it('tap määrä → input → Enter → onEditItem tarkalla luvulla', async () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item({ qty: 5 })] }), cb)
    container.querySelector<HTMLButtonElement>('.inv-step-qty')!.click()
    const input = container.querySelector<HTMLInputElement>('.inv-step-qty-input')!
    input.value = '12'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    await flush()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ qty: 12 }))
  })
})

describe('T245 tiedot-editori + poisto', () => {
  it('✎ Tiedot → yksikkö+kommentti → Tallenna → onEditItem', async () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item()] }), cb)
    const card = container.querySelector<HTMLElement>('.inv-card')!
    ;[...card.querySelectorAll('button')].find((b) => b.textContent === '✎ Tiedot')!.click()
    setVal(card, 'inv-d-unit', 'rullaa')
    setVal(card, 'inv-d-note', 'iso pino')
    ;[...card.querySelectorAll('button')].find((b) => b.textContent === 'Tallenna')!.click()
    await flush()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ unit: 'rullaa', note: 'iso pino' }))
  })

  it('Poista → onDeleteItem', () => {
    const cb = makeCb()
    renderInventory(container, view({ items: [item()] }), cb)
    ;[...container.querySelectorAll('button')].find((b) => b.textContent === 'Poista')!.click()
    expect(cb.onDeleteItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
  })
})

describe('T245 merkki-rivi (V165 resolveItemName) + V164 XSS', () => {
  it('merkki-rivi näyttää elävän template.labelin', () => {
    const templates = new Map([['tpl-1', tpl('tpl-1', 'Alueella pyöräkilpailu')]])
    renderInventory(container, view({ items: [item({ name: 'snapshot', templateId: 'tpl-1' })], templates }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu')
  })

  it('poistettu template → fallback snapshot-name', () => {
    renderInventory(container, view({ items: [item({ name: 'Kyltti-snapshot', templateId: 'poistettu' })], templates: new Map() }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Kyltti-snapshot')
  })

  it('V164: nimi jossa HTML renderöityy tekstinä', () => {
    const evil = '<img src=x onerror="1">'
    renderInventory(container, view({ items: [item({ name: evil })] }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe(evil)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('T245 sign-nappi + forbidden', () => {
  it('+ Merkki -nappi näkyy vain jos onAddSign kytketty', () => {
    renderInventory(container, view(), makeCb())
    expect(container.querySelector('#inv-add-sign-btn')).toBeNull()
    renderInventory(container, view(), makeCb({ onAddSign: vi.fn() }))
    expect(container.querySelector('#inv-add-sign-btn')).not.toBeNull()
  })

  it('renderForbidden näyttää järjestäjä-viestin', () => {
    renderForbidden(container)
    expect(container.querySelector('.inv-forbidden')!.textContent).toContain('vain järjestäjille')
  })
})
