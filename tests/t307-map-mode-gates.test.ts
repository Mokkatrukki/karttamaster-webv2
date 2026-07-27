// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PlaceMode } from '../src/ui/place-mode'
import { createMapModeState } from '../src/logic/map-mode'
import { syncMapModeToBody } from '../src/app/markers-wiring'
import { createLibrary, createTemplate, type SignLibrary } from '../src/logic/sign-library'
import type { MarkerManager } from '../src/map/markers'

// T307/V218 — Taso 2 (Vitest-jsdom): moodin DOM-heijastus (yksi paikka) + PlaceMode-portit.

function setupDom(): void {
  document.body.innerHTML = '<div id="map"></div><div id="floating-picker"></div>'
}

function fakeManager(): { mm: MarkerManager; add: ReturnType<typeof vi.fn> } {
  const add = vi.fn()
  return { mm: { add } as unknown as MarkerManager, add }
}

function libWithFavorite(): SignLibrary {
  const lib = createLibrary()
  createTemplate(lib, { label: 'Nuoli', color: '#123456', description: '', favorite: true }, 'nuoli-t307')
  return lib
}

beforeEach(setupDom)
afterEach(() => {
  document.body.innerHTML = ''
  delete document.body.dataset.mapMode
  vi.restoreAllMocks()
})

describe('T307/V218 — body.dataset.mapMode päivittyy yhdestä paikasta', () => {
  it('asettaa nykyisen tilan heti ja seuraa muutoksia', () => {
    const state = createMapModeState()
    const off = syncMapModeToBody(state)
    expect(document.body.dataset.mapMode).toBe('katselu')
    state.toggle()
    expect(document.body.dataset.mapMode).toBe('muokkaus')
    state.toggle()
    expect(document.body.dataset.mapMode).toBe('katselu')
    off()
  })

  it('peruutus lopettaa heijastuksen (ei kahta kilpailevaa kirjoittajaa)', () => {
    const state = createMapModeState()
    const off = syncMapModeToBody(state)
    off()
    state.set('muokkaus')
    expect(document.body.dataset.mapMode).toBe('katselu')
  })
})

describe('T307/V218 — PlaceMode ei sijoita merkkiä katselutilassa', () => {
  it('armFromSidebar on no-op katselussa (ei viritystä, ei place-mode-kursoria)', () => {
    const state = createMapModeState()
    const { mm } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.armFromSidebar({ id: 'nuoli-t307', label: 'Nuoli', color: '#123456', description: '', favorite: true })
    expect(pm.isArmed()).toBe(false)
    expect(document.getElementById('map')!.classList.contains('place-mode')).toBe(false)
  })

  it('armFromSidebar virittää muokkaustilassa', () => {
    const state = createMapModeState('muokkaus')
    const { mm } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.armFromSidebar({ id: 'nuoli-t307', label: 'Nuoli', color: '#123456', description: '', favorite: true })
    expect(pm.isArmed()).toBe(true)
    expect(document.getElementById('map')!.classList.contains('place-mode')).toBe(true)
  })

  it('placeArmedAt ei luo merkkiä katselussa', () => {
    const state = createMapModeState('muokkaus')
    const { mm, add } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.armFromSidebar({ id: 'nuoli-t307', label: 'Nuoli', color: '#123456', description: '', favorite: true })
    state.set('katselu')
    expect(pm.placeArmedAt(65.1, 27.1)).toBe(false)
    expect(add).not.toHaveBeenCalled()
  })

  it('katselutilaan siirtyminen purkaa viritetyn mallin', () => {
    const state = createMapModeState('muokkaus')
    const { mm } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.armFromSidebar({ id: 'nuoli-t307', label: 'Nuoli', color: '#123456', description: '', favorite: true })
    state.set('katselu')
    expect(pm.isArmed()).toBe(false)
    expect(document.getElementById('map')!.classList.contains('place-mode')).toBe(false)
  })

  it('tuplaklikin picker ei avaudu katselussa', () => {
    const state = createMapModeState()
    const { mm } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.openPicker(65.1, 27.1, 10, 10)
    expect(pm.isPickerOpen()).toBe(false)
    expect(document.getElementById('floating-picker')!.querySelector('.sign-type-btn')).toBeNull()
  })

  it('tuplaklikin picker avautuu muokkaustilassa ja sen valinta luo merkin', () => {
    const state = createMapModeState('muokkaus')
    const { mm, add } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.openPicker(65.1, 27.1, 10, 10)
    expect(pm.isPickerOpen()).toBe(true)
    const btn = document.getElementById('floating-picker')!.querySelector('.sign-type-btn') as HTMLElement
    expect(btn).not.toBeNull()
    btn.click()
    expect(add).toHaveBeenCalledTimes(1)
    expect(add.mock.calls[0][0]).toBe(65.1)
  })

  it('moodin vaihto katseluun sulkee avoimen pickerin eikä klikkaus enää luo merkkiä', () => {
    const state = createMapModeState('muokkaus')
    const { mm, add } = fakeManager()
    const pm = new PlaceMode(mm, libWithFavorite(), state)
    pm.openPicker(65.1, 27.1, 10, 10)
    const btn = document.getElementById('floating-picker')!.querySelector('.sign-type-btn') as HTMLElement
    state.set('katselu')
    expect(pm.isPickerOpen()).toBe(false)
    btn.click()
    expect(add).not.toHaveBeenCalled()
  })
})
