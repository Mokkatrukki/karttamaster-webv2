import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signDisplayLabel } from '../src/logic/sign-library'
import { resolveItemName } from '../src/logic/inventory'
import { renderInventory } from '../src/ui/inventory-page'
import type { InventoryView, InventoryPageCallbacks } from '../src/ui/inventory-page'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

// ── Logic (Vitest-pure) — V17x signDisplayLabel + resolveItemName (keppi RIVILLÄ) ──
describe('signDisplayLabel (V17x — keppi rivin attribuutti)', () => {
  it('keppi=true → pelkkä label', () => {
    expect(signDisplayLabel('Alueella pyöräkilpailu', true)).toBe('Alueella pyöräkilpailu')
  })
  it('keppi=false → "label - irto"', () => {
    expect(signDisplayLabel('Alueella pyöräkilpailu', false)).toBe('Alueella pyöräkilpailu - irto')
  })
  it('keppi puuttuu (undefined/null) → pelkkä label (oletus keppi)', () => {
    expect(signDisplayLabel('Oikealle')).toBe('Oikealle')
    expect(signDisplayLabel('Oikealle', null)).toBe('Oikealle')
  })

  it('resolveItemName lisää suffixin kun RIVIN keppi=false (sama malli molemmille)', () => {
    // Sama malli (yksi tunnus), suffix tulee rivin keppistä — ei mallista.
    const templates = new Map([['t1', { label: 'Oikealle' }]])
    expect(resolveItemName({ name: 'x', templateId: 't1', keppi: false }, templates)).toBe('Oikealle - irto')
    expect(resolveItemName({ name: 'x', templateId: 't1', keppi: true }, templates)).toBe('Oikealle')
    expect(resolveItemName({ name: 'x', templateId: 't1', keppi: null }, templates)).toBe('Oikealle')
  })
})

// ── UI (Vitest-jsdom) — inventaariokortti näyttää suffixin RIVIN keppistä ─────
function tpl(over: Partial<SignTemplate> = {}): SignTemplate {
  return { id: 't1', label: 'Alueella pyöräkilpailu', color: '#10b981', description: '', favorite: false, ...over }
}
function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'i1', name: 'snapshot', qty: 5, unit: null, location: null, note: null, locationId: 'l1', templateId: 't1', keppi: null, ...over }
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

describe('inventaariokortti suffix (V17x — keppi rivillä)', () => {
  it('rivin keppi=false → nimessä " - irto"', () => {
    renderInventory(container, view(new Map([['t1', tpl()]]), { items: [item({ keppi: false })] }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu - irto')
  })
  it('rivin keppi=true/null → ei suffixia', () => {
    renderInventory(container, view(new Map([['t1', tpl()]]), { items: [item({ keppi: true })] }), makeCb())
    expect(container.querySelector('.inv-card-name')!.textContent).toBe('Alueella pyöräkilpailu')
  })
})
