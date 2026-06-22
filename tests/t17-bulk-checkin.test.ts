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
    bearing: 0,
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

function setupTalkoolainen() {
  let store: Record<string, string> = { 'karttamaster-role': 'talkoolainen' }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
}

describe('T17 — Talkoolaisen bulk check-in (V9, T10, T14, T58)', () => {
  beforeEach(() => {
    setupDOM()
    setupTalkoolainen()
  })

  it('talkoolaisella BulkActionBar näkyy', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-bulk-action-bar')).not.toBeNull()
  })

  it('järjestäjällä BulkActionBar ei näy', () => {
    let store: Record<string, string> = { 'karttamaster-role': 'järjestäjä' }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-bulk-action-bar')).toBeNull()
  })

  it('ei-terminal merkeillä on checkbox', () => {
    const markers = [makeMarker('m1', 'suunniteltu'), makeMarker('m2', 'asetettu')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    expect(cbs.length).toBe(2)
  })

  it('terminal merkillä (kerätty) ei ole checkboxia', () => {
    const markers = [makeMarker('m1', 'suunniteltu'), makeMarker('m2', 'kerätty')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    expect(cbs.length).toBe(1)
    expect(document.querySelector('.marker-checkin-cb[data-id="m2"]')).toBeNull()
  })

  it('ei_tarpeen ei ole terminal — saa checkboxin (peru-siirtymä olemassa)', () => {
    const markers = [makeMarker('m1', 'ei_tarpeen'), makeMarker('m2', 'suunniteltu')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    expect(cbs.length).toBe(2)
    expect(document.querySelector('.marker-checkin-cb[data-id="m1"]')).not.toBeNull()
  })

  it('select all valitsee kaikki ei-terminal checkboxit', () => {
    const markers = [makeMarker('m1'), makeMarker('m2'), makeMarker('m3', 'kerätty')]
    renderMarkerList(makeManager(markers))
    const selectAll = document.getElementById('bulk-checkin-select-all') as HTMLInputElement
    selectAll.click()
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    expect(Array.from(cbs).every((cb) => cb.checked)).toBe(true)
  })

  it('Aseta-nappi disabled kun 0 valittuna', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const btn = document.getElementById('btn-bulk-checkin-aseta') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Aseta-nappi enabled kun ≥1 valittuna', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const cb = document.querySelector<HTMLInputElement>('.marker-checkin-cb[data-id]')!
    cb.click()
    const btn = document.getElementById('btn-bulk-checkin-aseta') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('Ei tarpeen -nappi enabled kun ≥1 valittuna', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    const cb = document.querySelector<HTMLInputElement>('.marker-checkin-cb[data-id]')!
    cb.click()
    const btn = document.getElementById('btn-bulk-checkin-ohita') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('"Aseta valituille" kutsuu bulkSetStatus oikeilla id:illä statuksella asetettu', () => {
    const bulkFn = vi.fn()
    const markers = [makeMarker('m1'), makeMarker('m2'), makeMarker('m3', 'kerätty')]
    renderMarkerList(makeManager(markers, bulkFn))

    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    cbs[0].click() // m1
    cbs[1].click() // m2

    document.getElementById('btn-bulk-checkin-aseta')!.click()

    expect(bulkFn).toHaveBeenCalledOnce()
    const [ids, status] = bulkFn.mock.calls[0]
    expect(ids).toContain('m1')
    expect(ids).toContain('m2')
    expect(ids).not.toContain('m3')
    expect(status).toBe('asetettu')
  })

  it('"Ei tarpeen" kutsuu bulkSetStatus statuksella ei_tarpeen', () => {
    const bulkFn = vi.fn()
    const markers = [makeMarker('m1'), makeMarker('m2')]
    renderMarkerList(makeManager(markers, bulkFn))

    document.getElementById('bulk-checkin-select-all')!.click()
    document.getElementById('btn-bulk-checkin-ohita')!.click()

    expect(bulkFn).toHaveBeenCalledOnce()
    const [ids, status] = bulkFn.mock.calls[0]
    expect(ids.length).toBe(2)
    expect(status).toBe('ei_tarpeen')
  })

  it('napit näyttävät valittujen lukumäärän', () => {
    const markers = [makeMarker('m1'), makeMarker('m2')]
    renderMarkerList(makeManager(markers))
    const cbs = document.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
    cbs[0].click()
    expect(document.getElementById('btn-bulk-checkin-aseta')?.textContent).toBe('✓ Aseta (1)')
    expect(document.getElementById('btn-bulk-checkin-ohita')?.textContent).toBe('Ei tarpeen (1)')
  })
})
