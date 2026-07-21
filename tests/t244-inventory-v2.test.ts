import { describe, it, expect } from 'vitest'
import { validateInventoryItem, resolveItemName, adjustQty } from '../src/logic/inventory'

describe('T244 validateInventoryItem — V161 ehdollinen name', () => {
  it('tarvike (ei templateId) ilman namea → name_required', () => {
    expect(validateInventoryItem({ qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })

  it('merkki (templateId) ilman namea → ok', () => {
    const r = validateInventoryItem({ templateId: 'tpl-1', qty: 3 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.templateId).toBe('tpl-1')
      expect(r.value.qty).toBe(3)
    }
  })

  it('merkki + qty edelleen V162-validoitu (neg → invalid_qty)', () => {
    expect(validateInventoryItem({ templateId: 'tpl-1', qty: -1 })).toEqual({ ok: false, error: 'invalid_qty' })
  })

  it('normalisoi locationId', () => {
    const r = validateInventoryItem({ name: 'kepit', qty: 1, locationId: 'loc-1' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.locationId).toBe('loc-1')
  })

  it('tyhjä locationId → null', () => {
    const r = validateInventoryItem({ name: 'kepit', qty: 1, locationId: '  ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.locationId).toBeNull()
  })
})

describe('T244 resolveItemName — V165', () => {
  const templates = new Map([['tpl-1', { label: 'Alueella pyöräkilpailu' }]])

  it('merkki linkillä → elävä template.label', () => {
    expect(resolveItemName({ name: 'vanha snapshot', templateId: 'tpl-1' }, templates)).toBe('Alueella pyöräkilpailu')
  })

  it('merkki jonka template poistettu → fallback item.name (snapshot)', () => {
    expect(resolveItemName({ name: 'Kyltti-snapshot', templateId: 'poistettu' }, templates)).toBe('Kyltti-snapshot')
  })

  it('merkki jonka template + snapshot poissa → (poistettu merkki)', () => {
    expect(resolveItemName({ name: null, templateId: 'poistettu' }, templates)).toBe('(poistettu merkki)')
  })

  it('tarvike (ei templateId) → item.name', () => {
    expect(resolveItemName({ name: 'kepit', templateId: null }, templates)).toBe('kepit')
  })

  it('tarvike ilman templateId-kenttää → item.name', () => {
    expect(resolveItemName({ name: 'nauha' }, templates)).toBe('nauha')
  })
})

describe('T244 adjustQty — stepper-clamp V162', () => {
  it('kasvatus', () => {
    expect(adjustQty(5, 1)).toBe(6)
  })

  it('vähennys', () => {
    expect(adjustQty(5, -1)).toBe(4)
  })

  it('ei mene negatiiviseksi (clamp 0)', () => {
    expect(adjustQty(0, -1)).toBe(0)
    expect(adjustQty(2, -5)).toBe(0)
  })
})
