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
  // T104: type-select siirtyi MarkerDetailModal:iin (T105) — ei enää listarivillä
  it('type select ei näy listassa (siirtyi T105-modaaliin)', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('järjestäjä'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    expect(document.querySelectorAll('.marker-type-select')).toHaveLength(0)
  })

  it('talkoolainen does NOT see type select (V17)', () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock('talkoolainen'))
    const manager = makeManager([makeMarker('m1', 'right')])
    renderMarkerList(manager as any)
    expect(document.querySelectorAll('.marker-type-select')).toHaveLength(0)
  })

  // Type-select interaction tests → testataan T105 MarkerDetailModal-testeissä
  it.todo('select has 4 options — one per MarkerType (T105 scope)')
  it.todo('select pre-selects current marker type (V17) (T105 scope)')
  it.todo('changing select calls manager.updateType with new type (V17) (T105 scope)')
  it.todo('select carries marker data-id (T105 scope)')
})

describe('T92 — updateType color/shortLabel (V47, V48)', () => {
  // T104: type-select siirtyi MarkerDetailModal:iin (T105) — nämä testit siirtyvät T105:een
  it.todo('changing to library template passes color and shortLabel to updateType (T105 scope)')
  it.todo('changing to built-in type passes no color/shortLabel (T105 scope)')
  it.todo('select shows library templates under optgroup when library provided (T105 scope)')
})
