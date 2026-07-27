import { describe, it, expect, afterEach, vi } from 'vitest'
import { PlaceMode } from '../src/ui/place-mode'
import { createMapModeState } from '../src/logic/map-mode'
import { createLibrary, createTemplate } from '../src/logic/sign-library'

// T237/V245 — "💬 Huomio" merkkivalikossa.
//
// Kenttähavainto 2026-07-25: suosikkeja on kymmeniä ∴ listan LOPPUUN sijoitettu huomio-rivi
// valui ruudun ulkopuolelle eikä sitä löytynyt. Rakenne: mallilista vierii (.floating-picker-list),
// huomio on listan ULKOPUOLINEN alapalkki (.floating-picker-footer) joka pysyy paikallaan.
// Rakenne kantaa myös semantiikan: huomio ⊥ ole merkkityyppi (V245).

function setup() {
  document.body.innerHTML = `<div id="map"></div><div id="floating-picker"></div>`
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function libWithManyFavorites(n: number) {
  const lib = createLibrary()
  lib.clear()
  for (let i = 0; i < n; i++) {
    createTemplate(lib, { label: `Suosikki ${i}`, color: '#111111', description: '', favorite: true }, `fav${i}`)
  }
  return lib
}

describe('T237 — huomio merkkivalikossa', () => {
  it('huomio on listan ULKOPUOLELLA alapalkissa — ⊥ mallilistan jäsen (V245)', () => {
    setup()
    const pm = new PlaceMode({ add: vi.fn() } as any, libWithManyFavorites(20), createMapModeState('muokkaus'), vi.fn())
    pm.openPicker(65.0, 27.0, 200, 300)

    const list = document.querySelector('.floating-picker-list')!
    const footer = document.querySelector('.floating-picker-footer')!
    expect(list.querySelectorAll('.sign-type-btn')).toHaveLength(20)
    // Ydinväite: huomio ei ole vierivän listan sisällä ∴ 20 suosikkia ⊥ hautaa sitä.
    expect(list.querySelector('.floating-picker-comment')).toBeNull()
    expect(footer.querySelector('.floating-picker-comment')).not.toBeNull()
  })

  it('huomio-rivin klikkaus kutsuu onPlaceComment pickerin koordinaateilla, EI luo merkkiä', () => {
    setup()
    const add = vi.fn()
    const onPlaceComment = vi.fn()
    const pm = new PlaceMode({ add } as any, libWithManyFavorites(3), createMapModeState('muokkaus'), onPlaceComment)
    pm.openPicker(65.12, 27.34, 200, 300)

    ;(document.querySelector('.floating-picker-comment') as HTMLButtonElement).click()

    expect(onPlaceComment).toHaveBeenCalledWith(65.12, 27.34)
    // V245: huomio ⊥ ole merkki — markerManager.add ⊥ saa kutsuta (loisi tyypittömän merkin).
    expect(add).not.toHaveBeenCalled()
    expect(pm.isPickerOpen()).toBe(false)
  })

  it('ilman onPlaceComment-callbackia alapalkkia ⊥ renderöidä', () => {
    setup()
    const pm = new PlaceMode({ add: vi.fn() } as any, libWithManyFavorites(3), createMapModeState('muokkaus'))
    pm.openPicker(65.0, 27.0, 200, 300)

    expect(document.querySelector('.floating-picker-footer')).toBeNull()
    expect(document.querySelectorAll('#floating-picker .sign-type-btn')).toHaveLength(3)
  })

  it('regressio: mallin klikkaus toimii ennallaan vaikka rakenne sai listakääreen', () => {
    setup()
    const add = vi.fn()
    const pm = new PlaceMode({ add } as any, libWithManyFavorites(2), createMapModeState('muokkaus'), vi.fn())
    pm.openPicker(65.0, 27.0, 200, 300)

    ;(document.querySelector('.floating-picker-list .sign-type-btn') as HTMLButtonElement).click()
    expect(add).toHaveBeenCalledTimes(1)
    expect(add.mock.calls[0][0]).toBe(65.0)
  })
})

describe('T237 — huomio talkoolaisen ⋯-valikossa', () => {
  it('hero-overflow sisältää "💬 Huomio" ja klikkaus kutsuu onAddComment', async () => {
    const { SegmentView } = await import('../src/ui/segment-view')
    document.body.innerHTML = ''
    const container = document.createElement('div')
    document.body.appendChild(container)

    const onAddComment = vi.fn()
    const view = new SegmentView(
      container,
      { id: 's1', routeIds: ['r'], startDist: 0, endDist: 9000, equipment: [], phase: 'asettaminen', displayName: 'P1' } as any,
      undefined,
      undefined,
      { onAddComment },
    )
    view.update([{ id: 'm1', type: 'right', lat: 65, lon: 27, distanceFromStart: 5000, routeIds: ['r'], status: 'suunniteltu' } as any])

    const item = container.querySelector('.segment-view-next-note') as HTMLButtonElement
    expect(item).not.toBeNull()
    expect(item.disabled).toBe(false)
    item.click()
    expect(onAddComment).toHaveBeenCalledTimes(1)
  })

  it('ilman callbackia rivi on disabloitu "Tulossa" (⊥ kuollut nappi ilman selitystä)', async () => {
    const { SegmentView } = await import('../src/ui/segment-view')
    document.body.innerHTML = ''
    const container = document.createElement('div')
    document.body.appendChild(container)

    const view = new SegmentView(
      container,
      { id: 's1', routeIds: ['r'], startDist: 0, endDist: 9000, equipment: [], phase: 'asettaminen', displayName: 'P1' } as any,
    )
    view.update([{ id: 'm1', type: 'right', lat: 65, lon: 27, distanceFromStart: 5000, routeIds: ['r'], status: 'suunniteltu' } as any])

    const item = container.querySelector('.segment-view-next-note') as HTMLButtonElement
    expect(item.disabled).toBe(true)
    expect(item.title).toBe('Tulossa')
  })
})
