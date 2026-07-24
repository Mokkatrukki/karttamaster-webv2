import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BASEMAP_OPACITY_LS_KEY,
  DEFAULT_OPACITY,
  clampOpacity,
  loadOpacity,
  saveOpacity,
  sliderToOpacity,
  opacityToSlider,
} from '../src/logic/basemap-dim'

// localStorage-mock (CLAUDE.md: natiivi localStorage konfliktoi Node v26:ssa → vi.stubGlobal)
function mockStore(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    _store: store,
  }
}

describe('T287 — pohjakartan näkyvyys (basemap opacity)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStore())
  })

  describe('clampOpacity', () => {
    it('clamps alle 0 → 0 (kartta häviää)', () => expect(clampOpacity(-1)).toBe(0))
    it('clamps yli 1 → 1 (koko kartta)', () => expect(clampOpacity(2)).toBe(1))
    it('säilyttää välissä olevan', () => expect(clampOpacity(0.5)).toBe(0.5))
    it('NaN → DEFAULT_OPACITY (koko kartta)', () => expect(clampOpacity(NaN)).toBe(DEFAULT_OPACITY))
    it('Infinity → DEFAULT_OPACITY', () => expect(clampOpacity(Infinity)).toBe(DEFAULT_OPACITY))
  })

  describe('loadOpacity', () => {
    it('tyhjä store → default 100 % (koko kartta)', () => {
      expect(loadOpacity(mockStore())).toBe(DEFAULT_OPACITY)
    })
    it('roskadata → default', () => {
      expect(loadOpacity(mockStore({ [BASEMAP_OPACITY_LS_KEY]: 'abc' }))).toBe(DEFAULT_OPACITY)
    })
    it('yli-arvo clampataan 1:een', () => {
      expect(loadOpacity(mockStore({ [BASEMAP_OPACITY_LS_KEY]: '5' }))).toBe(1)
    })
    it('0 = pohja piilossa säilyy', () => {
      expect(loadOpacity(mockStore({ [BASEMAP_OPACITY_LS_KEY]: '0' }))).toBe(0)
    })
    it('lukee tallennetun', () => {
      expect(loadOpacity(mockStore({ [BASEMAP_OPACITY_LS_KEY]: '0.5' }))).toBeCloseTo(0.5)
    })
  })

  describe('saveOpacity → loadOpacity round-trip', () => {
    it('tallennettu arvo palautuu clampattuna', () => {
      const s = mockStore()
      expect(saveOpacity(0.5, s)).toBe(0.5)
      expect(s.setItem).toHaveBeenCalledWith(BASEMAP_OPACITY_LS_KEY, '0.5')
      expect(loadOpacity(s)).toBe(0.5)
    })
    it('0 (pohja piiloon) tallentuu', () => {
      const s = mockStore()
      expect(saveOpacity(0, s)).toBe(0)
      expect(loadOpacity(s)).toBe(0)
    })
    it('yli-arvo tallentuu clampattuna 1:ksi', () => {
      const s = mockStore()
      expect(saveOpacity(9, s)).toBe(1)
      expect(loadOpacity(s)).toBe(1)
    })
  })

  describe('sliderToOpacity / opacityToSlider', () => {
    it('0 % → opacity 0 (kartta häviää)', () => expect(sliderToOpacity(0)).toBe(0))
    it('100 % → opacity 1 (koko kartta)', () => expect(sliderToOpacity(100)).toBe(1))
    it('50 % → opacity 0.5 (kuultaa läpi)', () => expect(sliderToOpacity(50)).toBeCloseTo(0.5))
    it('clamppaa yli 100 / alle 0', () => {
      expect(sliderToOpacity(200)).toBe(1)
      expect(sliderToOpacity(-5)).toBe(0)
    })
    it('NaN → default 100 %', () => expect(sliderToOpacity(NaN)).toBe(DEFAULT_OPACITY))
    it('opacityToSlider käänteinen', () => {
      expect(opacityToSlider(0)).toBe(0)
      expect(opacityToSlider(1)).toBe(100)
      expect(opacityToSlider(0.5)).toBe(50)
    })
  })
})
