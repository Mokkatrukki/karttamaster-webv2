import { describe, it, expect, vi, afterEach } from 'vitest'
import L from 'leaflet'
import { MarkerManager } from '../src/map/markers'

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

describe('T170/V106 — iconId denormalisoituu markerille', () => {
  it('add() tallentaa iconId kun annettu', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const mgr = new MarkerManager(map, routes, () => {}, [])
    const m = mgr.add(65.0, 27.0, 'huolto', '#ff0000', 'Huolto', 'wrench')
    expect(m.iconId).toBe('wrench')
  })

  it('add() jättää iconId pois kun ei annettu', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const mgr = new MarkerManager(map, routes, () => {}, [])
    const m = mgr.add(65.0, 27.0, 'right')
    expect(m.iconId).toBeUndefined()
  })

  it('updateType() päivittää iconId:n', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const mgr = new MarkerManager(map, routes, () => {}, [])
    const m = mgr.add(65.0, 27.0, 'huolto', '#ff0000', 'Huolto', 'wrench')
    mgr.updateType(m.id, 'poi', '#00ff00', 'POI', 'map-pin')
    const updated = mgr.getAll().find((x) => x.id === m.id)
    expect(updated?.iconId).toBe('map-pin')
  })

  it('updateType() tyhjentää iconId:n kun ei annettu', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const mgr = new MarkerManager(map, routes, () => {}, [])
    const m = mgr.add(65.0, 27.0, 'huolto', '#ff0000', 'Huolto', 'wrench')
    mgr.updateType(m.id, 'right')
    const updated = mgr.getAll().find((x) => x.id === m.id)
    expect(updated?.iconId).toBeUndefined()
  })
})
