import { describe, it, expect } from 'vitest'
import { contextSegmentStyle, CONTEXT_DIM_OPACITY } from '../src/map/segment-overlay'

// T218/V142: talkoolaisen näkymässä oma tehtävä kirkas + klikattava, muut himmeä + read-only.
// contextSegmentStyle on overlayn puhdas tyylipäätös — Leaflet vain soveltaa. Testataan täällä.

const base = { opacity: 0.9, weight: 11, dashArray: '1 9' }

describe('T218/V142: contextSegmentStyle', () => {
  it('järjestäjä (contextOwnId undefined) → kaikki kirkkaita + interactive, tyyli ennallaan', () => {
    const style = contextSegmentStyle(base, undefined, 'any-seg')
    expect(style).toEqual({ ...base, interactive: true })
  })

  it('oma pätkä (id täsmää) → interactive + täysi tyyli säilyy', () => {
    const style = contextSegmentStyle(base, 'own', 'own')
    expect(style.interactive).toBe(true)
    expect(style.opacity).toBe(base.opacity)
    expect(style.weight).toBe(base.weight)
    expect(style.dashArray).toBe(base.dashArray)
  })

  it('muu pätkä → himmennetty + non-interactive', () => {
    const style = contextSegmentStyle(base, 'own', 'other')
    expect(style.interactive).toBe(false)
    expect(style.opacity).toBe(CONTEXT_DIM_OPACITY)   // min(0.9, 0.22)
    expect(style.weight).toBe(base.weight - 4)         // ohuempi
    expect(style.dashArray).toBe(base.dashArray)       // katko säilyy statuskoodauksena
  })

  it('himmennys ei koskaan kirkasta jo-haaleaa (min-opacity)', () => {
    const faint = { opacity: 0.1, weight: 9 }
    const style = contextSegmentStyle(faint, 'own', 'other')
    expect(style.opacity).toBe(0.1)                    // min(0.1, 0.22) → 0.1
  })

  it('himmennetty viiva ei mene alle minimipaksuuden (weight floor 5)', () => {
    const thin = { opacity: 0.9, weight: 6 }
    const style = contextSegmentStyle(thin, 'own', 'other')
    expect(style.weight).toBe(5)                       // max(6-4, 5) = 5
  })
})
