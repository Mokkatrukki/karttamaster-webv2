import { describe, it, expect, afterEach, vi } from 'vitest'
import { SignLibraryPanel } from '../src/ui/sign-library-panel'
import { PlaceMode } from '../src/ui/place-mode'
import { createLibrary, createTemplate, listTemplates } from '../src/logic/sign-library'
import type { SignLibrary } from '../src/logic/sign-library'

function setup() {
  document.body.innerHTML = `<div id="sign-lib"></div><div id="map"></div><div id="floating-picker"></div>`
  return document.getElementById('sign-lib')!
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('T136 — sivupalkin merkkikirjastosta voi asettaa merkin kartalle (B55/V83)', () => {
  it('jokainen rivi — myös custom-malli — saa klikattavan sign-lib-place-btn:n', () => {
    const lib = createLibrary()
    createTemplate(lib, { label: 'Custom', shortLabel: 'C', color: '#123456', description: '', favorite: false }, 'custom')
    const container = setup()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())

    const templates = listTemplates(lib)
    const placeBtns = container.querySelectorAll('.sign-lib-place-btn')
    expect(placeBtns.length).toBe(templates.length)
  })

  it('klikkaus custom-mallin place-nappia kutsuu onPlace:a ilman suosikkivaatimusta', () => {
    const lib = createLibrary()
    createTemplate(lib, { label: 'Custom', shortLabel: 'C', color: '#123456', description: '', favorite: false }, 'custom')
    const container = setup()
    const onPlace = vi.fn()
    new SignLibraryPanel(container, lib, vi.fn(), onPlace)

    const custom = listTemplates(lib).find(t => t.label === 'Custom')!
    const btn = container.querySelector<HTMLButtonElement>(`.sign-lib-place-btn[data-id="${custom.id}"]`)!
    btn.click()

    expect(onPlace).toHaveBeenCalledWith(custom)
  })

  it('PlaceMode.armFromSidebar + placeArmedAt sijoittaa merkin kartan seuraavassa klikissä', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    setup()
    const add = vi.fn()
    const managerStub = { add } as any
    const lib = createLibrary()
    createTemplate(lib, { label: 'Custom', shortLabel: 'C', color: '#123456', description: '', favorite: false }, 'custom')
    const pm = new PlaceMode(managerStub, lib)
    const custom = listTemplates(lib)[0]

    expect(pm.isArmed()).toBe(false)
    pm.armFromSidebar(custom)
    expect(pm.isArmed()).toBe(true)
    expect(document.getElementById('map')!.classList.contains('place-mode')).toBe(true)

    const placed = pm.placeArmedAt(65.0, 27.0)

    expect(placed).toBe(true)
    expect(add).toHaveBeenCalledWith(65.0, 27.0, custom.id, custom.color, custom.shortLabel)
    expect(pm.isArmed()).toBe(false)
    expect(document.getElementById('map')!.classList.contains('place-mode')).toBe(false)
  })
})
