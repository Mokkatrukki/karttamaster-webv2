import { describe, it, expect, afterEach, vi } from 'vitest'
import { PlaceMode } from '../src/ui/place-mode'
import { createLibrary, createTemplate } from '../src/logic/sign-library'

// T219/V149: talkoolaisen place-UI — näkyvä "➕ Merkki" avaa suosikki-pickerin (listFavorites,
// jaettu SignLibrary, sama openPicker kuin järjestäjän tuplaklikki). Placing → markerManager.add.
// Backend V149 (oma pätkä ok / vieras 403) katettu server/markers.test.ts:228-271.

function setup() {
  document.body.innerHTML = `<div id="map"></div><div id="floating-picker"></div>`
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function libWithFavorites() {
  const lib = createLibrary()
  // aloita puhtaalta pöydältä jotta laskurit ovat deterministiset
  lib.clear()
  createTemplate(lib, { label: 'Suosikki A', color: '#111111', description: '', favorite: true }, 'favA')
  createTemplate(lib, { label: 'Suosikki B', color: '#222222', description: '', favorite: true }, 'favB')
  createTemplate(lib, { label: 'Ei-suosikki', color: '#333333', description: '', favorite: false }, 'plain')
  return lib
}

describe('T219 — talkoolaisen suosikki-picker (openPicker)', () => {
  it('picker näyttää yhden napin per suosikki (listFavorites), ei ei-suosikkeja', () => {
    setup()
    const pm = new PlaceMode({ add: vi.fn() } as any, libWithFavorites())

    pm.openPicker(65.0, 27.0, 200, 300)

    const btns = document.querySelectorAll('#floating-picker .sign-type-btn')
    expect(btns.length).toBe(2)
    const labels = Array.from(btns).map(b => (b as HTMLElement).dataset.label).sort()
    expect(labels).toEqual(['Suosikki A', 'Suosikki B'])
    expect(pm.isPickerOpen()).toBe(true)
  })

  it('suosikin klikkaus sijoittaa merkin pendingiin koordinaatteihin + templateId (V143)', () => {
    setup()
    const add = vi.fn()
    const pm = new PlaceMode({ add } as any, libWithFavorites())

    pm.openPicker(65.0, 27.0, 200, 300)
    const favA = document.querySelector<HTMLButtonElement>('#floating-picker .sign-type-btn[data-type="favA"]')!
    favA.click()

    expect(add).toHaveBeenCalledTimes(1)
    // add(lat, lon, type, color, label, iconId, parts, imageId, templateId)
    const args = add.mock.calls[0]
    expect(args[0]).toBe(65.0)
    expect(args[1]).toBe(27.0)
    expect(args[2]).toBe('favA')          // type = template.id
    expect(args[8]).toBe('favA')          // templateId denormalisoitu (V143) — myös picker-polulla
    expect(pm.isPickerOpen()).toBe(false) // sijoitus sulkee pickerin
  })
})
