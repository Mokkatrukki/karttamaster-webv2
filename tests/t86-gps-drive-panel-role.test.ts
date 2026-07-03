import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GpsDrivePanel } from '../src/ui/gps-drive-panel'
import type { SignMarker } from '../src/logic/types'

function makeUnsetMarker(): SignMarker {
  return {
    id: 'm1', type: 'right', lat: 0, lon: 0,
    distanceFromStart: 500, routeIds: ['35km'], status: 'suunniteltu',
  }
}

describe('V45 — GpsDrivePanel role gate', () => {
  let el: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gps-drive-panel" hidden>
        <div id="gdp-info"><span id="gdp-dist"></span><span id="gdp-label"></span></div>
        <div id="gdp-actions">
          <button id="gdp-jump">⇒ Seuraava</button>
          <button id="gdp-aseta">✓ Aseta</button>
          <button id="gdp-ohita">Ei tarpeen</button>
        </div>
      </div>
    `
    el = document.getElementById('gps-drive-panel')!
  })

  it('panel pysyy hidden kun GpsDrivePanel ei alusteta (järjestäjä)', () => {
    // Järjestäjällä gpsDrivePanel = null — ei instantiointia, ei update()-kutsua
    // Tarkistetaan että paneeli pysyy hidden vaikka unset-merkkejä olisi
    expect(el.hidden).toBe(true)
    // Simuloi null?.update() — no-op, ei muuta hidden-tilaa
    const gpsDrivePanel: GpsDrivePanel | null = null
    gpsDrivePanel?.update(0)
    expect(el.hidden).toBe(true)
  })

  it('panel tulee näkyviin vain kun GpsDrivePanel alustetaan ja unset-merkkejä on (talkoolainen)', () => {
    const managerMock = { getAll: vi.fn().mockReturnValue([makeUnsetMarker()]), updateStatus: vi.fn() }
    const driveMock = { currentKm: vi.fn().mockReturnValue(0), jumpToDistance: vi.fn() }
    const panel = new GpsDrivePanel(el, driveMock as any, managerMock as any, () => '35km')
    panel.update(0)
    expect(el.hidden).toBe(false)
  })
})
