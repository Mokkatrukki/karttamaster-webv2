// @vitest-environment jsdom
/**
 * T451/V334/B181 — luontimodaalia ⊥ voi hylätä vahingossa & tiedot-vaiheesta pääsee takaisin.
 *
 * B181: `segment-creation-modal.ts:81` käytti `createBackdrop`ia ∴ klikki modaalin vierestä
 * tiedot-vaiheessa (jossa backdrop on klikattava overlay, `style.css:3125`) kutsui `onCancel`in
 * = `cancelCreation` → kaikki klikatut ankkurit pois & pätkä oli tehtävä uudelleen.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore } from '../src/logic/segments'

const ROUTE_POINTS = [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.1, lon: 25.1, distanceFromStart: 5000 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
]
const ROUTES = [{ id: 'r1', routePoints: ROUTE_POINTS }]

function setup() {
  const store = createSegmentStore()
  const container = document.createElement('div')
  document.body.appendChild(container)

  const callbacks = {
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    onAnchorsChanged: vi.fn(),
    onAnchorsClear: vi.fn(),
    onNotify: vi.fn(),
  }

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id-' + Math.random() })

  const panel = new SegmentPanel(container, ROUTES, store, vi.fn(), callbacks)
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  return { panel, store, callbacks }
}

const q = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!

/** Luonti tiedot-vaiheeseen kolmella ankkurilla. */
function toTiedot(panel: SegmentPanel): void {
  q<HTMLButtonElement>('#btn-segment-create').click()
  panel.onMapClick(65.0, 25.0)
  panel.onMapClick(65.1, 25.1)
  panel.onMapClick(65.2, 25.2)
  q<HTMLButtonElement>('.btn-segment-path-done').click()
}

describe('T451 — vahinkohylkäys ⊥ hävitä luontityötä (B181)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('taustaklikki tiedot-vaiheessa EI peru luontia (B181)', () => {
    const { panel } = setup()
    toTiedot(panel)

    q('.segment-creation-modal-backdrop').click()

    expect(panel.isCreationMode()).toBe(true)
    expect(document.querySelector('.btn-segment-creation-save')).not.toBeNull()
  })

  it('taustaklikki polkuvaiheessa EI peru luontia', () => {
    const { panel } = setup()
    q<HTMLButtonElement>('#btn-segment-create').click()
    panel.onMapClick(65.0, 25.0)

    q('.segment-creation-modal-backdrop').click()

    expect(panel.isCreationMode()).toBe(true)
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(1)
  })

  it('taustaklikki reitittömässä luonnissa EI hävitä lomaketta', () => {
    const { panel } = setup()
    q<HTMLButtonElement>('#btn-segment-create-routeless').click()
    q<HTMLInputElement>('.segment-creation-name-input').value = 'Maalialue'

    q('.segment-creation-modal-backdrop').click()

    expect(panel.isCreationMode()).toBe(true)
    expect(q<HTMLInputElement>('.segment-creation-name-input').value).toBe('Maalialue')
  })

  it('nimetty peruutus toimii yhä — ✕ ja "Peruuta" sulkevat', () => {
    const { panel } = setup()
    toTiedot(panel)
    q<HTMLButtonElement>('.btn-segment-creation-cancel').click()
    expect(panel.isCreationMode()).toBe(false)

    toTiedot(panel)
    q<HTMLButtonElement>('.segment-creation-modal-cancel').click()
    expect(panel.isCreationMode()).toBe(false)
  })

  it('"← Takaisin" palauttaa polkuvaiheeseen ankkurit tallella', () => {
    const { panel } = setup()
    toTiedot(panel)

    q<HTMLButtonElement>('.btn-segment-creation-back').click()

    const items = [...document.querySelectorAll('.segment-creation-anchor')].map(el => el.textContent)
    expect(items).toEqual(['Alku: 0.0 km', 'Välipiste 1: 5.0 km', 'Loppu: 10.0 km'])
  })

  it('paluun jälkeen kartta elää: klikki tuottaa ankkurin & "Valmis" vie takaisin tiedot-vaiheeseen', () => {
    const { panel, callbacks } = setup()
    q<HTMLButtonElement>('#btn-segment-create').click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    q<HTMLButtonElement>('.btn-segment-path-done').click()
    q<HTMLButtonElement>('.btn-segment-creation-back').click()

    // Snap-markerit herätetty uudelleen (finishPath sammutti ne).
    expect(callbacks.onShowSnapMarkers).toHaveBeenCalledTimes(2)

    q<HTMLButtonElement>('.btn-segment-anchor-undo').click()
    panel.onMapClick(65.2, 25.2)
    expect([...document.querySelectorAll('.segment-creation-anchor')].map(el => el.textContent))
      .toEqual(['Alku: 0.0 km', 'Loppu: 10.0 km'])

    q<HTMLButtonElement>('.btn-segment-path-done').click()
    expect(document.querySelector('.btn-segment-creation-save')).not.toBeNull()
  })

  it('paluun jälkeen tallennettu pätkä saa KORJATUT rajat ⊥ vanhoja', () => {
    const { panel, store } = setup()
    toTiedot(panel)
    q<HTMLButtonElement>('.btn-segment-creation-back').click()
    q<HTMLButtonElement>('.btn-segment-anchor-undo').click() // loppu 10 km pois → loppu 5 km
    q<HTMLButtonElement>('.btn-segment-path-done').click()
    q<HTMLButtonElement>('.btn-segment-creation-save').click()

    const seg = [...store.values()][0]
    expect(seg.startDist).toBe(0)
    expect(seg.endDist).toBe(5000)
  })

  it('peruutus tyhjentää polkumuistin — seuraava luonti ⊥ peri vanhoja ankkureita', () => {
    const { panel } = setup()
    toTiedot(panel)
    q<HTMLButtonElement>('.btn-segment-creation-cancel').click()

    q<HTMLButtonElement>('#btn-segment-create').click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    q<HTMLButtonElement>('.btn-segment-path-done').click()
    // Vanha polkumuisti ⊥ tarjoa paluuta jota tämä luonti ⊥ omista.
    q<HTMLButtonElement>('.btn-segment-creation-back').click()
    expect([...document.querySelectorAll('.segment-creation-anchor')].map(el => el.textContent))
      .toEqual(['Alku: 0.0 km', 'Loppu: 10.0 km'])
  })
})
