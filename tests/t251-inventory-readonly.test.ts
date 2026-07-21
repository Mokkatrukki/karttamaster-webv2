import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks, InventoryViewMode } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'Kepit', qty: 5, unit: null, location: null, note: null, locationId: 'loc-karry', templateId: null, ...over }
}
function loc(id: string, name: string): InventoryLocation {
  return { id, name, sortOrder: 0 }
}
function view(mode: InventoryViewMode, over: Partial<InventoryView> = {}): InventoryView {
  return {
    locations: [loc('loc-karry', 'Kärry')],
    items: [item()],
    selectedLocationId: 'loc-karry',
    templates: new Map(),
    viewMode: mode,
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
    onToggleViewMode: vi.fn(),
    ...over,
  }
}

let container: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
})

describe('T251 read-mode piilottaa mutaatiot (V169)', () => {
  it('read: EI stepper / actions / add-form / +Paikka / ✎ Muokkaa', () => {
    renderInventory(container, view('read'), makeCb())
    expect(container.querySelector('.inv-stepper')).toBeNull()
    expect(container.querySelector('.inv-card-actions')).toBeNull()
    expect(container.querySelector('#inv-add-form')).toBeNull()
    expect(container.querySelector('#inv-loc-add')).toBeNull()
    expect(container.querySelector('#inv-loc-edit-toggle')).toBeNull()
  })

  it('read: säilyttää katselun — tabit + toggle + määrä tekstinä', () => {
    renderInventory(container, view('read'), makeCb())
    expect(container.querySelector('#inv-location-bar')).not.toBeNull()
    expect(container.querySelectorAll('.inv-loc-tab').length).toBeGreaterThan(0)
    expect(container.querySelector('#inv-mode-toggle')).not.toBeNull()
    expect(container.querySelector('.inv-card-qty')!.textContent).toBe('5') // määrä pelkkänä tekstinä
    expect(container.querySelector('.inv-card--read')).not.toBeNull() // tiivis rivi
  })

  it('read: kyltin nimi säilyy klikattavana (SignTemplateModal sallittu read-modessa)', () => {
    const templates = new Map([['t1', { id: 't1', label: 'Oikealle', color: '#10b981', description: '', favorite: false }]])
    renderInventory(container, view('read', { items: [item({ templateId: 't1' })], templates }), makeCb({ onOpenSign: vi.fn() }))
    expect(container.querySelector('.inv-card-name-btn')).not.toBeNull()
  })

  it('edit: paljastaa kaikki mutaationapit', () => {
    renderInventory(container, view('edit'), makeCb())
    expect(container.querySelector('.inv-stepper')).not.toBeNull()
    expect(container.querySelector('.inv-card-actions')).not.toBeNull()
    expect(container.querySelector('#inv-add-form')).not.toBeNull()
    expect(container.querySelector('#inv-loc-add')).not.toBeNull()
    expect(container.querySelector('#inv-loc-edit-toggle')).not.toBeNull()
  })
})

describe('T251 moodi-signaali + toggle (V170)', () => {
  it('read: toggle-teksti "✎ Muokkaa", ei aksenttia', () => {
    renderInventory(container, view('read'), makeCb())
    const toggle = container.querySelector('#inv-mode-toggle')!
    expect(toggle.textContent).toBe('✎ Muokkaa')
    expect(toggle.classList.contains('active')).toBe(false)
    expect(container.classList.contains('inv-edit-mode')).toBe(false)
    expect(container.querySelector('.inv-mode-badge')).toBeNull()
  })

  it('edit: toggle-teksti "✓ Valmis" + accent + Muokkaustila-merkki', () => {
    renderInventory(container, view('edit'), makeCb())
    const toggle = container.querySelector('#inv-mode-toggle')!
    expect(toggle.textContent).toBe('✓ Valmis')
    expect(toggle.classList.contains('active')).toBe(true)
    expect(container.classList.contains('inv-edit-mode')).toBe(true)
    expect(container.querySelector('.inv-mode-badge')).not.toBeNull()
  })

  it('toggle-klikki kutsuu onToggleViewModea (state ulkoinen → reload=read V170)', () => {
    const onToggleViewMode = vi.fn()
    renderInventory(container, view('read'), makeCb({ onToggleViewMode }))
    container.querySelector<HTMLButtonElement>('#inv-mode-toggle')!.click()
    expect(onToggleViewMode).toHaveBeenCalledOnce()
  })
})

describe('T251 Kaikki-tabi moodikäytös (V171)', () => {
  const items = [item({ id: 'a', locationId: 'loc-karry' }), item({ id: 'b', locationId: null })]

  it('Kaikki + edit: korteilla stepper + actions, MUTTA add-form = pelkkä hint (ei inputteja)', () => {
    renderInventory(container, view('edit', { selectedLocationId: 'all', items }), makeCb())
    expect(container.querySelector('.inv-stepper')).not.toBeNull() // rivi-muokkaus ON
    expect(container.querySelector('.inv-card-actions')).not.toBeNull()
    expect(container.querySelector('.inv-add-hint')).not.toBeNull() // add-form = vain ohje
    expect(container.querySelector('.inv-f-name')).toBeNull() // EI lisäys-inputteja (V171)
  })

  it('Kaikki + read: ei steppereitä, ei add-formia', () => {
    renderInventory(container, view('read', { selectedLocationId: 'all', items }), makeCb())
    expect(container.querySelector('.inv-stepper')).toBeNull()
    expect(container.querySelector('#inv-add-form')).toBeNull()
    expect(container.querySelectorAll('.inv-section').length).toBeGreaterThan(0) // ryhmittely säilyy
  })
})
