// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { LINE_STATE_STYLE, segmentLabelOptions, contextSegmentStyle } from '../src/map/segment-overlay'
import type { SegmentLineState } from '../src/logic/segments'

// T348/V252/B135: kartan statuskielen ! olla luettavissa TAUSTAKARTAN PÄÄLTÄ & akromaattisesti.
// Ennen: molemmat katkotilat olivat `'1 9'` (1px viiva, 9px aukko) ∴ kuvio hajosi pistesarjaksi
// joka katosi MML-maastokartan tekstuuriin & tilat erottuivat toisistaan vain leveydellä/alfalla.
// Nämä testit tarkistavat ARVOT, ⊥ pelkkää olemassaoloa — `toBeTruthy` katkoviivalle on testi
// joka ⊥ voi failata.
//
// Ympäristö: jsdom — `segment-overlay.ts` importtaa Leafletin moduulitasolla (`window`) ∴ epäsuora
// DOM-riippuvuus, V248. Ei `vi.mock('leaflet')`ia: testattavat ovat puhtaita ∴ ISOLATED ⊥ kasva.

const STATES: SegmentLineState[] = ['valmis', 'kesken', 'ei_alkanut']

function dashParts(dashArray: string): number[] {
  return dashArray.split(/[\s,]+/).filter(Boolean).map(Number)
}

describe('T348/V252: LINE_STATE_STYLE luettavuus', () => {
  it('valmis on ehjä — positiivinen tila ⊥ katkoviivaa', () => {
    expect(LINE_STATE_STYLE.valmis.dashArray).toBeUndefined()
  })

  it('katkotilojen viivanpätkä on aukon kokoluokkaa — ⊥ pistesarja (B135)', () => {
    for (const state of ['kesken', 'ei_alkanut'] as const) {
      const [dash, gap] = dashParts(LINE_STATE_STYLE[state].dashArray!)
      expect(dash).toBeGreaterThanOrEqual(4)
      // vanha '1 9' = suhde 0.11 ∴ katosi taustakartalle. Vaadi ≥ 0.4.
      expect(dash / gap).toBeGreaterThanOrEqual(0.4)
    }
  })

  it('kolme tilaa erottuu AKROMAATTISESTI — jokainen dashArray-kuvio uniikki', () => {
    const patterns = STATES.map(s => LINE_STATE_STYLE[s].dashArray ?? 'solid')
    expect(new Set(patterns).size).toBe(STATES.length)
  })

  it('kaksi katkotilaa erottuu muutenkin kuin leveydellä', () => {
    const kesken = LINE_STATE_STYLE.kesken
    const ei = LINE_STATE_STYLE.ei_alkanut
    expect(kesken.dashArray).not.toBe(ei.dashArray)
    expect(kesken.opacity).not.toBe(ei.opacity)
  })
})

describe('T348/V96-amend: segmentLabelOptions --done', () => {
  it('valmis pätkä → --done-luokka', () => {
    expect(segmentLabelOptions(true, true).className).toBe('segment-label segment-label--done')
  })

  it('oletus on ei-valmis — vanha kutsumuoto säilyy ennallaan (T347)', () => {
    expect(segmentLabelOptions(true).className).toBe('segment-label')
    expect(segmentLabelOptions(false).className).toBe('segment-label segment-label--dim')
  })

  it('V142: --dim & --done ⊥ ole toisensa poissulkevia — vieras pätkä voi olla valmis', () => {
    const other = contextSegmentStyle(LINE_STATE_STYLE.valmis, 'oma', 'vieras')
    const opts = segmentLabelOptions(other.interactive, true)
    expect(opts.className).toContain('segment-label--dim')
    expect(opts.className).toContain('segment-label--done')
    expect(opts.interactive).toBe(false)
  })
})
