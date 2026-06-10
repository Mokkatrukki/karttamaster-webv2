import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(id: string, dist: number): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    bearing: 0,
    distanceFromStart: dist,
    routeIds: ['35km'],
    status: 'suunniteltu',
  }
}

function makeManager(markers: SignMarker[]): MarkerManager {
  return {
    getAll: () => markers,
    panTo: vi.fn(),
    remove: vi.fn(),
    updateNote: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
  } as unknown as MarkerManager
}

describe('T58 — renderMarkerList V33 segmentMarkerIds filter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
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

  it('without filter shows all markers', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200), makeMarker('m3', 300)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelectorAll('.marker-item').length).toBe(3)
    expect(document.getElementById('marker-count')?.textContent).toBe('3')
  })

  it('with segmentMarkerIds shows only matching markers (V33)', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200), makeMarker('m3', 300)]
    const ids = new Set(['m1', 'm3'])
    renderMarkerList(makeManager(markers), undefined, ids)
    const items = document.querySelectorAll('.marker-item')
    expect(items.length).toBe(2)
    // m2 not shown
    expect(document.querySelector('[data-id="m2"]')).toBeNull()
    expect(document.querySelector('[data-id="m1"]')).not.toBeNull()
    expect(document.querySelector('[data-id="m3"]')).not.toBeNull()
  })

  it('count reflects filtered result (V33)', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200), makeMarker('m3', 300)]
    const ids = new Set(['m2'])
    renderMarkerList(makeManager(markers), undefined, ids)
    expect(document.getElementById('marker-count')?.textContent).toBe('1')
  })

  it('empty filter set shows no markers', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200)]
    renderMarkerList(makeManager(markers), undefined, new Set())
    expect(document.querySelectorAll('.marker-item').length).toBe(0)
    expect(document.getElementById('marker-count')?.textContent).toBe('0')
  })

  it('filter with all ids = same as no filter', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200)]
    renderMarkerList(makeManager(markers), undefined, new Set(['m1', 'm2']))
    expect(document.querySelectorAll('.marker-item').length).toBe(2)
  })

  it('highlightId still works with filter', () => {
    const markers = [makeMarker('m1', 100), makeMarker('m2', 200)]
    renderMarkerList(makeManager(markers), 'm1', new Set(['m1', 'm2']))
    expect(document.querySelector('[data-id="m1"].marker-item--new')).not.toBeNull()
  })
})
