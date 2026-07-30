import { describe, it, expect } from 'vitest'
import { segmentLabelVisible, MIN_SEGMENT_LABEL_ZOOM } from '../src/logic/segment-visibility'

// T418/V309: pätkälappu on zoom-ehdollista sisältöä. Taso 1 (Vitest-pure) — kynnys on
// puhdas päätös, Leaflet vain soveltaa sen luokkana (`segment-overlay.ts`).
describe('T418/V309 — segmentLabelVisible', () => {
  it('kynnys on 14 (⊥ area-overlayn 16 — km-viiva ≠ piste)', () => {
    expect(MIN_SEGMENT_LABEL_ZOOM).toBe(14)
  })

  it('järjestäjän oletuszoom ~13.4 (fitBounds ∀ reitille) → lappu piilossa', () => {
    // Tämä ON koko taskin syy: 13.4:llä ∀ lappu piirtyi päällekkäin maaston yli.
    expect(segmentLabelVisible(13.4, false)).toBe(false)
  })

  it('kynnysrajat: 13 & 13.9 piilossa, 14 & 14.1 näkyvissä', () => {
    expect(segmentLabelVisible(13, false)).toBe(false)
    expect(segmentLabelVisible(13.9, false)).toBe(false)
    expect(segmentLabelVisible(14, false)).toBe(true)
    expect(segmentLabelVisible(14.1, false)).toBe(true)
  })

  it('talkoolaisen oma pätkä näkyy ∀ zoomilla — orientaatio metsässä > yleisilme', () => {
    for (const z of [0, 5, 10, 13.4, 14, 18]) {
      expect(segmentLabelVisible(z, true)).toBe(true)
    }
  })

  it('epäkelpo zoom → piilossa (hiljainen piilo > hiljainen näkyminen)', () => {
    expect(segmentLabelVisible(NaN, false)).toBe(false)
    expect(segmentLabelVisible(Infinity, false)).toBe(false)
    // isOwn voittaa myös epäkelvon zoomin: oma pätkä ⊥ katoa tuntemattomasta tilasta.
    expect(segmentLabelVisible(NaN, true)).toBe(true)
  })
})
