// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { LINE_STATE_STYLE, segmentLabelOptions, contextSegmentStyle } from '../src/map/segment-overlay'
import { SEGMENT_DONE_COLOR } from '../src/logic/segment-color'
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

  // UX-audit 2026-07-27: luettavuus ⊥ ole vain kuvio- vaan myös ALFAKYSYMYS. `ei_alkanut` @ .4
  // antoi efektiiviseksi kontrastiksi 1.79:1 vaaleaa MML-taustaa vasten ∴ oikea kuvio näkymättä.
  it('jokaisen tilan EFEKTIIVINEN kontrasti vaaleaa karttaa vasten ≥ 3:1 (V252, WCAG non-text)', () => {
    const BASEMAP = '#F2F0EA'
    const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
    const relLum = (h: string) => {
      const [r, g, b] = rgb(h).map(v => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const over = (fg: string, bg: string, a: number) => {
      const [f, b2] = [rgb(fg), rgb(bg)]
      return '#' + f.map((v, i) => Math.round(v * a + b2[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
    }
    const contrast = (a: string, b: string) => {
      const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    // Pahin tapaus per tila: tummin pätkäväri sekoitettuna tilan alfalla taustakarttaan.
    const worstColor = { valmis: SEGMENT_DONE_COLOR, kesken: '#B5476B', ei_alkanut: '#7A4E9C' }
    for (const state of STATES) {
      const eff = over(worstColor[state], BASEMAP, LINE_STATE_STYLE[state].opacity)
      expect(contrast(eff, BASEMAP), `${state} liian haalea kirkkaassa`).toBeGreaterThanOrEqual(3)
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
