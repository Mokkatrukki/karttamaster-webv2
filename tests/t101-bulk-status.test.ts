import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(id: string, status: SignMarker['status'] = 'suunniteltu'): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: 1000,
    routeIds: ['35km'],
    status,
  }
}

function makeManager(markers: SignMarker[], bulkSetStatus = vi.fn()): MarkerManager {
  return {
    getAll: () => markers,
    panTo: vi.fn(),
    remove: vi.fn(),
    updateNote: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
    bulkSetStatus,
  } as unknown as MarkerManager
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="marker-modal">
      <div id="marker-modal-header"></div>
      <div id="marker-modal-items"></div>
    </div>
    <span id="marker-count"></span>
  `
}

function setupLocalStorage() {
  let store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
}

describe('T101 — Järjestäjän bulk status toolbar (V9, T47)', () => {
  beforeEach(() => {
    setupDOM()
    setupLocalStorage()
    // järjestäjä role (default)
    localStorage.setItem('karttamaster-role', 'järjestäjä')
  })

  it('järjestäjällä bulk toolbar näkyy', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-bulk-toolbar')).not.toBeNull()
  })

  it('talkoolaisella bulk toolbar ei näy', () => {
    localStorage.setItem('karttamaster-role', 'talkoolainen')
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-bulk-toolbar')).toBeNull()
  })

  it('marker-item-checkbox per rivi järjestäjällä', () => {
    const markers = [makeMarker('m1'), makeMarker('m2'), makeMarker('m3')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
    expect(cbs.length).toBe(3)
  })

  it('talkoolaisella ei checkboxeja riveillä', () => {
    localStorage.setItem('karttamaster-role', 'talkoolainen')
    renderMarkerList(makeManager([makeMarker('m1'), makeMarker('m2')]))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
    expect(cbs.length).toBe(0)
  })

  it('select all valitsee kaikki checkboxit', () => {
    const markers = [makeMarker('m1'), makeMarker('m2')]
    renderMarkerList(makeManager(markers))
    const selectAll = document.getElementById('bulk-select-all') as HTMLInputElement
    selectAll.click()
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
    expect(Array.from(cbs).every((cb) => cb.checked)).toBe(true)
  })

  it('Aseta-nappi disabled kun 0 valittuna', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const btn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Aseta-nappi enabled kun ≥1 valittuna', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const cb = document.querySelector<HTMLInputElement>('.marker-item-checkbox[data-id]')!
    cb.click()
    const btn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('Aseta-nappi näyttää valittujen lukumäärän', () => {
    const markers = [makeMarker('m1'), makeMarker('m2')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
    cbs[0].click()
    const btn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    expect(btn.textContent).toBe('Aseta (1)')
  })

  it('"Aseta valituille" kutsuu bulkSetStatus oikeilla id:illä ja statuksella', () => {
    const bulkFn = vi.fn()
    const markers = [makeMarker('m1'), makeMarker('m2'), makeMarker('m3')]
    renderMarkerList(makeManager(markers, bulkFn))

    // Select m1 and m3
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
    cbs[0].click() // m1
    cbs[2].click() // m3

    // Set status to 'asetettu'
    const statusSel = document.getElementById('bulk-status-select') as HTMLSelectElement
    statusSel.value = 'asetettu'

    const applyBtn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    applyBtn.click()

    expect(bulkFn).toHaveBeenCalledOnce()
    const [ids, status] = bulkFn.mock.calls[0]
    expect(ids).toContain('m1')
    expect(ids).toContain('m3')
    expect(ids).not.toContain('m2')
    expect(status).toBe('asetettu')
  })

  it('järjestäjä-modal saa modal--järjestäjä-luokan', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const modal = document.getElementById('marker-modal')
    expect(modal?.classList.contains('modal--järjestäjä')).toBe(true)
  })

  it('talkoolainen-modal ei saa modal--järjestäjä-luokkaa', () => {
    localStorage.setItem('karttamaster-role', 'talkoolainen')
    const modal = document.getElementById('marker-modal')
    modal?.classList.add('modal--järjestäjä') // pre-existing
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(modal?.classList.contains('modal--järjestäjä')).toBe(false)
  })
})
