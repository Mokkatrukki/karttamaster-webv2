// @vitest-environment jsdom
//
// T454/V338,V339 — kasan sijoitus on YKSI virta & kartta näkyy koko ajan.
// B185 (GPS ohitti sijoituksen), B186 (napautus vei pois kartalta), B187 (vahvistus ⊥ näyttänyt
// sijaintia).
//
// Käyttäjäpäätös 2026-07-31: "laita kasa → sanoo klikkaa näytölle → klikkaat ja se tulee siihen
// → sit voit siirtää sitä, aina niin että on näytöllä."

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startPilePlacement, type PilePreviewHandle } from '../src/app/pile-placement'
import { openPileConfirmBar } from '../src/ui/pile-drop'
import { PlaceMode } from '../src/ui/place-mode'
import { createMapModeState } from '../src/logic/map-mode'
import { setViewMode, getViewMode } from '../src/app/talkoolainen-mode'
import type { SignMarker } from '../src/logic/types'

function marker(id: string): SignMarker {
  return {
    id,
    type: 'nuoli-vasen',
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 0,
    routeIds: [],
    status: 'kerätty',
    templateId: 'nuoli-vasen',
    label: 'Nuoli vasen',
  } as SignMarker
}

function layout(viewMode: string | null = 'koti'): HTMLElement {
  document.body.innerHTML = ''
  const app = document.createElement('div')
  app.id = 'app'
  if (viewMode !== null) app.setAttribute('data-view-mode', viewMode)
  const container = document.createElement('div')
  container.id = 'segment-view-container'
  const panel = document.createElement('div')
  panel.id = 'segment-view'
  container.appendChild(panel)
  app.appendChild(container)
  document.body.appendChild(app)
  return panel
}

/** Kartan sijasta kirjanpito: mihin piste meni & missä se on nyt (raahaus liikuttaa sitä). */
function fakePreview(): { handle: PilePreviewHandle; at: () => { lat: number; lon: number }; moves: number; drag: (lat: number, lon: number) => void; removed: () => boolean } {
  let pos = { lat: 0, lon: 0 }
  let removed = false
  let moves = 0
  let onMove: (lat: number, lon: number) => void = () => {}
  const api = {
    handle: {
      move(lat: number, lon: number) { pos = { lat, lon }; moves++; onMove(lat, lon) },
      position: () => pos,
      remove() { removed = true },
    } as PilePreviewHandle,
    at: () => pos,
    get moves() { return moves },
    drag(lat: number, lon: number) { pos = { lat, lon }; onMove(lat, lon) },
    removed: () => removed,
    start(lat: number, lon: number, cb: (lat: number, lon: number) => void) {
      pos = { lat, lon }
      onMove = cb
      return api.handle
    },
  }
  return api as never
}

interface Harness {
  host: HTMLElement
  tap: (lat: number, lon: number) => void
  disarm: ReturnType<typeof vi.fn>
  onConfirm: ReturnType<typeof vi.fn>
  preview: ReturnType<typeof fakePreview> & { start: (lat: number, lon: number, cb: (lat: number, lon: number) => void) => PilePreviewHandle }
  previewCount: () => number
}

function start(viewMode: string | null = 'koti', distance: number | null = 40): Harness {
  const host = layout(viewMode)
  if (viewMode) setViewMode(viewMode as 'koti' | 'kartta')
  const preview = fakePreview() as never as Harness['preview']
  let previewCount = 0
  let placer: ((lat: number, lon: number) => void) | null = null
  let cleanup: () => void = () => {}
  const disarm = vi.fn(() => { const c = cleanup; cleanup = () => {}; placer = null; c() })
  const onConfirm = vi.fn()

  startPilePlacement({
    host,
    contents: [marker('a'), marker('b')],
    armPlacer: (fn, onDisarm) => { placer = fn; cleanup = onDisarm },
    disarm,
    showPreview: (lat, lon, onMove) => { previewCount++; return preview.start(lat, lon, onMove) },
    distanceFrom: () => distance,
    onConfirm,
  })

  return {
    host,
    tap: (lat, lon) => placer?.(lat, lon),
    disarm,
    onConfirm,
    preview,
    previewCount: () => previewCount,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  window.sessionStorage.clear()
})

describe('T454/V338 — napautus tuo pisteen SIIHEN & vahvistus näkyy kartan kanssa', () => {
  it('ohje ensin, napautus → piste samaan koordinaattiin + vahvistuspalkki', () => {
    const h = start()
    expect(h.host.querySelector('.pile-place-hint')).not.toBeNull()

    h.tap(65.61, 27.52)

    expect(h.previewCount()).toBe(1)
    expect(h.preview.at()).toEqual({ lat: 65.61, lon: 27.52 })
    // Ohje on tehnyt tehtävänsä ∴ kaksi ohjetta yhtä aikaa ⊥ jää ruudulle.
    expect(h.host.querySelector('.pile-place-hint')).toBeNull()
    expect(h.host.querySelector('.pile-confirm-bar')).not.toBeNull()
  })

  it('toinen napautus SIIRTÄÄ saman pisteen — ⊥ toista kasaa', () => {
    const h = start()
    h.tap(65.61, 27.52)
    h.tap(65.70, 27.90)
    expect(h.previewCount()).toBe(1)
    expect(h.preview.at()).toEqual({ lat: 65.70, lon: 27.90 })
    expect(document.querySelectorAll('.pile-confirm-bar').length).toBe(1)
  })

  it('Vahvista luo kasan sinne minne piste JÄI (raahaus liikutti sitä)', () => {
    const h = start()
    h.tap(65.61, 27.52)
    h.preview.drag(65.65, 27.60)
    ;(h.host.querySelector('.pile-confirm-ok') as HTMLButtonElement).click()
    expect(h.onConfirm).toHaveBeenCalledWith(65.65, 27.60)
  })

  it('Peruuta ⊥ luo kasaa & piste katoaa kartalta (aikomus ⊥ jätä jälkeä)', () => {
    const h = start()
    h.tap(65.61, 27.52)
    ;(h.host.querySelector('.pile-confirm-cancel') as HTMLButtonElement).click()
    expect(h.onConfirm).not.toHaveBeenCalled()
    expect(h.disarm).toHaveBeenCalledOnce()
    expect(h.preview.removed()).toBe(true)
    expect(h.host.querySelector('.pile-confirm-bar')).toBeNull()
  })

  it('tuplanapautus Vahvistaan (hanskat!) ⊥ luo kahta kasaa', () => {
    const h = start()
    h.tap(65.61, 27.52)
    const ok = h.host.querySelector('.pile-confirm-ok') as HTMLButtonElement
    ok.click()
    ok.click()
    expect(h.onConfirm).toHaveBeenCalledOnce()
  })

  it('etäisyys näkyy & seuraa pistettä; ilman fixiä lukemaa ⊥ arvata', () => {
    const h = start('koti', 340)
    h.tap(65.61, 27.52)
    expect(h.host.querySelector('.pile-confirm-bar-meta')!.textContent).toContain('340 m sinusta')
    expect(h.host.querySelector('.pile-confirm-bar-meta')!.textContent).toContain('2 merkkiä')

    const noFix = start('koti', null)
    noFix.tap(65.61, 27.52)
    expect(noFix.host.querySelector('.pile-confirm-bar-meta')!.textContent).toBe('2 merkkiä')
  })

  it('sisältö on tarkistettavissa mutta ⊥ työnnä karttaa pois (details)', () => {
    const h = start()
    h.tap(65.61, 27.52)
    const details = h.host.querySelector('.pile-confirm-bar-contents') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('.pile-contents-total')!.textContent).toContain('2 merkkiä')
  })
})

describe('T454/V339 — näkymä ⊥ katoa kesken teon (B186)', () => {
  it('napautus & vahvistus tapahtuvat karttamoodissa; kasa jää ruudulle', () => {
    const h = start('koti')
    expect(getViewMode()).toBe('kartta')
    h.tap(65.61, 27.52)
    expect(getViewMode()).toBe('kartta')
    ;(h.host.querySelector('.pile-confirm-ok') as HTMLButtonElement).click()
    // V340-henki: juuri syntynyttä kasaa ! voida katsoa — kotiin heitto piilottaisi tuloksen.
    expect(getViewMode()).toBe('kartta')
  })

  it('Peruuta palauttaa kotimoodin (teko ⊥ tapahtunut ∴ ⊥ syytä jäädä kartalle)', () => {
    const h = start('koti')
    h.tap(65.61, 27.52)
    ;(h.host.querySelector('.pile-confirm-cancel') as HTMLButtonElement).click()
    expect(getViewMode()).toBe('koti')
  })

  it('ohjerivin Peruuta ennen napautusta palauttaa myös', () => {
    const h = start('koti')
    ;(h.host.querySelector('.pile-place-hint-cancel') as HTMLButtonElement).click()
    expect(getViewMode()).toBe('koti')
  })
})

describe('T454/V339 — PlaceMode: viritys purkautuu, TILA ⊥ purkaudu ennen tulosta', () => {
  function placeMode(): PlaceMode {
    document.body.innerHTML = '<div id="map"></div><div id="floating-picker"></div>'
    const state = createMapModeState('muokkaus')
    return new PlaceMode({ add: vi.fn() } as never, new Map(), state)
  }

  it('napautus ⊥ aja tilan siivousta — se odottaa `disarm()`ia', () => {
    const pm = placeMode()
    const cleanup = vi.fn()
    const fn = vi.fn()
    pm.armPlacer(fn, cleanup)
    pm.placeArmedAt(65.6, 27.5)
    expect(fn).toHaveBeenCalledWith(65.6, 27.5)
    expect(cleanup).not.toHaveBeenCalled()
    // Viritys ITSE purkautui ∴ seuraava klikki ⊥ sijoita toista.
    expect(pm.isArmed()).toBe(false)
    pm.disarm()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('peruutus ilman napautusta ajaa siivouksen', () => {
    const pm = placeMode()
    const cleanup = vi.fn()
    pm.armPlacer(vi.fn(), cleanup)
    pm.disarm()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('siivous ajetaan kerran vaikka `disarm()` kutsuttaisiin kahdesti', () => {
    const pm = placeMode()
    const cleanup = vi.fn()
    pm.armPlacer(vi.fn(), cleanup)
    pm.disarm()
    pm.disarm()
    expect(cleanup).toHaveBeenCalledOnce()
  })
})

describe('T454 — vahvistuspalkki yksinään', () => {
  it('palkkia ⊥ synny kahta & etäisyys päivittyy', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const bar = openPileConfirmBar(host, [marker('a')], { onConfirm: vi.fn(), onCancel: vi.fn() }, 100)
    openPileConfirmBar(host, [marker('a')], { onConfirm: vi.fn(), onCancel: vi.fn() }, 100)
    expect(host.querySelectorAll('.pile-confirm-bar').length).toBe(1)
    bar.setDistance(1200)
    // Toinen palkki on nyt se elävä — ensimmäisen ohjain ⊥ saa kirjoittaa siihen.
    expect(host.querySelector('.pile-confirm-bar-meta')!.textContent).toContain('1 merkkiä')
  })
})
