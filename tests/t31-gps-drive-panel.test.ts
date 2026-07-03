import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GpsDrivePanel } from '../src/ui/gps-drive-panel'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1',
    type: 'right',
    lat: 0, lon: 0,
    distanceFromStart: 1000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

describe('GpsDrivePanel', () => {
  let el: HTMLElement
  let driveMock: { currentKm: ReturnType<typeof vi.fn>; jumpToDistance: ReturnType<typeof vi.fn> }
  let managerMock: { getAll: ReturnType<typeof vi.fn>; updateStatus: ReturnType<typeof vi.fn> }
  let panel: GpsDrivePanel

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gps-drive-panel" hidden>
        <div id="gdp-info">
          <span id="gdp-dist"></span>
          <span id="gdp-label"></span>
        </div>
        <div id="gdp-actions">
          <button id="gdp-jump">⇒ Seuraava</button>
          <button id="gdp-aseta">✓ Aseta</button>
          <button id="gdp-ohita">Ei tarpeen</button>
        </div>
      </div>
    `
    el = document.getElementById('gps-drive-panel')!
    driveMock = { currentKm: vi.fn().mockReturnValue(0), jumpToDistance: vi.fn() }
    managerMock = { getAll: vi.fn().mockReturnValue([]), updateStatus: vi.fn() }
    panel = new GpsDrivePanel(el, driveMock as any, managerMock as any, () => '35km')
  })

  it('hides panel when no unset markers on route', () => {
    managerMock.getAll.mockReturnValue([])
    panel.update(0)
    expect(el.hidden).toBe(true)
  })

  it('hides panel when all markers are terminal', () => {
    managerMock.getAll.mockReturnValue([makeMarker({ status: 'asetettu' })])
    panel.update(0)
    expect(el.hidden).toBe(true)
  })

  it('shows panel with nearest unset marker', () => {
    managerMock.getAll.mockReturnValue([makeMarker()])
    panel.update(0)
    expect(el.hidden).toBe(false)
    expect(document.getElementById('gdp-label')!.textContent).toContain('1.00 km')
  })

  it('shows distance in meters when < 1km away', () => {
    managerMock.getAll.mockReturnValue([makeMarker({ distanceFromStart: 500 })])
    panel.update(0.3) // 300m current → 200m away
    expect(el.hidden).toBe(false)
    expect(document.getElementById('gdp-dist')!.textContent).toMatch(/m$/)
  })

  it('gdp-near class applied when < 200m', () => {
    managerMock.getAll.mockReturnValue([makeMarker({ distanceFromStart: 100 })])
    panel.update(0) // 100m away → near
    expect(el.classList.contains('gdp-near')).toBe(true)
  })

  it('gdp-near class removed when > 200m', () => {
    managerMock.getAll.mockReturnValue([makeMarker({ distanceFromStart: 1000 })])
    panel.update(0) // 1000m away
    expect(el.classList.contains('gdp-near')).toBe(false)
  })

  it('jump button calls driveMode.jumpToDistance with marker distanceFromStart', () => {
    managerMock.getAll.mockReturnValue([makeMarker({ distanceFromStart: 2500 })])
    driveMock.currentKm.mockReturnValue(0)
    document.getElementById('gdp-jump')!.click()
    expect(driveMock.jumpToDistance).toHaveBeenCalledWith(2500)
  })

  it('aseta button calls manager.updateStatus with aseta', () => {
    managerMock.getAll.mockReturnValue([makeMarker()])
    panel.update(0)
    document.getElementById('gdp-aseta')!.click()
    expect(managerMock.updateStatus).toHaveBeenCalledWith('m1', 'aseta')
  })

  it('ohita button calls manager.updateStatus with ohita', () => {
    managerMock.getAll.mockReturnValue([makeMarker()])
    panel.update(0)
    document.getElementById('gdp-ohita')!.click()
    expect(managerMock.updateStatus).toHaveBeenCalledWith('m1', 'ohita')
  })

  it('no updateStatus called when no nearestId set', () => {
    managerMock.getAll.mockReturnValue([])
    panel.update(0) // hides, nearestId = null
    document.getElementById('gdp-aseta')!.click()
    expect(managerMock.updateStatus).not.toHaveBeenCalled()
  })
})
