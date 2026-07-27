// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { segmentLabelOptions, contextSegmentStyle } from '../src/map/segment-overlay'

// T347/V250: pätkän nimilappu kartalla on klikattava sisääntulo — mutta VAIN silloin kun pätkä
// itsekin on klikattava (V142). Tooltipin `interactive` johdetaan samasta lipusta kuin polylinen
// ∴ tässä testataan että lippu EI haaraudu kahdeksi eri totuudeksi.
//
// Ympäristö: jsdom — `segment-overlay.ts` importtaa Leafletin moduulitasolla (`window`) ∴ EPÄSUORA
// DOM-riippuvuus, V248. Ei `vi.mock('leaflet')`ia: funktio on puhdas ∴ ISOLATED-lista ei kasva.

const BASE = { opacity: 0.9, weight: 11 }

describe('T347: segmentLabelOptions', () => {
  it('klikattava pätkä → tooltip interactive + kirkas luokka', () => {
    const opts = segmentLabelOptions(true)
    expect(opts.interactive).toBe(true)
    expect(opts.className).toBe('segment-label')
    expect(opts.permanent).toBe(true)
    expect(opts.direction).toBe('center')
  })

  it('himmennetty kontekstipätkä → tooltip EI interactive + --dim-luokka', () => {
    const opts = segmentLabelOptions(false)
    expect(opts.interactive).toBe(false)
    expect(opts.className).toBe('segment-label segment-label--dim')
    expect(opts.permanent).toBe(true)
  })

  it('V142: järjestäjällä (contextOwnId undefined) jokaisen pätkän lappu on klikattava', () => {
    const style = contextSegmentStyle(BASE, undefined, 's1')
    expect(segmentLabelOptions(style.interactive).interactive).toBe(true)
  })

  it('V142: talkoolaisen OMA pätkä klikattava, VIERAS ei — lappu seuraa viivaa', () => {
    const own = contextSegmentStyle(BASE, 'oma', 'oma')
    const other = contextSegmentStyle(BASE, 'oma', 'vieras')

    expect(segmentLabelOptions(own.interactive).interactive).toBe(true)
    expect(segmentLabelOptions(other.interactive).interactive).toBe(false)
    // Vieraan lapun ⊥ saa VAIN olla ei-interaktiivinen vaan myös näyttää siltä (CSS pointer-events).
    expect(segmentLabelOptions(other.interactive).className).toContain('segment-label--dim')
  })
})
