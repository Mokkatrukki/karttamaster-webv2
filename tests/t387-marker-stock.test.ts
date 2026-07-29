import { describe, it, expect } from 'vitest'
import { computeMarkerStock } from '../src/logic/marker-stock'

// T387/V276 — Taso 1 Vitest-pure. Liitos on AINA template_id, ⊥ nimivertailu.
// Status ratkaisee ämpärin: kerätty merkki on takaisin varastossa.

describe('T387 — computeMarkerStock', () => {
  it('kartalla/varastossa-jako per template_id', () => {
    const stock = computeMarkerStock(
      [{ templateId: 'a', qty: 10 }, { templateId: 'b', qty: 2 }],
      [{ templateId: 'a', status: 'asetettu' }, { templateId: 'a', status: 'asetettu' }],
    )
    expect(stock.get('a')).toEqual({ kartalla: 2, varastossa: 10 })
    expect(stock.get('b')).toEqual({ kartalla: 0, varastossa: 2 })
  })

  it('varastossa summaa qty:n useasta rivistä (sama merkki eri paikoissa)', () => {
    const stock = computeMarkerStock(
      [{ templateId: 'a', qty: 10 }, { templateId: 'a', qty: 5 }],
      [],
    )
    expect(stock.get('a')?.varastossa).toBe(15)
  })

  it('status-ämpärit: kerätty & ei_tarpeen ⊥ ole kartalla', () => {
    const stock = computeMarkerStock(
      [],
      [
        { templateId: 'a', status: 'suunniteltu' },
        { templateId: 'a', status: 'asetettu' },
        { templateId: 'a', status: 'tarkistettu' },
        { templateId: 'a', status: 'kerätty' }, // takaisin varastossa
        { templateId: 'a', status: 'ei_tarpeen' }, // ⊥ koskaan maastossa
      ],
    )
    expect(stock.get('a')?.kartalla).toBe(3)
  })

  it('linkittämätön item ⊥ tuota laskuria (⊥ nimivertailua, V276)', () => {
    const stock = computeMarkerStock(
      [{ templateId: null, qty: 7 }, { qty: 3 }],
      [{ templateId: null, status: 'asetettu' }, { status: 'asetettu' }],
    )
    expect(stock.size).toBe(0)
  })

  it('tuntematon template_id ⊥ kaada — syntyy oma merkintä', () => {
    const stock = computeMarkerStock([], [{ templateId: 'poistettu', status: 'asetettu' }])
    expect(stock.get('poistettu')).toEqual({ kartalla: 1, varastossa: 0 })
  })

  it('tyhjä markers-lista → vain varastoluvut', () => {
    const stock = computeMarkerStock([{ templateId: 'a', qty: 4 }], [])
    expect(stock.get('a')).toEqual({ kartalla: 0, varastossa: 4 })
  })

  it('tyhjät syötteet → tyhjä Map', () => {
    expect(computeMarkerStock([], []).size).toBe(0)
  })

  it('status puuttuu → lasketaan kartalle (vain kerätty/ei_tarpeen rajaavat)', () => {
    const stock = computeMarkerStock([], [{ templateId: 'a' }])
    expect(stock.get('a')?.kartalla).toBe(1)
  })
})
