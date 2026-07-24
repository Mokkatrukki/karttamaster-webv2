import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RouteVisibilityControl } from '../src/map/route-visibility-control'
import type { RouteConfig } from '../src/logic/multi-route'

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

describe('T204/T286 — RouteVisibilityControl (trigger + listapaneeli)', () => {
  let container: HTMLElement
  let routes: RouteConfig[]
  let polylines: ReturnType<typeof fakePolyline>[]
  let markerManager: { setVisibleRoutes: ReturnType<typeof vi.fn> }
  let map: unknown

  beforeEach(() => {
    container = document.createElement('div')
    routes = [makeRoute('smtb-30', '#4C97D6', 'SyöteMTB'), makeRoute('sgf-62', '#E9A13B', 'Gravel Fest')]
    polylines = [fakePolyline(), fakePolyline()]
    markerManager = { setVisibleRoutes: vi.fn() }
    map = {}
  })

  function build() {
    return new RouteVisibilityControl(
      routes, polylines as never, map as never, markerManager as never, container,
    )
  }

  it('renderöi yhden trigger-napin + yhden rivin per reitti', () => {
    build()
    expect(container.querySelectorAll('.route-vis-trigger')).toHaveLength(1)
    expect(container.querySelectorAll('.route-vis-row')).toHaveLength(2)
  })

  it('trigger näyttää aktiivilaskurin n/total', () => {
    build()
    expect(container.querySelector('.route-vis-count')!.textContent).toBe('2/2')
  })

  it('ryhmittelee tapahtumittain (group-label per tapahtuma)', () => {
    build()
    const labels = [...container.querySelectorAll('.route-vis-group-label')].map(e => e.textContent)
    expect(labels).toEqual(['SyöteMTB', 'Gravel Fest'])
  })

  it('paneeli piilossa aluksi, trigger-klikki avaa/sulkee', () => {
    build()
    const panel = container.querySelector<HTMLElement>('.route-vis-panel')!
    const trigger = container.querySelector<HTMLButtonElement>('.route-vis-trigger')!
    expect(panel.hidden).toBe(true)
    trigger.click()
    expect(panel.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    trigger.click()
    expect(panel.hidden).toBe(true)
  })

  // B92/V137: re-init (logout→login ilman reloadia) EI saa jättää tuplakontrolleja.
  it('idempotentti: kaksi rakennusta samaan containeriin → 1 trigger + N riviä', () => {
    build()
    build()
    expect(container.querySelectorAll('.route-vis-trigger')).toHaveLength(1)
    expect(container.querySelectorAll('.route-vis-row')).toHaveLength(2)
    const labels = [...container.querySelectorAll('.route-vis-label')].map(e => e.textContent)
    expect(labels).toEqual(['smtb-30', 'sgf-62'])
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
    const row = container.querySelector<HTMLButtonElement>('.route-vis-row[data-route-id="sgf-62"]')!
    row.click()
    expect(polylines[1].remove).toHaveBeenCalled()
    expect(markerManager.setVisibleRoutes).toHaveBeenLastCalledWith(['smtb-30'])
    expect(row.classList.contains('route-hidden')).toBe(true)
    expect(container.querySelector('.route-vis-count')!.textContent).toBe('1/2')
  })

  it('V6: viimeistä näkyvää reittiä ei voi piilottaa (no-op)', () => {
    build()
    container.querySelector<HTMLButtonElement>('.route-vis-row[data-route-id="sgf-62"]')!.click()
    markerManager.setVisibleRoutes.mockClear()
    const last = container.querySelector<HTMLButtonElement>('.route-vis-row[data-route-id="smtb-30"]')!
    expect(last.disabled).toBe(true)
    last.click()
    expect(markerManager.setVisibleRoutes).not.toHaveBeenCalled()
    expect(last.classList.contains('route-hidden')).toBe(false)
  })

  it('piilotetun reitin uudelleennäyttö lisää polylinen takaisin', () => {
    build()
    const row = container.querySelector<HTMLButtonElement>('.route-vis-row[data-route-id="sgf-62"]')!
    row.click()
    polylines[1].addTo.mockClear()
    row.click()
    expect(polylines[1].addTo).toHaveBeenCalled()
    expect(markerManager.setVisibleRoutes).toHaveBeenLastCalledWith(['smtb-30', 'sgf-62'])
  })

  it('getActiveRoute palauttaa ensimmäisen näkyvän reitin', () => {
    const ctrl = build()
    expect(ctrl.getActiveRoute().id).toBe('smtb-30')
    container.querySelector<HTMLButtonElement>('.route-vis-row[data-route-id="smtb-30"]')!.click()
    expect(ctrl.getActiveRoute().id).toBe('sgf-62')
  })
})
