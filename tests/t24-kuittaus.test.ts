import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'test-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    bearing: 90,
    distanceFromStart: 1000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

function makeMockManager(markers: SignMarker[] = []): MarkerManager {
  return {
    getAll: () => markers,
    panTo: vi.fn(),
    remove: vi.fn(),
    updateNote: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as MarkerManager
}

function setupDOM() {
  document.body.innerHTML = `
    <span id="marker-count"></span>
    <div id="marker-modal-items"></div>
  `
}

describe('T24 — talkoolaisen kuittaus-UI', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
    setupDOM()
  })

  describe('järjestäjä-rooli (oletus)', () => {
    it('ei näytä action-nappeja', () => {
      const manager = makeMockManager([makeMarker()])
      renderMarkerList(manager)
      expect(document.querySelector('.btn-status-primary')).toBeNull()
      expect(document.querySelector('.btn-status-secondary')).toBeNull()
    })

    it('näyttää status-badgen', () => {
      const manager = makeMockManager([makeMarker({ status: 'suunniteltu' })])
      renderMarkerList(manager)
      expect(document.querySelector('.marker-status')).not.toBeNull()
    })
  })

  describe('talkoolainen-rooli', () => {
    beforeEach(() => {
      store['karttamaster-role'] = 'talkoolainen'
    })

    // T104: action-napit siirtyivät MarkerDetailModal:iin (T105) — ei enää listarivillä
    it('suunniteltu: ei action-nappeja listassa (siirtyi T105-modaaliin)', () => {
      const manager = makeMockManager([makeMarker({ status: 'suunniteltu' })])
      renderMarkerList(manager)
      expect(document.querySelector('.btn-status-primary')).toBeNull()
      expect(document.querySelector('.btn-status-secondary')).toBeNull()
    })

    it('asetettu: ei action-nappeja listassa (siirtyi T105-modaaliin)', () => {
      const manager = makeMockManager([makeMarker({ status: 'asetettu' })])
      renderMarkerList(manager)
      expect(document.querySelector('.btn-status-primary')).toBeNull()
    })

    it('kerätty (terminal): ei action-nappeja', () => {
      const manager = makeMockManager([makeMarker({ status: 'kerätty' })])
      renderMarkerList(manager)
      expect(document.querySelector('.btn-status-primary')).toBeNull()
    })

    // Status action interaction → testataan T105 MarkerDetailModal-testeissä
    it.todo('Aseta-nappi kutsuu updateStatus aseta-toiminnolla (T105 scope)')
    it.todo('Ei tarpeen -nappi kutsuu updateStatus ohita-toiminnolla (T105 scope)')

    it('ei action-nappeja per merkki', () => {
      const manager = makeMockManager([makeMarker({ status: 'suunniteltu' })])
      renderMarkerList(manager)
      const btns = document.querySelectorAll('.marker-actions button')
      expect(btns.length).toBe(0)
    })

    it('status-badge näyttää oikean statuksen', () => {
      const manager = makeMockManager([makeMarker({ status: 'asetettu' })])
      renderMarkerList(manager)
      const badge = document.querySelector('.marker-status')
      expect(badge?.textContent).toBe('Asetettu')
      expect(badge?.classList.contains('marker-status--asetettu')).toBe(true)
    })
  })
})
