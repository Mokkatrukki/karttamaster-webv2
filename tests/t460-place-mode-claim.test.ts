// @vitest-environment jsdom
//
// T460/V345 — varaus elää TÄSMÄLLEEN virityksen ajan. Varaus joka jää voimaan veisi jokaisen
// myöhemmän merkkiklikin sijoitukseen jota ⊥ enää ole (B192:n peilikuva).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlaceMode } from '../src/ui/place-mode'
import { createMapModeState } from '../src/logic/map-mode'
import { mapClickClaimed, deliverMapClick, resetMapClicks } from '../src/logic/map-click'

function placeMode(): PlaceMode {
  document.body.innerHTML = '<div id="map"></div><div id="floating-picker"></div>'
  return new PlaceMode({ add: vi.fn() } as never, new Map(), createMapModeState('muokkaus'))
}

beforeEach(() => {
  resetMapClicks()
  document.body.innerHTML = ''
})

describe('T460/V345 — PlaceMode varaa & vapauttaa kartan napautukset', () => {
  it('viritys varaa; kerroksen luovuttama klikki päätyy sijoitukseen', () => {
    const pm = placeMode()
    const fn = vi.fn()
    pm.armPlacer(fn)
    expect(mapClickClaimed()).toBe(true)
    expect(deliverMapClick(65.6, 27.5)).toBe(true)
    expect(fn).toHaveBeenCalledWith(65.6, 27.5)
  })

  it('sijoitus vapauttaa varauksen — kerrokset saavat klikkinsä takaisin', () => {
    const pm = placeMode()
    pm.armPlacer(vi.fn())
    pm.placeArmedAt(65.6, 27.5)
    expect(mapClickClaimed()).toBe(false)
  })

  it('peruutus vapauttaa myös', () => {
    const pm = placeMode()
    pm.armPlacer(vi.fn())
    pm.disarm()
    expect(mapClickClaimed()).toBe(false)
  })

  it('merkkikirjaston malli varaa samoin (sama ansa, sama sääntö)', () => {
    const pm = placeMode()
    pm.armFromSidebar({ id: 't1', label: 'Nuoli', color: '#000', favorite: true } as never)
    expect(mapClickClaimed()).toBe(true)
    pm.disarm()
    expect(mapClickClaimed()).toBe(false)
  })

  it('katselutila ⊥ viritä ∴ ⊥ varaa (V218-portti pätee tähänkin)', () => {
    document.body.innerHTML = '<div id="map"></div><div id="floating-picker"></div>'
    const pm = new PlaceMode({ add: vi.fn() } as never, new Map(), createMapModeState('katselu'))
    pm.armPlacer(vi.fn())
    expect(mapClickClaimed()).toBe(false)
  })
})
