import { describe, it, expect, afterEach, vi } from 'vitest'
import L from 'leaflet'
import { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1',
    type: 'right',
    lat: 65.0,
    lon: 27.0,
    distanceFromStart: 0,
    routeIds: ['r1'],
    status: 'suunniteltu',
    ...overrides,
  }
}

function makeMap() {
  document.body.innerHTML = '<div id="map" style="width:400px;height:400px"></div>'
  return L.map('map', { center: [65, 27], zoom: 12 })
}

const routes = [
  {
    id: 'r1',
    routePoints: [
      { lat: 65.0, lon: 27.0, distanceFromStart: 0 },
      { lat: 65.01, lon: 27.01, distanceFromStart: 100 },
    ],
  },
]

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('T135 — drag-siirto ei avaa merkki-modaalia (B54/V82)', () => {
  it('dragend ei laukaise onMarkerClick-callbackia', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const marker = makeMarker()
    const mgr = new MarkerManager(map, routes, () => {}, [marker])
    const onMarkerClick = vi.fn()
    mgr.setOnMarkerClick(onMarkerClick)

    const lm = (mgr as any).leafletMarkers.get('m1') as L.Marker
    lm.fire('dragend')

    expect(onMarkerClick).not.toHaveBeenCalled()
  })

  it('eksplisiittinen leaflet-click avaa modaalin edelleen', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const marker = makeMarker()
    const mgr = new MarkerManager(map, routes, () => {}, [marker])
    const onMarkerClick = vi.fn()
    mgr.setOnMarkerClick(onMarkerClick)

    const lm = (mgr as any).leafletMarkers.get('m1') as L.Marker
    lm.fire('click', { originalEvent: new MouseEvent('click') } as any)

    expect(onMarkerClick).toHaveBeenCalledWith('m1')
  })
})
