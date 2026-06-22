import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { SignMarker, MarkerType } from '../src/logic/types'
import { createLibrary, createTemplate } from '../src/logic/sign-library'

function makeMarker(id: string, type: MarkerType): SignMarker {
  return {
    id,
    type,
    lat: 61.0,
    lon: 25.0,
    bearing: 90,
    distanceFromStart: 1000,
    routeIds: ['35km'],
    status: 'suunniteltu',
  }
}

function makeManager(markers: SignMarker[]) {
  return {
    getAll: () => markers,
    getForRoute: () => [],
    panTo: vi.fn(),
    remove: vi.fn(),
    updateStatus: vi.fn(),
    updateNote: vi.fn(),
    updateType: vi.fn(),
  }
}

function setupDom() {
  document.body.innerHTML = `
    <span id="marker-count"></span>
    <div id="marker-modal-items"></div>
  `
}

function makeLocalStorageMock(role: string) {
  const store: Record<string, string> = { 'karttamaster-role': role }
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

beforeEach(() => {
  setupDom()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('T38 — type select (V17)', () => {
  it('järjestäjä sees type select in marker list', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    const selects = document.querySelectorAll('.marker-type-select')
    expect(selects).toHaveLength(1)
  })

  it('talkoolainen does NOT see type select (V17)', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('talkoolainen'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    expect(document.querySelectorAll('.marker-type-select')).toHaveLength(0)
  })

  it('select has 4 options — one per MarkerType', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    const options = document.querySelectorAll('.marker-type-select option')
    expect(options).toHaveLength(4)
  })

  it('select pre-selects current marker type (V17)', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('m1', 'left')])
    renderMarkerList(manager as any)
    const sel = document.querySelector<HTMLSelectElement>('.marker-type-select')!
    expect(sel.value).toBe('left')
  })

  it('changing select calls manager.updateType with new type (V17)', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    const sel = document.querySelector<HTMLSelectElement>('.marker-type-select')!
    sel.value = 'left'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(manager.updateType).toHaveBeenCalledWith('m1', 'left', undefined, undefined)
  })

  it('select carries marker data-id', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('marker-abc', 'right')])
    renderMarkerList(manager as any)
    const sel = document.querySelector<HTMLSelectElement>('.marker-type-select')!
    expect(sel.dataset.id).toBe('marker-abc')
  })
})

describe('T92 — updateType color/shortLabel (V47, V48)', () => {
  it('changing to library template passes color and shortLabel to updateType', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const library = createLibrary()
    const tmpl = createTemplate(library, {
      label: 'Testi',
      shortLabel: 'T',
      color: '#ff0000',
      description: '',
      favorite: true,
    })
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any, undefined, undefined, library)
    const sel = document.querySelector<HTMLSelectElement>('.marker-type-select')!
    // select the library template option
    sel.value = tmpl.id
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(manager.updateType).toHaveBeenCalledWith('m1', tmpl.id, '#ff0000', 'T')
  })

  it('changing to built-in type passes no color/shortLabel', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const library = createLibrary()
    createTemplate(library, { label: 'Testi', shortLabel: 'T', color: '#ff0000', description: '', favorite: true })
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any, undefined, undefined, library)
    const sel = document.querySelector<HTMLSelectElement>('.marker-type-select')!
    sel.value = 'left'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(manager.updateType).toHaveBeenCalledWith('m1', 'left', undefined, undefined)
  })

  it('select shows library templates under optgroup when library provided', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const library = createLibrary()
    createTemplate(library, { label: 'Oma malli', shortLabel: 'OM', color: '#aabbcc', description: '', favorite: false })
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any, undefined, undefined, library)
    const optgroup = document.querySelector<HTMLOptGroupElement>('optgroup[label="Omat mallit"]')
    expect(optgroup).not.toBeNull()
    expect(optgroup!.querySelectorAll('option')).toHaveLength(1)
  })
})
