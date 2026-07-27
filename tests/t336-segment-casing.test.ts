import { describe, it, expect } from 'vitest'
import {
  segmentLayerStyles, CASING_WEIGHT, SEPARATOR_WEIGHT, CORE_WEIGHT, SEPARATOR_COLOR,
} from '../src/logic/segment-style'
import { ROUTE_DEFS } from '../src/logic/route-defs'
import { SEGMENT_COLORS } from '../src/logic/segments'
import { contrastRatio } from './helpers/contrast'

// T336/V244/B137: pätkä piirtyy reitin PÄÄLLE ∴ yksi viiva kantaisi vain toisen tiedon.
// Casing erottaa ne geometrialla: reuna = pätkä, sisus = reitti, väliin valkoinen erotin.

const BASE = { opacity: 0.9, weight: 11 }
const DASHED = { opacity: 0.85, weight: 11, dashArray: '10 8' }

describe('T336/V244: casing-kerrokset', () => {
  it('reitillinen + korostettu pätkä → kolme kerrosta piirtojärjestyksessä', () => {
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: '#1D8CB4', base: BASE, interactive: true })
    expect(layers.map(l => l.role)).toEqual(['casing', 'separator', 'core'])
    expect(layers.map(l => l.weight)).toEqual([CASING_WEIGHT, SEPARATOR_WEIGHT, CORE_WEIGHT])
    // Näkyvä leveys per puoli = (ulompi − sisempi)/2: pätkäreuna 2px, valkoinen halo 1px.
    // Halo on ohut TARKOITUKSELLA — se on erotin, ⊥ oma kanava: liian paksuna se lukisi
    // valkoisena viivana kartalla & söisi molempien värien pinta-alaa.
    expect((CASING_WEIGHT - SEPARATOR_WEIGHT) / 2).toBe(2)
    expect((SEPARATOR_WEIGHT - CORE_WEIGHT) / 2).toBe(1)
  })

  it('reuna kertoo pätkän, sisus reitin — värit ⊥ mene ristiin', () => {
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: '#1D8CB4', base: BASE, interactive: true })
    expect(layers[0].color).toBe('#552070')
    expect(layers[1].color).toBe(SEPARATOR_COLOR)
    expect(layers[2].color).toBe('#1D8CB4')
  })

  it('statuskieli elää CASINGISSA — sisus pysyy ehjänä', () => {
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: '#1D8CB4', base: DASHED, interactive: true })
    expect(layers[0].dashArray).toBe('10 8')
    // Katkoviivainen sisus paljastaisi pohjakartan keskeltä viivaa ja hajottaisi koko kuvion.
    expect(layers[2].dashArray).toBeUndefined()
  })

  it('VAIN casing ottaa klikin — kolme kerrosta ⊥ saa olla kolme kuuntelijaa', () => {
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: '#1D8CB4', base: BASE, interactive: true })
    expect(layers.filter(l => l.interactive).length).toBe(1)
    expect(layers.find(l => l.interactive)!.role).toBe('casing')
  })

  it('reititön tehtävä (V139) → yksi viiva, ⊥ kaadu puuttuvaan reittiväriin', () => {
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: undefined, base: BASE, interactive: true })
    expect(layers).toHaveLength(1)
    expect(layers[0].weight).toBe(BASE.weight)
    expect(layers[0].interactive).toBe(true)
  })

  it('V142: himmennetty konteksti-pätkä → yksi viiva, ⊥ casingia (korostuksen kieltä ⊥ anneta taustalle)', () => {
    const dim = { opacity: 0.22, weight: 7, dashArray: '10 8' }
    const layers = segmentLayerStyles({ segmentColor: '#552070', routeColor: '#1D8CB4', base: dim, interactive: false })
    expect(layers).toHaveLength(1)
    expect(layers[0].opacity).toBe(0.22)
    expect(layers[0].interactive).toBe(false)
  })
})

describe('T336/V244-amend/B137: erotin tekee kontrastiehdosta täytettävän', () => {
  it('EI-korjattu maailma: pätkä- & reittivärien suora kontrasti EI yllä 3:1:een kaikilla pareilla', () => {
    // Tämä testi dokumentoi B137:n juurisyyn — jos joku poistaa erottimen "turhana",
    // tämä kertoo miksi se oli siellä. Ehto oli ylimääritelty, ei paletti huono.
    const worst = Math.min(...SEGMENT_COLORS.flatMap(s => ROUTE_DEFS.map(r => contrastRatio(s, r.color))))
    expect(worst).toBeLessThan(3)
  })

  it('KORJATTU: kumpikin väri saa ≥3:1 valkoista erotinta vasten', () => {
    for (const s of SEGMENT_COLORS) {
      expect(contrastRatio(s, SEPARATOR_COLOR), `pätkäväri ${s}`).toBeGreaterThanOrEqual(3)
    }
    for (const r of ROUTE_DEFS) {
      expect(contrastRatio(r.color, SEPARATOR_COLOR), `reittiväri ${r.id}`).toBeGreaterThanOrEqual(3)
    }
  })
})
