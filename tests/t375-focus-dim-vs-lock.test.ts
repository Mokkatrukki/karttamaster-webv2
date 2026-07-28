// @vitest-environment jsdom
// (T342/V248: `segment-overlay.ts` importtaa Leafletin joka koskee `window`ia moduulitasolla —
// tyylipäätökset itsessään ovat puhtaita, mutta import-ketju vaatii DOM:in.)
import { describe, it, expect } from 'vitest'
import { contextSegmentStyle, segmentLabelOptions, CONTEXT_DIM_OPACITY } from '../src/map/segment-overlay'
import { segmentLayerStyles } from '../src/logic/segment-style'

// T375/V270/B158: fokus-HIMMENNYS & interaktioLUKKO ovat ERI kanavia.
// Talkoolainen saa molemmat (V142/V93/V150 — vieras pätkä ⊥ ole hänen muokattavissaan),
// järjestäjä vain himmennyksen (korostus on lukemisen apu, hän omistaa kaiken).
// Ennen tätä molemmat asuivat yhdessä boolissa ∴ järjestäjän korostus ⊥ voinut himmentää
// pätkäviivoja lainkaan — se olisi samalla lukinnut ne klikkaamattomiksi.
// Taso 1 Vitest-pure.

const base = { opacity: 0.9, weight: 11, dashArray: '10 8' }

describe('T375/V270 — himmennys ⊥ lukko (contextSegmentStyle)', () => {
  it('talkoolainen (locked=true, oletus): vieras pätkä himmeä JA lukittu', () => {
    const style = contextSegmentStyle(base, 'own', 'other')
    expect(style.dimmed).toBe(true)
    expect(style.interactive).toBe(false)
    expect(style.opacity).toBe(CONTEXT_DIM_OPACITY)
  })

  it('järjestäjä (locked=false): vieras pätkä himmeä MUTTA klikattava', () => {
    const style = contextSegmentStyle(base, 'focused', 'other', false)
    expect(style.dimmed).toBe(true)
    expect(style.interactive).toBe(true)          // B158: tämä oli aiemmin mahdotonta
    expect(style.opacity).toBe(CONTEXT_DIM_OPACITY)
    expect(style.weight).toBe(base.weight - 4)
  })

  it('korostettu (oma/fokusoitu) pätkä säilyy kirkkaana & klikattavana molemmilla lukoilla', () => {
    for (const locked of [true, false]) {
      const style = contextSegmentStyle(base, 'own', 'own', locked)
      expect(style.dimmed).toBe(false)
      expect(style.interactive).toBe(true)
      expect(style.opacity).toBe(base.opacity)
    }
  })

  it('ei fokusta (contextOwnId undefined) → mikään ⊥ himmene, lukolla ⊥ vaikutusta', () => {
    for (const locked of [true, false]) {
      const style = contextSegmentStyle(base, undefined, 'any', locked)
      expect(style.dimmed).toBe(false)
      expect(style.interactive).toBe(true)
    }
  })
})

describe('T375/V270 — casing seuraa korostusta, klikki omistajuutta', () => {
  it('järjestäjän himmennetty pätkä: yksi viiva (⊥ casingia) mutta interactive', () => {
    const style = contextSegmentStyle(base, 'focused', 'other', false)
    const layers = segmentLayerStyles({
      segmentColor: '#552070', routeColor: '#1D8CB4',
      base: { opacity: style.opacity, weight: style.weight, dashArray: style.dashArray },
      highlighted: !style.dimmed,
      interactive: style.interactive,
    })
    expect(layers).toHaveLength(1)                 // korostuksen kieltä ⊥ anneta taustalle
    expect(layers[0].interactive).toBe(true)       // ...mutta klikki menee läpi
  })

  it('talkoolaisen himmennetty pätkä: yksi viiva JA ⊥ klikattava', () => {
    const style = contextSegmentStyle(base, 'own', 'other')
    const layers = segmentLayerStyles({
      segmentColor: '#552070', routeColor: '#1D8CB4',
      base: { opacity: style.opacity, weight: style.weight, dashArray: style.dashArray },
      highlighted: !style.dimmed,
      interactive: style.interactive,
    })
    expect(layers).toHaveLength(1)
    expect(layers[0].interactive).toBe(false)
  })

  it('fokusoitu pätkä saa täyden casing-kolmikon', () => {
    const style = contextSegmentStyle(base, 'own', 'own', false)
    const layers = segmentLayerStyles({
      segmentColor: '#552070', routeColor: '#1D8CB4',
      base: { opacity: style.opacity, weight: style.weight, dashArray: style.dashArray },
      highlighted: !style.dimmed,
      interactive: style.interactive,
    })
    expect(layers.map(l => l.role)).toEqual(['casing', 'separator', 'core'])
  })
})

describe('T375/V270 — nimilappu himmenee ilman lukkoa', () => {
  it('järjestäjän himmennetty lappu: --dim JA interactive', () => {
    const opts = segmentLabelOptions(true, false, true)
    expect(opts.className).toContain('segment-label--dim')
    expect(opts.interactive).toBe(true)
  })

  it('talkoolaisen himmennetty lappu: --dim JA ⊥ interactive', () => {
    const opts = segmentLabelOptions(false, false, true)
    expect(opts.className).toContain('segment-label--dim')
    expect(opts.interactive).toBe(false)
  })

  it('oletus (dimmed puuttuu) seuraa interactivea — vanha kaksoismerkitys säilyy kutsupaikoille', () => {
    expect(segmentLabelOptions(true).className).toBe('segment-label')
    expect(segmentLabelOptions(false).className).toContain('segment-label--dim')
  })

  it('korostettu valmis-lappu: ✓-luokka säilyy himmennyksen rinnalla (eri kanava, V96)', () => {
    expect(segmentLabelOptions(true, true, true).className).toBe('segment-label segment-label--dim segment-label--done')
  })
})
