import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RouteVisibilityControl } from '../src/map/route-visibility-control'
import type { RouteConfig } from '../src/logic/multi-route'

function makeRoute(id: string, color: string): RouteConfig {
  return {
    id, label: id, color, file: `/${id}.gpx`,
    routePoints: [
      { lat: 0, lon: 0, distanceFromStart: 0 },
      { lat: 1, lon: 1, distanceFromStart: 1000 },
    ],
  } as RouteConfig
}

function fakePolyline() {
  return { addTo: vi.fn().mockReturnThis(), remove: vi.fn().mockReturnThis() }
}

describe('T204 — RouteVisibilityControl (järjestäjän kevyt reittivalitsin)', () => {
  let container: HTMLElement
  let routes: RouteConfig[]
  let polylines: ReturnType<typeof fakePolyline>[]
  let markerManager: { setVisibleRoutes: ReturnType<typeof vi.fn> }
  let map: unknown

  beforeEach(() => {
    container = document.createElement('div')
    routes = [makeRoute('35km', '#2F6FB0'), makeRoute('55km', '#B5476B')]
    polylines = [fakePolyline(), fakePolyline()]
    markerManager = { setVisibleRoutes: vi.fn() }
    map = {}
  })

  function build() {
    return new RouteVisibilityControl(
      routes, polylines as never, map as never, markerManager as never, container,
    )
  }

  it('renderöi yhden pillin per reitti (ei route-tabeja)', () => {
    build()
    expect(container.querySelectorAll('.route-vis-pill')).toHaveLength(2)
  })

  it('EI drive-kontrolleja: ei ◀▶-nuolia, ei route-tab-drive/scrubber-elementtejä', () => {
    build()
    expect(container.querySelector('.route-tab-drive')).toBeNull()
    expect(container.querySelector('.tab-arrow')).toBeNull()
    expect(container.textContent).not.toContain('▶')
    expect(container.textContent).not.toContain('◀')
  })

  it('reitin piilotus poistaa polylinen + kutsuu setVisibleRoutes jäljelle jäävällä', () => {
    build()
    const pill = container.querySelector<HTMLButtonElement>('.route-vis-pill[data-route-id="55km"]')!
    pill.click()
    expect(polylines[1].remove).toHaveBeenCalled()
    expect(markerManager.setVisibleRoutes).toHaveBeenLastCalledWith(['35km'])
    expect(pill.classList.contains('route-hidden')).toBe(true)
  })

  it('V6: viimeistä näkyvää reittiä ei voi piilottaa (no-op)', () => {
    build()
    // piilota 55km → jäljellä vain 35km
    container.querySelector<HTMLButtonElement>('.route-vis-pill[data-route-id="55km"]')!.click()
    markerManager.setVisibleRoutes.mockClear()
    const last = container.querySelector<HTMLButtonElement>('.route-vis-pill[data-route-id="35km"]')!
    expect(last.disabled).toBe(true)
    last.click()
    expect(markerManager.setVisibleRoutes).not.toHaveBeenCalled()
    expect(last.classList.contains('route-hidden')).toBe(false)
  })

  it('piilotetun reitin uudelleennäyttö lisää polylinen takaisin', () => {
    build()
    const pill = container.querySelector<HTMLButtonElement>('.route-vis-pill[data-route-id="55km"]')!
    pill.click()
    polylines[1].addTo.mockClear()
    pill.click()
    expect(polylines[1].addTo).toHaveBeenCalled()
    expect(markerManager.setVisibleRoutes).toHaveBeenLastCalledWith(['35km', '55km'])
  })

  it('getActiveRoute palauttaa ensimmäisen näkyvän reitin', () => {
    const ctrl = build()
    expect(ctrl.getActiveRoute().id).toBe('35km')
    container.querySelector<HTMLButtonElement>('.route-vis-pill[data-route-id="35km"]')!.click()
    expect(ctrl.getActiveRoute().id).toBe('55km')
  })
})
