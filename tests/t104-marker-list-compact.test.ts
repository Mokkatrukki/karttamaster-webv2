import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

function makeMarker(id: string, dist: number, status: SignMarker['status'] = 'suunniteltu'): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    bearing: 45,
    distanceFromStart: dist,
    routeIds: ['35km'],
    status,
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
    bulkSetStatus: vi.fn(),
  } as unknown as MarkerManager
}

describe('T104 — kompakti merkkilista', () => {
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

  it('rivi renderöityy ilman .marker-note-inputia', () => {
    const markers = [makeMarker('m1', 1000)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.marker-note')).toBeNull()
  })

  it('järjestäjällä on .btn-delete-nappi (poisto palautettu bugikorjauksena)', () => {
    const markers = [makeMarker('m1', 1000)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.btn-delete')).not.toBeNull()
  })

  it('rivi renderöityy ilman .btn-status-primary/secondary-nappeja', () => {
    const markers = [makeMarker('m1', 1000)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.btn-status-primary')).toBeNull()
    expect(document.querySelector('.btn-status-secondary')).toBeNull()
  })

  it('rivi renderöityy ilman .marker-type-select-dropdownia', () => {
    const markers = [makeMarker('m1', 1000)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.marker-type-select')).toBeNull()
  })

  it('rivi sisältää km-tekstin', () => {
    const markers = [makeMarker('m1', 2500)]
    renderMarkerList(makeManager(markers))
    const km = document.querySelector('.marker-km')
    expect(km?.textContent).toContain('2.50 km')
  })

  it('rivi sisältää status-badgen', () => {
    const markers = [makeMarker('m1', 1000, 'asetettu')]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.marker-status--asetettu')).not.toBeNull()
  })

  it('rivi sisältää type-labelin', () => {
    const markers = [makeMarker('m1', 1000)]
    renderMarkerList(makeManager(markers))
    expect(document.querySelector('.marker-type-label')).not.toBeNull()
  })

  it('rivin klikkaus kutsuu onOpenDetail-callbackia marker id:llä', () => {
    const markers = [makeMarker('m1', 1000)]
    const onOpenDetail = vi.fn()
    renderMarkerList(makeManager(markers), undefined, undefined, null, onOpenDetail)
    const item = document.querySelector<HTMLElement>('.marker-item[data-id="m1"]')!
    item.click()
    expect(onOpenDetail).toHaveBeenCalledWith('m1')
  })

  it('ilman onOpenDetail-callbackia klikkaus kutsuu manager.panTo', () => {
    const markers = [makeMarker('m1', 1000)]
    const manager = makeManager(markers)
    renderMarkerList(manager, undefined, undefined, null)
    const item = document.querySelector<HTMLElement>('.marker-item[data-id="m1"]')!
    item.click()
    expect(manager.panTo).toHaveBeenCalledWith('m1')
  })

  it('checkbox-klikkaus ei kutsu onOpenDetail', () => {
    const markers = [makeMarker('m1', 1000)]
    const onOpenDetail = vi.fn()
    // järjestäjä-rooli (default) → checkbox näkyy
    renderMarkerList(makeManager(markers), undefined, undefined, null, onOpenDetail)
    const cb = document.querySelector<HTMLInputElement>('.marker-item-checkbox[data-id="m1"]')
    cb?.click()
    expect(onOpenDetail).not.toHaveBeenCalled()
  })
})
