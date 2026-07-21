import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signDisplayLabel } from '../src/logic/sign-library'
import { resolveItemName } from '../src/logic/inventory'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

// ── Logic (Vitest-pure) — V186: kiinnitystapa POISTETTU, signDisplayLabel = pelkkä label ──
describe('signDisplayLabel (V186 — ei kiinnitystapaa)', () => {
  it('palauttaa AINA raakalabelin (ei irto-suffixia)', () => {
    expect(signDisplayLabel('Alueella pyöräkilpailu')).toBe('Alueella pyöräkilpailu')
    expect(signDisplayLabel('Oikealle')).toBe('Oikealle')
  })

  it('resolveItemName = elävä template.label ilman suffixia', () => {
    const templates = new Map([['t1', { label: 'Oikealle' }]])
    expect(resolveItemName({ name: 'x', templateId: 't1' }, templates)).toBe('Oikealle')
  })
  it('resolveItemName template puuttuu → fallback item.name', () => {
    expect(resolveItemName({ name: 'snapshot', templateId: 't1' }, new Map())).toBe('snapshot')
  })
})

// ── UI (Vitest-jsdom) — V186: merkkirivi näyttää pelkän labelin, EI keppi-checkboxia ─────
function tpl(over: Partial<SignTemplate> = {}): SignTemplate {
  return { id: 't1', label: 'Alueella pyöräkilpailu', color: '#10b981', description: '', favorite: false, ...over }
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

describe('inventaariokortti (V186 — pelkkä label, ei kiinnitystapaa)', () => {
  it('merkkirivi näyttää pelkän labelin', () => {
    renderInventory(container, view(new Map([['t1', tpl()]]), { items: [item()] }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu')
  })
  it('merkkirivin Tiedoissa EI keppi-checkboxia', () => {
    renderInventory(container, view(new Map([['t1', tpl()]]), { items: [item()] }), makeCb())
    expect(container.querySelector('.inv-field-keppi')).toBeNull()
    expect(container.querySelector('.inv-d-keppi')).toBeNull()
  })
})
