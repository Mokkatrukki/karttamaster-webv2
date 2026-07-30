import { describe, it, expect } from 'vitest'
import {
  segmentLabelScaleForZoom,
  markerScaleForZoom,
  SEGMENT_LABEL_SCALE_MIN,
  SEGMENT_LABEL_SCALE_MAX,
  SEGMENT_LABEL_SCALE_ZOOM_MIN,
  SEGMENT_LABEL_SCALE_ZOOM_MAX,
} from '../src/logic/marker-scale'

// T418→T419/V309: nimilappu KUTISTUU zoomin mukana kuten merkki-ikoni & ⊥ katoa milloinkaan.
// (T418:n binäärinen piilotus kumottiin käyttäjäpäätöksellä 2026-07-30 — piiloutuva nimi teki
// kartasta arvoituksen. Ongelma oli lapun KOKO kaukana, ⊥ sen olemassaolo.)
describe('T419/V309 — segmentLabelScaleForZoom', () => {
  it('lappu ⊥ katoa MILLOINKAAN — skaala on aina > 0 ∀ zoomilla', () => {
    for (const z of [0, 5, 8, 11, 12, 13.4, 14, 16, 19, 22]) {
      expect(segmentLabelScaleForZoom(z)).toBeGreaterThan(0)
    }
    expect(SEGMENT_LABEL_SCALE_MIN).toBeGreaterThan(0)
  })

  it('järjestäjän oletuszoom ~13,4 → selvästi alle täyden koon (yleisilme ⊥ hukku nimiin)', () => {
    const s = segmentLabelScaleForZoom(13.4)
    expect(s).toBeGreaterThan(SEGMENT_LABEL_SCALE_MIN)
    expect(s).toBeLessThan(0.8)
  })

  it('kaari on ei-vähenevä & päätepisteet lukittu (sama muoto kuin markerScaleForZoom)', () => {
    expect(segmentLabelScaleForZoom(SEGMENT_LABEL_SCALE_ZOOM_MIN)).toBe(SEGMENT_LABEL_SCALE_MIN)
    expect(segmentLabelScaleForZoom(SEGMENT_LABEL_SCALE_ZOOM_MIN - 3)).toBe(SEGMENT_LABEL_SCALE_MIN)
    expect(segmentLabelScaleForZoom(SEGMENT_LABEL_SCALE_ZOOM_MAX)).toBe(SEGMENT_LABEL_SCALE_MAX)
    expect(segmentLabelScaleForZoom(SEGMENT_LABEL_SCALE_ZOOM_MAX + 5)).toBe(SEGMENT_LABEL_SCALE_MAX)
    let prev = -1
    for (let z = 8; z <= 20; z += 0.5) {
      const s = segmentLabelScaleForZoom(z)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })

  it('lappu ⊥ kasva yli 1,0:n — teksti on §K-lukittua typografiaa, ⊥ kuva (merkki saa 1,2)', () => {
    expect(SEGMENT_LABEL_SCALE_MAX).toBe(1)
    expect(markerScaleForZoom(19)).toBeGreaterThan(1)
  })

  it('talkoolaisen oma pätkä on täydessä koossa ∀ zoomilla — luettavuus metsässä', () => {
    for (const z of [0, 8, 12, 13.4, 19]) {
      expect(segmentLabelScaleForZoom(z, true)).toBe(SEGMENT_LABEL_SCALE_MAX)
    }
  })

  it('epäkelpo zoom → täysi koko (näkyvä > näkymätön; NaN tappaisi calc():n)', () => {
    expect(segmentLabelScaleForZoom(NaN)).toBe(SEGMENT_LABEL_SCALE_MAX)
    expect(segmentLabelScaleForZoom(Infinity)).toBe(SEGMENT_LABEL_SCALE_MAX)
  })
})
