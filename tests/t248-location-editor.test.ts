import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'Kepit', qty: 5, unit: null, location: null, note: null, locationId: 'loc-karry', templateId: null, ...over }
}
function loc(id: string, name: string): InventoryLocation {
  return { id, name, sortOrder: 0 }
}
function view(over: Partial<InventoryView> = {}): InventoryView {
  return {
    locations: [loc('loc-karry', 'Kärry'), loc('loc-varasto', 'Varasto')],
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
    onRenameLocation: vi.fn(() => true),
    onDeleteLocation: vi.fn(),
    ...over,
  }
}

let container: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
})

// Modaali renderöityy document.bodyyn (ei containeriin) — hae sieltä.
function modal(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.inv-sign-picker[role="dialog"]')
}

describe('T248 paikkojen muokkaus-modaali', () => {
  it('"✎ Muokkaa" näkyy kun paikkoja on', () => {
    renderInventory(container, view(), makeCb())
    expect(container.querySelector('#inv-loc-edit-toggle')).not.toBeNull()
  })

  it('ei "✎ Muokkaa" kun ei paikkoja', () => {
    renderInventory(container, view({ locations: [], selectedLocationId: 'none' }), makeCb())
    expect(container.querySelector('#inv-loc-edit-toggle')).toBeNull()
  })

  it('✎ avaa peruttavan hallinta-modaalin (rivi per paikka)', () => {
    renderInventory(container, view(), makeCb())
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    expect(modal()).not.toBeNull()
    expect(document.querySelectorAll('.inv-manage-row')).toHaveLength(2) // Kärry, Varasto
  })

  it('Peruuta sulkee modaalin kirjoittamatta (ei renamea)', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = document.querySelector<HTMLInputElement>('.inv-manage-input')!
    input.value = 'Peräkärry'
    document.querySelector<HTMLButtonElement>('.modal-btn-secondary')!.click()
    expect(cb.onRenameLocation).not.toHaveBeenCalled()
    expect(modal()).toBeNull()
  })

  it('nimen muutos + Tallenna → onRenameLocation(id, uusinimi)', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = document.querySelector<HTMLInputElement>('.inv-manage-input')! // eka = Kärry
    input.value = 'Peräkärry'
    document.querySelector<HTMLButtonElement>('.modal-btn-primary')!.click()
    expect(cb.onRenameLocation).toHaveBeenCalledWith('loc-karry', 'Peräkärry')
  })

  it('muuttumaton nimi + Tallenna → ei renamea', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    document.querySelector<HTMLButtonElement>('.modal-btn-primary')!.click() // ei muutoksia
    expect(cb.onRenameLocation).not.toHaveBeenCalled()
  })

  it('tyhjä nimi + Tallenna → ei renamea', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = document.querySelector<HTMLInputElement>('.inv-manage-input')!
    input.value = '   '
    document.querySelector<HTMLButtonElement>('.modal-btn-primary')!.click()
    expect(cb.onRenameLocation).not.toHaveBeenCalled()
  })

  it('Poista → sulkee modaalin + onDeleteLocation(loc)', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    document.querySelector<HTMLButtonElement>('.inv-manage-del')!.click() // eka = Kärry
    expect(cb.onDeleteLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'loc-karry', name: 'Kärry' }))
    expect(modal()).toBeNull()
  })
})
