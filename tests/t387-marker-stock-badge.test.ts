// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderInventory } from '../src/ui/inventory-page'
import { computeMarkerStock } from '../src/logic/marker-stock'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

// T387/V276 — Taso 2: badge vain merkki-rivillä, tarvikkeella ⊥ karttavastinetta.

const LOCATIONS: InventoryLocation[] = [{ id: 'karry', name: 'Kärry', sortOrder: 0 }]

function item(over: Partial<InventoryItem> & { id: string; name: string }): InventoryItem {
  return { qty: 1, unit: null, location: null, note: null, locationId: 'karry', templateId: null, ...over }
}

const TEMPLATES = new Map<string, SignTemplate>([
  ['peikko-1', { id: 'peikko-1', label: 'Peikko', color: '#10b981', favorite: false } as SignTemplate],
])

const CB = { onSelectLocation: () => {}, onAddLocation: () => true, onAddItem: () => true, onEditItem: () => true, onDeleteItem: () => {} }

let host: HTMLElement

function render(items: InventoryItem[], markers: Array<{ templateId?: string | null; status?: InventoryMarkerStatus }>): void {
  renderInventory(
    host,
    {
      locations: LOCATIONS,
      items,
      selectedLocationId: 'karry',
      templates: TEMPLATES,
      viewMode: 'read',
      markerStock: computeMarkerStock(items, markers),
    },
    CB,
  )
}
type InventoryMarkerStatus = 'suunniteltu' | 'asetettu' | 'tarkistettu' | 'kerätty' | 'ei_tarpeen'

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.appendChild(host)
})

describe('T387 — "kartalla N" -badge', () => {
  it('näkyy merkki-rivillä oikealla luvulla', () => {
    render(
      [item({ id: 'a', name: 'Peikko', templateId: 'peikko-1', qty: 6 })],
      [{ templateId: 'peikko-1', status: 'asetettu' }, { templateId: 'peikko-1', status: 'tarkistettu' }],
    )
    expect(host.querySelector('.inv-card-stock')?.textContent).toBe('kartalla 2')
  })

  it('⊥ näy tarvikerivillä (ei templateId:tä)', () => {
    render([item({ id: 'b', name: 'Taittopöytä' })], [])
    expect(host.querySelector('.inv-card-stock')).toBeNull()
  })

  it('kerätty merkki ⊥ näy kartalla-luvussa', () => {
    render(
      [item({ id: 'a', name: 'Peikko', templateId: 'peikko-1' })],
      [{ templateId: 'peikko-1', status: 'kerätty' }],
    )
    expect(host.querySelector('.inv-card-stock')?.textContent).toBe('kartalla 0')
  })

  it('markerStock puuttuu kokonaan (marker-haku kaatui) → "kartalla 0", ⊥ kaadu', () => {
    renderInventory(
      host,
      { locations: LOCATIONS, items: [item({ id: 'a', name: 'Peikko', templateId: 'peikko-1' })], selectedLocationId: 'karry', templates: TEMPLATES, viewMode: 'read' },
      CB,
    )
    expect(host.querySelector('.inv-card-stock')?.textContent).toBe('kartalla 0')
  })
})
