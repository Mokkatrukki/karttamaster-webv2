import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: '20km kyltti irto', qty: 4, unit: null, location: null, note: null, locationId: 'l1', templateId: null, ...over }
}
function loc(): InventoryLocation { return { id: 'l1', name: 'Kärry', sortOrder: 0 } }
function tpl(): SignTemplate { return { id: 't1', label: 'Oikealle', color: '#10b981', description: '', favorite: false, keppi: true } }
function view(items: InventoryItem[], templates = new Map<string, SignTemplate>()): InventoryView {
  return { locations: [loc()], items, selectedLocationId: 'l1', templates }
}
function makeCb(over: Partial<InventoryPageCallbacks> = {}): InventoryPageCallbacks {
  return { onSelectLocation: vi.fn(), onAddLocation: vi.fn(() => true), onAddItem: vi.fn(() => true), onEditItem: vi.fn(() => true), onDeleteItem: vi.fn(), onConvertToSign: vi.fn(), ...over }
}

let container: HTMLElement
beforeEach(() => { container = document.createElement('div'); document.body.innerHTML = ''; document.body.appendChild(container) })

function openDetails(): void {
  container.querySelector<HTMLButtonElement>('.inv-card:first-child .inv-btn-details')!.click()
}

describe('T250 "Muuta merkiksi"', () => {
  it('näkyy tarvike-/tekstirivin tiedoissa', () => {
    renderInventory(container, view([item()]), makeCb())
    openDetails()
    expect(container.querySelector('.inv-btn-convert')).not.toBeNull()
  })

  it('EI näy merkki-rivillä (template_id asetettu)', () => {
    renderInventory(container, view([item({ templateId: 't1' })], new Map([['t1', tpl()]])), makeCb())
    openDetails()
    expect(container.querySelector('.inv-btn-convert')).toBeNull()
  })

  it('klikki → onConvertToSign(item)', () => {
    const cb = makeCb()
    renderInventory(container, view([item()]), cb)
    openDetails()
    container.querySelector<HTMLButtonElement>('.inv-btn-convert')!.click()
    expect(cb.onConvertToSign).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', name: '20km kyltti irto' }))
  })

  it('ei nappia jos onConvertToSign puuttuu callbackeista', () => {
    renderInventory(container, view([item()]), makeCb({ onConvertToSign: undefined }))
    openDetails()
    expect(container.querySelector('.inv-btn-convert')).toBeNull()
  })
})
