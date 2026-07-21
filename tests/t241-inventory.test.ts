import { describe, it, expect } from 'vitest'
import { validateInventoryItem, buildInventoryItem } from '../src/logic/inventory'

describe('T241 validateInventoryItem — V161 name pakko', () => {
  it('tyhjä name → ei ok', () => {
    expect(validateInventoryItem({ name: '', qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })

  it('pelkkä whitespace name → ei ok', () => {
    expect(validateInventoryItem({ name: '   ', qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })

  it('puuttuva name → ei ok', () => {
    expect(validateInventoryItem({ qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })

  it('ei-string name (number) → ei ok', () => {
    expect(validateInventoryItem({ name: 5 as unknown, qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })

  it('name trimmataan', () => {
    const r = validateInventoryItem({ name: '  Nitoja  ', qty: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.name).toBe('Nitoja')
  })
})

describe('T241 validateInventoryItem — V162 qty äärellinen >= 0', () => {
  it('qty=0 ok', () => {
    const r = validateInventoryItem({ name: 'nauha', qty: 0 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.qty).toBe(0)
  })

  it('qty puuttuu → default 0', () => {
    const r = validateInventoryItem({ name: 'nauha' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.qty).toBe(0)
  })

  it('qty null → default 0', () => {
    const r = validateInventoryItem({ name: 'nauha', qty: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.qty).toBe(0)
  })

  it('negatiivinen qty → ei ok', () => {
    expect(validateInventoryItem({ name: 'kepit', qty: -1 })).toEqual({ ok: false, error: 'invalid_qty' })
  })

  it('string "5" (coercion-reikä) → ei ok', () => {
    expect(validateInventoryItem({ name: 'kepit', qty: '5' })).toEqual({ ok: false, error: 'invalid_qty' })
  })

  it('NaN → ei ok', () => {
    expect(validateInventoryItem({ name: 'kepit', qty: NaN })).toEqual({ ok: false, error: 'invalid_qty' })
  })

  it('Infinity → ei ok', () => {
    expect(validateInventoryItem({ name: 'kepit', qty: Infinity })).toEqual({ ok: false, error: 'invalid_qty' })
  })
})

describe('T241 validateInventoryItem — valinnaiset kentät', () => {
  it('unit/location/note puuttuu → null', () => {
    const r = validateInventoryItem({ name: 'teltta', qty: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ unit: null, location: null, note: null })
  })

  it('unit/location/note tyhjä string → null', () => {
    const r = validateInventoryItem({ name: 'teltta', qty: 1, unit: '  ', location: '', note: '   ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ unit: null, location: null, note: null })
  })

  it('unit/location/note trimmataan', () => {
    const r = validateInventoryItem({ name: 'nauha', qty: 5, unit: ' rullaa ', location: ' kärry ', note: ' iso ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ unit: 'rullaa', location: 'kärry', note: 'iso' })
  })
})

describe('T241 buildInventoryItem — id genId:stä (T238)', () => {
  it('validi syöte → item id:llä', () => {
    const r = buildInventoryItem({ name: 'Nitoja', qty: 2, unit: 'kpl' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(typeof r.item.id).toBe('string')
      expect(r.item.id.length).toBeGreaterThan(0)
      expect(r.item).toMatchObject({ name: 'Nitoja', qty: 2, unit: 'kpl' })
    }
  })

  it('kaksi kutsua → eri id', () => {
    const a = buildInventoryItem({ name: 'x', qty: 1 })
    const b = buildInventoryItem({ name: 'x', qty: 1 })
    if (a.ok && b.ok) expect(a.item.id).not.toBe(b.item.id)
  })

  it('epävalidi syöte → error, ei itemiä', () => {
    expect(buildInventoryItem({ name: '', qty: 1 })).toEqual({ ok: false, error: 'name_required' })
  })
})
