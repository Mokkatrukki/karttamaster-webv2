import { describe, it, expect } from 'vitest'
import { describeUndo, type UndoAction } from '../src/logic/inventory-undo'
import type { InventoryItem } from '../src/logic/inventory'

const item = (over: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'i1',
  name: 'Nitoja',
  qty: 3,
  unit: null,
  location: null,
  note: null,
  locationId: null,
  templateId: null,
  ...over,
})

const templates = new Map<string, { label: string; keppi?: boolean }>([
  ['t1', { label: '20km kyltti', keppi: true }],
])

describe('describeUndo — toast-teksti per kind (T252, V172)', () => {
  it('delete-item → "Poistit: <nimi>"', () => {
    expect(describeUndo({ kind: 'delete-item', item: item() }, templates)).toBe('Poistit: Nitoja')
  })

  it('qty → "Muutit määrää: <nimi>"', () => {
    expect(describeUndo({ kind: 'qty', item: item() }, templates)).toBe('Muutit määrää: Nitoja')
  })

  it('move → "Siirsit: <nimi>"', () => {
    expect(describeUndo({ kind: 'move', item: item() }, templates)).toBe('Siirsit: Nitoja')
  })

  it('delete-location → "Poistit paikan: <nimi>"', () => {
    const a: UndoAction = { kind: 'delete-location', locationName: 'Varasto', affectedItemIds: ['i1', 'i2'] }
    expect(describeUndo(a, templates)).toBe('Poistit paikan: Varasto')
  })

  it('merkkirivi → elävä template.label (resolveItemName-henki, V165)', () => {
    const a: UndoAction = { kind: 'delete-item', item: item({ name: 'vanha snapshot', templateId: 't1' }) }
    expect(describeUndo(a, templates)).toBe('Poistit: 20km kyltti')
  })

  it('poistettu merkki → fallback (V165)', () => {
    const a: UndoAction = { kind: 'qty', item: item({ name: null, templateId: 'gone' }) }
    expect(describeUndo(a, templates)).toBe('Muutit määrää: (poistettu merkki)')
  })
})
