import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(id: string, dist: number): SignMarker {
  return { id, type: 'right', lat: 0, lon: 0, distanceFromStart: dist, routeIds: ['35km'], status: 'suunniteltu' }
}

function makeManager(markers: SignMarker[]): MarkerManager {
  return {
    getAll: () => markers,
    panTo: vi.fn(),
    remove: vi.fn(),
    updateStatus: vi.fn(),
    bulkSetStatus: vi.fn(),
  } as unknown as MarkerManager
}

// T185/V117: vahvistamaton kirjoitus (outboxissa) näkyy listalla persistentisti.
describe('T185 — pending/unsaved visuaalinen tila (V117)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="marker-modal"></div>
      <span id="marker-count"></span>
      <div id="marker-modal-items"></div>
    `
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
  })

  it('pending-id → rivillä marker-item--pending + tallentamatta-tagi', () => {
    const mgr = makeManager([makeMarker('a', 1000), makeMarker('b', 2000)])
    renderMarkerList(mgr, undefined, undefined, null, undefined, new Set(['a']))

    const rowA = document.querySelector('.marker-item[data-id="a"]')!
    const rowB = document.querySelector('.marker-item[data-id="b"]')!
    expect(rowA.classList.contains('marker-item--pending')).toBe(true)
    expect(rowA.querySelector('.marker-pending-tag')).not.toBeNull()
    // ei-pending rivi ei saa korostusta
    expect(rowB.classList.contains('marker-item--pending')).toBe(false)
    expect(rowB.querySelector('.marker-pending-tag')).toBeNull()
  })

  it('tyhjä/undefined pending-joukko → ei yhtään pending-korostusta', () => {
    const mgr = makeManager([makeMarker('a', 1000)])
    renderMarkerList(mgr, undefined, undefined, null, undefined)
    expect(document.querySelector('.marker-item--pending')).toBeNull()
    expect(document.querySelector('.marker-pending-tag')).toBeNull()

    renderMarkerList(mgr, undefined, undefined, null, undefined, new Set())
    expect(document.querySelector('.marker-item--pending')).toBeNull()
  })

  it('vahvistus (avain poistuu joukosta) → korostus katoaa re-renderillä', () => {
    const mgr = makeManager([makeMarker('a', 1000)])
    renderMarkerList(mgr, undefined, undefined, null, undefined, new Set(['a']))
    expect(document.querySelector('.marker-item--pending')).not.toBeNull()
    // 2xx vahvistaa → avain poistuu → uudelleenpiirto ilman korostusta
    renderMarkerList(mgr, undefined, undefined, null, undefined, new Set())
    expect(document.querySelector('.marker-item--pending')).toBeNull()
  })
})
