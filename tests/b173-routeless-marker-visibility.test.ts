// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import L from 'leaflet'
import { MarkerManager } from '../src/map/markers'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { SignMarker } from '../src/logic/types'

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

function marker(id: string, routeIds: string[], extra: Partial<SignMarker> = {}): SignMarker {
  return {
    id, type: 'right', lat: 65.0, lon: 27.0, distanceFromStart: 0,
    routeIds, status: 'suunniteltu', ...extra,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('B173 — reitittömä merkki ei katoa reittisuodattimeen', () => {
  it('reititön merkki näkyy getAll():ssa vaikka mikään reitti ei täsmää', () => {
    const kasa = marker('kasa', [], { templateId: PILE_TEMPLATE_ID, pileMarkerIds: ['a', 'b'] })
    const mgr = new MarkerManager(makeMap(), routes, () => {}, [kasa])
    expect(mgr.getAll().map(m => m.id)).toEqual(['kasa'])
  })

  it('reititön merkki säilyy myös kun reitit piilotetaan (⊥ ankkuria jonka mukana kadota)', () => {
    const kasa = marker('kasa', [])
    const reitilla = marker('reitilla', ['r1'])
    const mgr = new MarkerManager(makeMap(), routes, () => {}, [kasa, reitilla])
    mgr.setVisibleRoutes([])
    expect(mgr.getAll().map(m => m.id)).toEqual(['kasa'])
  })

  it('reitillinen merkki katoaa yhä oman reittinsä mukana (entinen sääntö ennallaan)', () => {
    const mgr = new MarkerManager(makeMap(), routes, () => {}, [marker('m', ['r1'])])
    expect(mgr.getAll()).toHaveLength(1)
    mgr.setVisibleRoutes(['r2'])
    expect(mgr.getAll()).toHaveLength(0)
  })
})
