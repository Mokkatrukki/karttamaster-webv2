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

describe('T248 paikkojen muokkaus-mode', () => {
  it('"✎ Muokkaa" näkyy kun paikkoja on', () => {
    renderInventory(container, view(), makeCb())
    expect(container.querySelector('#inv-loc-edit-toggle')).not.toBeNull()
  })

  it('ei "✎ Muokkaa" kun ei paikkoja', () => {
    renderInventory(container, view({ locations: [], selectedLocationId: 'none' }), makeCb())
    expect(container.querySelector('#inv-loc-edit-toggle')).toBeNull()
  })

  it('✎ avaa editori-paneelin (rivi per paikka), uudelleen sulkee', () => {
    renderInventory(container, view(), makeCb())
    const toggle = container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!
    toggle.click()
    expect(container.querySelector('.inv-loc-editor')).not.toBeNull()
    expect(container.querySelectorAll('.inv-loc-edit-row')).toHaveLength(2) // Kärry, Varasto
    toggle.click()
    expect(container.querySelector('.inv-loc-editor')).toBeNull()
  })

  it('nimen muutos + Enter → onRenameLocation(id, uusinimi)', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = container.querySelector<HTMLInputElement>('.inv-loc-edit-input')! // eka = Kärry
    input.value = 'Peräkärry'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(cb.onRenameLocation).toHaveBeenCalledWith('loc-karry', 'Peräkärry')
  })

  it('muuttumaton nimi → ei renamea', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = container.querySelector<HTMLInputElement>('.inv-loc-edit-input')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })) // sama arvo
    expect(cb.onRenameLocation).not.toHaveBeenCalled()
  })

  it('tyhjä nimi → ei renamea', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    const input = container.querySelector<HTMLInputElement>('.inv-loc-edit-input')!
    input.value = '   '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(cb.onRenameLocation).not.toHaveBeenCalled()
  })

  it('Poista → onDeleteLocation(loc)', () => {
    const cb = makeCb()
    renderInventory(container, view(), cb)
    container.querySelector<HTMLButtonElement>('#inv-loc-edit-toggle')!.click()
    container.querySelector<HTMLButtonElement>('.inv-loc-edit-del')!.click() // eka = Kärry
    expect(cb.onDeleteLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'loc-karry', name: 'Kärry' }))
  })
})
