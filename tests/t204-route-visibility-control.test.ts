// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RouteVisibilityControl } from '../src/map/route-visibility-control'
import type { RouteConfig } from '../src/logic/multi-route'

// T204/T286 → **T377**: kontrollin DOM (trigger + listapaneeli) on luovutettu `MapFilterBar`ille
// (`tests/t377-map-filter-bar.test.ts` vahtii sen). Jäljelle jää SOVELLUS: bar päättää, tämä
// luokka vie päätöksen Leaflet-kerrokseen (polylinet + merkit + pätkäviivat) & tarjoaa
// `getActiveRoute`-sopimuksen ProgressBarille/StatusPanelille (V271).

function makeRoute(id: string, color: string, event?: string): RouteConfig {
  return {
    id, label: id, color, event, file: `/${id}.gpx`,
    routePoints: [
      { lat: 0, lon: 0, distanceFromStart: 0 },
      { lat: 1, lon: 1, distanceFromStart: 1000 },
    ],
  } as RouteConfig
}

function fakePolyline() {
  return { addTo: vi.fn().mockReturnThis(), remove: vi.fn().mockReturnThis() }
}

describe('T204/T377 — RouteVisibilityControl (sovellus, ⊥ DOM)', () => {
  let routes: RouteConfig[]
  let polylines: ReturnType<typeof fakePolyline>[]
  let markerManager: { setVisibleRoutes: ReturnType<typeof vi.fn> }
  let onVisibleChange: ReturnType<typeof vi.fn>
  let map: unknown

  beforeEach(() => {
    routes = [makeRoute('smtb-30', '#4C97D6', 'SyöteMTB'), makeRoute('sgf-62', '#E9A13B', 'Gravel Fest')]
    polylines = [fakePolyline(), fakePolyline()]
    markerManager = { setVisibleRoutes: vi.fn() }
    onVisibleChange = vi.fn()
    map = {}
  })

  function build() {
    return new RouteVisibilityControl(
      routes, polylines as never, map as never, markerManager as never, onVisibleChange,
    )
  }

  it('⊥ renderöi omaa DOM:ia — yksi "mitä näkyy" -pinta (T377)', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    build()
    expect(container.querySelectorAll('.route-vis-trigger')).toHaveLength(0)
    expect(container.querySelectorAll('.route-vis-row')).toHaveLength(0)
  })

  it('oletuksena kaikki reitit näkyvissä', () => {
    expect(build().getVisibleRouteIds()).toEqual(['smtb-30', 'sgf-62'])
  })

  it('piilotus poistaa polylinen & vie näkyvyyden merkeille', () => {
    const c = build()
    c.setVisibleRoutes(['sgf-62'])
    expect(polylines[0].remove).toHaveBeenCalled()
    expect(polylines[1].addTo).toHaveBeenCalled()
    expect(markerManager.setVisibleRoutes).toHaveBeenCalledWith(['sgf-62'])
  })

  it('T374/V269: sama kytkin ilmoitetaan ulos (pätkäviivat & nimilaput)', () => {
    build().setVisibleRoutes(['sgf-62'])
    expect(onVisibleChange).toHaveBeenCalledWith(['sgf-62'])
  })

  it('uudelleennäyttö lisää polylinen takaisin', () => {
    const c = build()
    c.setVisibleRoutes(['sgf-62'])
    c.setVisibleRoutes(['smtb-30', 'sgf-62'])
    expect(polylines[0].addTo).toHaveBeenCalled()
    expect(c.getVisibleRouteIds()).toEqual(['smtb-30', 'sgf-62'])
  })

  it('getActiveRoute = ensimmäinen näkyvä (ProgressBar/StatusPanel-sopimus)', () => {
    const c = build()
    expect(c.getActiveRoute().id).toBe('smtb-30')
    c.setVisibleRoutes(['sgf-62'])
    expect(c.getActiveRoute().id).toBe('sgf-62')
    expect(c.getActiveTotalM()).toBe(1000)
  })

  it('V6 vahditaan BARISSA ⊥ täällä — tyhjä lista on tyhjä kartta, ⊥ hiljainen korjaus', () => {
    // Hiljainen korjaus piilottaisi kutsujan bugin; barin testit (T377) todistavat että
    // käyttäjä ⊥ pääse tähän tilaan.
    const c = build()
    c.setVisibleRoutes([])
    expect(c.getVisibleRouteIds()).toEqual([])
    expect(markerManager.setVisibleRoutes).toHaveBeenCalledWith([])
  })
})
