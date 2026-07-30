// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// T397/V287 (fix B166) — GPS-sijaintipiste kuuluu omaan paneen, ei oletus-overlayPaneen.
// B166: piste oli samassa SVG-rendererissä kuin pätkäviivat ∴ jokainen SegmentOverlay.update()
// piirsi viivan sen päälle. Vahti mittaa PANEN, ei piirtojärjestystä — piirtojärjestys on
// juuri se takuu joka ei kelpaa (V287).

vi.mock('leaflet', async () => ({ default: (await import('./helpers/leaflet-mock')).L }))
import { installLeafletMock, L } from './helpers/leaflet-mock'
import { GpsNavigator } from '../src/map/gps-navigator'
// T406: jaettu karttatuplaus — ⊥ oma kopio (kolme kopiota ajautuu erilleen).
import { fakeMap, stubGeolocation } from './helpers/gps-map-mock'

function circleMarkerOpts(call = 0): Record<string, unknown> {
  return L.circleMarker.mock.calls[call][1] as Record<string, unknown>
}

beforeEach(installLeafletMock)

describe('T397/V287 — GPS-piste omassa panessa (B166-regressio)', () => {
  it('ensimmäinen fix luo gps-panen zIndexillä 675', () => {
    const map = fakeMap()
    const geo = stubGeolocation()
    new GpsNavigator(map as never).start()
    geo.fire(65.0, 27.0)

    expect(map.createPaneCalls).toEqual(['gps'])
    expect(map.panes['gps'].style.zIndex).toBe('675')
  })

  it('circleMarker saa pane-option — ei jää oletus-overlayPaneen', () => {
    const map = fakeMap()
    const geo = stubGeolocation()
    new GpsNavigator(map as never).start()
    geo.fire(65.0, 27.0)

    expect(L.circleMarker).toHaveBeenCalledTimes(1)
    expect(circleMarkerOpts().pane).toBe('gps')
  })

  it('gps-pane on yli overlayPanen (400), markerPanen (600) ja tooltipPanen (650)', () => {
    const map = fakeMap()
    const geo = stubGeolocation()
    new GpsNavigator(map as never).start()
    geo.fire(65.0, 27.0)

    const z = Number(map.panes['gps'].style.zIndex)
    expect(z).toBeGreaterThan(650)
    // popupPane (700) jää yli — modaali/popup ei saa jäädä sijaintipisteen alle.
    expect(z).toBeLessThan(700)
  })

  it('toinen fix ei luo panea uudelleen', () => {
    const map = fakeMap()
    const geo = stubGeolocation()
    new GpsNavigator(map as never).start()
    geo.fire(65.0, 27.0)
    geo.fire(65.1, 27.1)

    expect(map.createPaneCalls).toEqual(['gps'])
    // Toinen fix siirtää olemassa olevaa pistettä ⊥ luo uutta.
    expect(L.circleMarker).toHaveBeenCalledTimes(1)
  })

  it('stop() → start() → uusi fix käyttää samaa panea eikä luo toista', () => {
    const map = fakeMap()
    const geo = stubGeolocation()
    const gps = new GpsNavigator(map as never)
    gps.start()
    geo.fire(65.0, 27.0)
    gps.stop()
    gps.start()
    geo.fire(65.2, 27.2)

    expect(map.createPaneCalls).toEqual(['gps'])
    // stop() poistaa pisteen ∴ uusi fix luo uuden circleMarkerin — senkin ! olla panessa.
    expect(L.circleMarker).toHaveBeenCalledTimes(2)
    expect(circleMarkerOpts(1).pane).toBe('gps')
  })
})
