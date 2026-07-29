// @vitest-environment jsdom
//
// T388/V280/B162: luonnin ankkuriklikki ! näkyä KARTALLA jokaisesta ankkurista, ⊥ vain
// ensimmäisestä. Vahti mittaa KARTTACALLBACKIA ⊥ modaalin `<li>`-määrää: juuri se ero oli
// B162:n katve — ankkurilista kasvoi oikein koko ajan, kartta oli mykkä klikistä 2 eteenpäin.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore } from '../src/logic/segments'

const ROUTE_POINTS = [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.1, lon: 25.1, distanceFromStart: 5000 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
]

const ROUTES = [{ id: 'r1', label: 'Reitti 1', routePoints: ROUTE_POINTS }]

function setup() {
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

  const panel = new SegmentPanel(container, ROUTES, createSegmentStore(), vi.fn(), callbacks)
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
  return { panel, callbacks }
}

/** Viimeisimmän `onAnchorsChanged`-kutsun argumentit. */
function lastCall(cb: ReturnType<typeof vi.fn>) {
  const calls = cb.mock.calls
  return calls[calls.length - 1] as [{ idx: number }[], { lat: number; lon: number; d: number }[]]
}

describe('T388/V280 — luonnin ankkuripalaute kartalle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('B162: JOKAINEN ankkuriklikki kutsuu karttacallbackia — ⊥ vain ensimmäinen', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    panel.onMapClick(65.2, 25.2)

    // Ennen T388:aa tämä oli 1 (vain `vaihe1`-haara kutsui).
    expect(callbacks.onAnchorsChanged).toHaveBeenCalledTimes(3)
    const [anchors] = lastCall(callbacks.onAnchorsChanged)
    expect(anchors).toHaveLength(3)
  })

  it('callback saa KAIKKI ankkurit joka kerta — kartta piirtää tilan ⊥ deltaa', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.0, 25.0)
    expect(lastCall(callbacks.onAnchorsChanged)[0]).toHaveLength(1)
    panel.onMapClick(65.1, 25.1)
    expect(lastCall(callbacks.onAnchorsChanged)[0]).toHaveLength(2)
  })

  it('esikatselujälki syntyy toisesta ankkurista & on rebasettu (V258)', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.0, 25.0)
    // Yhdellä ankkurilla ⊥ ole jälkeä — `buildTrackFromAnchors` heittäisi.
    expect(lastCall(callbacks.onAnchorsChanged)[1]).toEqual([])

    panel.onMapClick(65.2, 25.2)
    const preview = lastCall(callbacks.onAnchorsChanged)[1]
    expect(preview.length).toBeGreaterThanOrEqual(2)
    expect(preview[0].d).toBe(0)
    expect(preview[preview.length - 1].d).toBe(10000)
  })

  it('"Poista viimeinen" päivittää kartan — peruttu ankkuri ⊥ jää haamuksi', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    callbacks.onAnchorsChanged.mockClear()

    ;(document.querySelector('.btn-segment-anchor-undo') as HTMLButtonElement).click()
    expect(callbacks.onAnchorsChanged).toHaveBeenCalledOnce()
    expect(lastCall(callbacks.onAnchorsChanged)[0]).toHaveLength(1)
  })

  it('"Valmis" & Peruuta siivoavat karttapalautteen', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()
    expect(callbacks.onAnchorsClear).toHaveBeenCalled()

    callbacks.onAnchorsClear.mockClear()
    panel.cancelCreation()
    expect(callbacks.onAnchorsClear).toHaveBeenCalled()
  })

  it('B163: "⊥ osumaa eteenpäin" nousee myös modaalin ULKOPUOLELLE', () => {
    const { panel, callbacks } = setup()
    panel.onMapClick(65.2, 25.2) // lukitse reitti loppupäästä
    callbacks.onAnchorsChanged.mockClear()

    panel.onMapClick(65.0, 25.0) // taaksepäin → ⊥ osumaa (V258 pysyy, vain näkyvyys muuttuu)
    expect(callbacks.onAnchorsChanged).not.toHaveBeenCalled()
    expect(callbacks.onNotify).toHaveBeenCalledWith(expect.stringContaining('Ei osumaa'))
    // Modaalin virhe säilyy — kaksi kanavaa, ⊥ toinen toisen sijaan.
    const err = document.querySelector('.segment-creation-error') as HTMLElement
    expect(err.hidden).toBe(false)
  })
})
