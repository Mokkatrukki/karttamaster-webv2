import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signDisplayLabel } from '../src/logic/sign-library'
import { resolveItemName } from '../src/logic/inventory'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

// ── Logic (Vitest-pure) — V168 signDisplayLabel + resolveItemName ────────────
describe('T249 signDisplayLabel (V168)', () => {
  it('keppi=true → pelkkä label', () => {
    expect(signDisplayLabel({ label: 'Alueella pyöräkilpailu', keppi: true })).toBe('Alueella pyöräkilpailu')
  })
  it('keppi=false → "label - irto"', () => {
    expect(signDisplayLabel({ label: 'Alueella pyöräkilpailu', keppi: false })).toBe('Alueella pyöräkilpailu - irto')
  })
  it('keppi puuttuu (undefined) → pelkkä label (oletus keppi)', () => {
    expect(signDisplayLabel({ label: 'Oikealle' })).toBe('Oikealle')
  })

  it('resolveItemName lisää suffixin merkkirivin keppi=false', () => {
    const templates = new Map([['t1', { label: 'Oikealle', keppi: false }]])
    expect(resolveItemName({ name: 'x', templateId: 't1' }, templates)).toBe('Oikealle - irto')
    const keppi = new Map([['t2', { label: 'Oikealle', keppi: true }]])
    expect(resolveItemName({ name: 'x', templateId: 't2' }, keppi)).toBe('Oikealle')
  })
})

// ── UI (Vitest-jsdom) — inventaariokortti näyttää suffixin ───────────────────
function tpl(over: Partial<SignTemplate> = {}): SignTemplate {
  return { id: 't1', label: 'Alueella pyöräkilpailu', color: '#10b981', description: '', favorite: false, keppi: true, ...over }
}
function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'snapshot', qty: 5, unit: null, location: null, note: null, locationId: 'l1', templateId: 't1', ...over }
}
function loc(): InventoryLocation { return { id: 'l1', name: 'Kärry', sortOrder: 0 } }
function view(templates: Map<string, SignTemplate>, over: Partial<InventoryView> = {}): InventoryView {
  return { locations: [loc()], items: [item()], selectedLocationId: 'l1', templates, viewMode: 'edit', ...over }
}
function makeCb(over: Partial<InventoryPageCallbacks> = {}): InventoryPageCallbacks {
  return { onSelectLocation: vi.fn(), onAddLocation: vi.fn(() => true), onAddItem: vi.fn(() => true), onEditItem: vi.fn(() => true), onDeleteItem: vi.fn(), ...over }
}

let container: HTMLElement
beforeEach(() => { container = document.createElement('div'); document.body.innerHTML = ''; document.body.appendChild(container) })

describe('T249 inventaariokortti suffix (V168)', () => {
  it('keppi=false → nimessä " - irto"', () => {
    renderInventory(container, view(new Map([['t1', tpl({ keppi: false })]])), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu - irto')
  })
  it('keppi=true → ei suffixia', () => {
    renderInventory(container, view(new Map([['t1', tpl({ keppi: true })]])), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu')
  })
})
