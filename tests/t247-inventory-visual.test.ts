import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

function tpl(id: string, label: string): SignTemplate {
  return { id, label, color: '#10b981', description: '', favorite: false }
}
function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'Kepit', qty: 5, unit: null, location: null, note: null, locationId: 'loc-karry', templateId: null, ...over }
}
function loc(id: string, name: string): InventoryLocation {
  return { id, name, sortOrder: 0 }
}
function view(over: Partial<InventoryView> = {}): InventoryView {
  return { locations: [loc('loc-karry', 'Kärry')], items: [item()], selectedLocationId: 'loc-karry', templates: new Map(), ...over }
}
function makeCb(over: Partial<InventoryPageCallbacks> = {}): InventoryPageCallbacks {
  return { onSelectLocation: vi.fn(), onAddLocation: vi.fn(() => true), onAddItem: vi.fn(() => true), onEditItem: vi.fn(() => true), onDeleteItem: vi.fn(), ...over }
}

let container: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
})

describe('T247 merkki-rivin visuaali (V167)', () => {
  it('merkki-rivi → visuaali + zoom-nappi nimen vieressä', () => {
    const templates = new Map([['tpl-1', tpl('tpl-1', 'Pyöräkilpailu')]])
    renderInventory(container, view({ items: [item({ templateId: 'tpl-1' })], templates }), makeCb())
    const card = container.querySelector('.inv-card')!
    expect(card.querySelector('.marker-visual-row-sv')).not.toBeNull()
    expect(card.querySelector('.marker-visual-row-zoom')).not.toBeNull() // zoomable → avaus
  })

  it('tarvike-rivi (ei templateId) → EI visuaalia', () => {
    renderInventory(container, view({ items: [item({ templateId: null })] }), makeCb())
    expect(container.querySelector('.marker-visual-row-sv')).toBeNull()
  })

  it('template puuttuu mapista → ei visuaalia, fallback-nimi', () => {
    renderInventory(container, view({ items: [item({ name: 'snapshot', templateId: 'poistettu' })], templates: new Map() }), makeCb())
    expect(container.querySelector('.marker-visual-row-sv')).toBeNull()
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('snapshot')
  })
})

describe('T247 stepper-tasaus (yksikkö ulkona stepperistä)', () => {
  it('yksikkö renderöityy .inv-card-unit, EI .inv-stepper sisällä', () => {
    renderInventory(container, view({ items: [item({ unit: 'rullaa' })] }), makeCb())
    const unit = container.querySelector('.inv-card-unit')!
    expect(unit.textContent).toBe('rullaa')
    // stepper sisältää vain − luku + (ei yksikköä)
    const stepper = container.querySelector('.inv-stepper')!
    expect(stepper.textContent).not.toContain('rullaa')
    expect(stepper.querySelectorAll('button')).toHaveLength(3) // −, luku, +
  })

  it('yksikötön rivi → ei .inv-card-unit', () => {
    renderInventory(container, view({ items: [item({ unit: null })] }), makeCb())
    expect(container.querySelector('.inv-card-unit')).toBeNull()
  })
})

describe('T247 "Kaikki"-kokooma väliotsikoin', () => {
  const allView = (): InventoryView => ({
    locations: [loc('loc-karry', 'Kärry'), loc('loc-varasto', 'Varasto')],
    items: [
      item({ id: 'a', name: 'kepit', locationId: 'loc-karry' }),
      item({ id: 'b', name: 'teltta', locationId: 'loc-varasto' }),
      item({ id: 'c', name: 'orpo', locationId: null }),
    ],
    selectedLocationId: 'all',
    templates: new Map(),
  })

  it('paikkapalkissa "Kaikki"-tabi ensimmäisenä + aktiivinen', () => {
    renderInventory(container, allView(), makeCb())
    const tabs = container.querySelectorAll('.inv-loc-tab')
    expect(tabs[0].textContent).toBe('Kaikki')
    expect(tabs[0].classList.contains('active')).toBe(true)
  })

  it('väliotsikot per paikka + "Ei paikkaa"', () => {
    renderInventory(container, allView(), makeCb())
    const titles = [...container.querySelectorAll('.inv-section-title')].map((e) => e.textContent)
    expect(titles).toEqual(['Kärry', 'Varasto', 'Ei paikkaa'])
  })

  it('itemit oikeissa osioissa', () => {
    renderInventory(container, allView(), makeCb())
    const sections = container.querySelectorAll('.inv-section')
    expect(sections[0].querySelector('.inv-card-name')!.textContent).toBe('kepit') // Kärry
    expect(sections[2].querySelector('.inv-card-name')!.textContent).toBe('orpo') // Ei paikkaa
  })

  it('tyhjä paikka ei saa osiota (vain paikat joissa on tavaraa)', () => {
    const v = allView()
    v.items = [item({ id: 'a', name: 'kepit', locationId: 'loc-karry' })] // vain Kärryssä
    renderInventory(container, v, makeCb())
    const titles = [...container.querySelectorAll('.inv-section-title')].map((e) => e.textContent)
    expect(titles).toEqual(['Kärry'])
  })

  it('"Kaikki"-tabin klikkaus → onSelectLocation("all")', () => {
    const cb = makeCb()
    renderInventory(container, view({ selectedLocationId: 'loc-karry' }), cb)
    container.querySelectorAll<HTMLButtonElement>('.inv-loc-tab')[0].click() // Kaikki
    expect(cb.onSelectLocation).toHaveBeenCalledWith('all')
  })
})

describe('T247 nimi-klikkaus → onOpenSign (SignTemplateModal)', () => {
  it('merkki-nimi on nappi, klikkaus → onOpenSign(templateId)', () => {
    const cb = makeCb({ onOpenSign: vi.fn() })
    const templates = new Map([['tpl-1', tpl('tpl-1', 'Pyöräkilpailu')]])
    renderInventory(container, view({ items: [item({ templateId: 'tpl-1' })], templates }), cb)
    const nameBtn = container.querySelector<HTMLButtonElement>('.inv-card-name-btn')!
    expect(nameBtn.textContent).toBe('Pyöräkilpailu')
    nameBtn.click()
    expect(cb.onOpenSign).toHaveBeenCalledWith('tpl-1')
  })

  it('tarvike-nimi ei ole nappi (ei onOpenSign)', () => {
    renderInventory(container, view({ items: [item({ templateId: null })] }), makeCb({ onOpenSign: vi.fn() }))
    expect(container.querySelector('.inv-card-name-btn')).toBeNull()
  })
})

describe('T247 lisäys "Kaikki"-tilassa vaatii paikan', () => {
  const allLocs = (): InventoryView => ({
    locations: [loc('loc-karry', 'Kärry'), loc('loc-varasto', 'Varasto')],
    items: [],
    selectedLocationId: 'all',
    templates: new Map(),
  })

  it('paikka-select näkyy, oletus Kärry', () => {
    renderInventory(container, allLocs(), makeCb())
    const sel = container.querySelector<HTMLSelectElement>('.inv-add-location')!
    expect(sel).not.toBeNull()
    expect(sel.value).toBe('loc-karry') // oletus Kärry
  })

  it('lisäys → onAddItem valitulla paikalla', async () => {
    const cb = makeCb()
    renderInventory(container, allLocs(), cb)
    ;(container.querySelector<HTMLInputElement>('.inv-f-name')!).value = 'kepit'
    ;(container.querySelector<HTMLSelectElement>('.inv-add-location')!).value = 'loc-varasto'
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'kepit', locationId: 'loc-varasto' }))
  })

  it('ei paikkoja → hint + lisäys estetty', async () => {
    const cb = makeCb()
    renderInventory(container, { locations: [], items: [], selectedLocationId: 'all', templates: new Map() }, cb)
    expect(container.querySelector('.inv-add-hint')).not.toBeNull()
    ;(container.querySelector<HTMLInputElement>('.inv-f-name')!).value = 'kepit'
    container.querySelector<HTMLFormElement>('#inv-add-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await flush()
    expect(cb.onAddItem).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLElement>('#inv-add-error')!.hidden).toBe(false)
  })
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('T247 siirto toiseen paikkaan (tiedot-editori)', () => {
  it('✎ Tiedot → paikka-select → Tallenna → onEditItem uudella locationId', () => {
    const cb = makeCb()
    const v: InventoryView = {
      locations: [loc('loc-karry', 'Kärry'), loc('loc-varasto', 'Varasto')],
      items: [item({ locationId: 'loc-karry' })],
      selectedLocationId: 'loc-karry',
      templates: new Map(),
    }
    renderInventory(container, v, cb)
    const card = container.querySelector<HTMLElement>('.inv-card')!
    ;[...card.querySelectorAll('button')].find((b) => b.textContent === '✎ Tiedot')!.click()
    const sel = card.querySelector<HTMLSelectElement>('.inv-d-location')!
    sel.value = 'loc-varasto'
    ;[...card.querySelectorAll('button')].find((b) => b.textContent === 'Tallenna')!.click()
    expect(cb.onEditItem).toHaveBeenCalledWith('i1', expect.objectContaining({ locationId: 'loc-varasto' }))
  })
})
