import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import L from 'leaflet'
import { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1',
    type: 'huolto',
    lat: 65.0,
    lon: 27.0,
    distanceFromStart: 0,
    routeIds: [],
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

describe('MarkerManager.reload', () => {
  it('korvaa merkkilistan ja piirtää näkyvät merkit uudelleen', () => {
    const map = makeMap()
    const mgr = new MarkerManager(map, routes, () => {}, [])
    const fresh = [makeMarker({ id: 'a', routeIds: ['r1'] })]
    mgr.reload(fresh)
    expect(mgr.getAll().map((m) => m.id)).toEqual(['a'])
  })
})

describe('MarkerManager.fixOrphanRouteIds — B1/V21-tyylinen ghost-marker-korjaus GPKG-tuonnille', () => {
  it('antaa tyhjän routeIds:n saavan merkin fallback-reitin lähimmän reitin mukaan', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const orphan = makeMarker({ id: 'orphan-1', lat: 65.0, lon: 27.0, routeIds: [] })
    const mgr = new MarkerManager(map, routes, () => {}, [orphan])

    const fixedCount = mgr.fixOrphanRouteIds()

    expect(fixedCount).toBe(1)
    const updated = mgr.getAll().find((m) => m.id === 'orphan-1')
    expect(updated?.routeIds).toEqual(['r1'])
  })

  it('ei koske merkkeihin joilla on jo routeIds', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const assigned = makeMarker({ id: 'has-route', routeIds: ['r1'] })
    const mgr = new MarkerManager(map, routes, () => {}, [assigned])

    const fixedCount = mgr.fixOrphanRouteIds()

    expect(fixedCount).toBe(0)
    expect(mgr.getAll().find((m) => m.id === 'has-route')?.routeIds).toEqual(['r1'])
  })

  it('orpo-merkki tulee näkyväksi kartalla (getAll palauttaa sen) korjauksen jälkeen', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const map = makeMap()
    const orphan = makeMarker({ id: 'ghost', routeIds: [] })
    const mgr = new MarkerManager(map, routes, () => {}, [orphan])

    // Ennen korjausta: routeIds tyhjä -> ei täsmää mihinkään visibleRouteIds -> ei näkyvissä
    expect(mgr.getAll()).toHaveLength(0)

    mgr.fixOrphanRouteIds()

    expect(mgr.getAll()).toHaveLength(1)
    expect(mgr.getAll()[0].id).toBe('ghost')
  })
})
