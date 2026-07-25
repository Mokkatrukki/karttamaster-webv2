import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  createMapModeState,
  toggleMapMode,
  canDragMarkers,
  canPlaceMarkers,
  canDragSegmentBounds,
  DEFAULT_MAP_MODE,
  mapMode,
  type MapMode,
} from '../src/logic/map-mode'

// T307/V218 — Taso 1 (Vitest-pure): kartan katselu-/muokkaustilan logiikka.
// Ei DOM:ia, ei Leafletia — tila + predikaatit + oletus + persistoimattomuus.

describe('T307/V218 — MapMode-predikaatit (puhtaat)', () => {
  it('katselu: mikään mutatoiva kartan ele ei ole sallittu', () => {
    expect(canDragMarkers('katselu')).toBe(false)
    expect(canPlaceMarkers('katselu')).toBe(false)
    expect(canDragSegmentBounds('katselu')).toBe(false)
  })

  it('muokkaus: kaikki kolme kartan elettä sallittu', () => {
    expect(canDragMarkers('muokkaus')).toBe(true)
    expect(canPlaceMarkers('muokkaus')).toBe(true)
    expect(canDragSegmentBounds('muokkaus')).toBe(true)
  })

  it('toggleMapMode vaihtaa suunnan molempiin suuntiin (involuutio)', () => {
    expect(toggleMapMode('katselu')).toBe('muokkaus')
    expect(toggleMapMode('muokkaus')).toBe('katselu')
    const m: MapMode = 'katselu'
    expect(toggleMapMode(toggleMapMode(m))).toBe(m)
  })
})

describe('T307/V218 — MapModeState', () => {
  it('DEFAULT on katselu (uusi tila = ei-mutatoiva)', () => {
    expect(DEFAULT_MAP_MODE).toBe('katselu')
    const state = createMapModeState()
    expect(state.get()).toBe('katselu')
    expect(state.isEditing()).toBe(false)
    expect(state.canDragMarkers()).toBe(false)
    expect(state.canPlaceMarkers()).toBe(false)
    expect(state.canDragSegmentBounds()).toBe(false)
  })

  it('jaettu singleton alkaa katselusta joka latauksella', () => {
    // Moduulitila nollautuu sivunlatauksessa ∴ tämä on sama tarkistus kuin selaimessa.
    expect(mapMode.get()).toBe('katselu')
  })

  it('toggle vaihtaa tilan ja predikaatit seuraavat', () => {
    const state = createMapModeState()
    expect(state.toggle()).toBe('muokkaus')
    expect(state.canDragMarkers()).toBe(true)
    expect(state.canDragSegmentBounds()).toBe(true)
    expect(state.toggle()).toBe('katselu')
    expect(state.canPlaceMarkers()).toBe(false)
  })

  it('onChange ilmoittaa uuden tilan; peruutusfunktio lopettaa ilmoitukset', () => {
    const state = createMapModeState()
    const seen: MapMode[] = []
    const off = state.onChange(m => seen.push(m))
    state.toggle()
    state.toggle()
    expect(seen).toEqual(['muokkaus', 'katselu'])
    off()
    state.toggle()
    expect(seen).toEqual(['muokkaus', 'katselu'])
  })

  it('set samaan arvoon ei ilmoita (ei turhia uudelleenarviointeja)', () => {
    const state = createMapModeState()
    const spy = vi.fn()
    state.onChange(spy)
    expect(state.set('katselu')).toBe('katselu')
    expect(spy).not.toHaveBeenCalled()
    state.set('muokkaus')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('createMapModeState(initial) sallii muokkaustilan vain eksplisiittisesti', () => {
    expect(createMapModeState('muokkaus').get()).toBe('muokkaus')
  })

  it('erilliset instanssit eivät vuoda toisiinsa (ei globaalia jäännöstilaa)', () => {
    const a = createMapModeState()
    a.set('muokkaus')
    expect(createMapModeState().get()).toBe('katselu')
  })
})

describe('T307/V218 — tilaa EI persistoida', () => {
  it('map-mode.ts ei viittaa localStorageen/sessionStorageen', () => {
    const src = readFileSync(resolve(__dirname, '../src/logic/map-mode.ts'), 'utf8')
    // Kommentit pois — ne SAAVAT mainita localStoragen (kielto on dokumentoitu siellä).
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    // Vahinkomuokkaus reloadin jälkeen = juuri se mitä V218 estää → persistointi kiellettyä.
    expect(code).not.toMatch(/localStorage/)
    expect(code).not.toMatch(/sessionStorage/)
  })
})
