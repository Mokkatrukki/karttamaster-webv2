// @vitest-environment jsdom
// T416/V306: himmennetty merkki ottaa TASAN YHDEN toiminnon. Testit vahtivat KOLMIARVOISUUTTA
// (vapaa | claimable | locked) & sitä että claimable-klikki EI mene detail-modaalin väylään —
// juuri se sekaannus antaisi talkoolaiselle muokkauspinnan vieraaseen merkkiin (V150/V93).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SignMarker, RoutePoint } from '../src/logic/types'

interface FakeLeafletMarker {
  ll: [number, number]
  handlers: Record<string, (...a: unknown[]) => void>
  addTo: () => FakeLeafletMarker
  on: (ev: string, fn: (...a: unknown[]) => void) => FakeLeafletMarker
  getLatLng: () => { lat: number; lng: number }
  setLatLng: (ll: [number, number]) => FakeLeafletMarker
  getElement: () => HTMLElement
  remove: () => void
  setIcon: () => void
  dragging: { enable: () => void; disable: () => void }
}

function fakeMarker(ll: [number, number]): FakeLeafletMarker {
  const el = document.createElement('div')
  el.appendChild(document.createElement('div'))
  const fm: FakeLeafletMarker = {
    ll,
    handlers: {},
    addTo: () => fm,
    on: (ev, fn) => { fm.handlers[ev] = fn; return fm },
    getLatLng: () => ({ lat: fm.ll[0], lng: fm.ll[1] }),
    setLatLng: (next) => { fm.ll = [next[0], next[1]]; return fm },
    getElement: () => el,
    remove: () => {},
    setIcon: () => {},
    dragging: { enable: () => {}, disable: () => {} },
  }
  return fm
}

vi.mock('leaflet', async () => ({ default: (await import('./helpers/leaflet-mock')).L }))
import { installLeafletMock, setMarkerFactory } from './helpers/leaflet-mock'

vi.mock('../src/logic/outbox-instance', () => ({
  outbox: { enqueue: () => Promise.resolve({ delivered: true, status: 200 }) },
  setOutboxSaveErrorHandler: () => {},
}))

const { MarkerManager } = await import('../src/map/markers')

const PATH = [
  { lat: 65.0, lon: 25.0 },
  { lat: 65.05, lon: 25.05 },
  { lat: 65.1, lon: 25.1 },
]
const ROUTES = [
  { id: 'r1', routePoints: PATH.map((p, i) => ({ ...p, distanceFromStart: i * 5000 })) as RoutePoint[] },
]

function marker(id: string, dist: number): SignMarker {
  return {
    id, type: 'nuoli', lat: 65.0, lon: 25.0,
    distanceFromStart: dist,
    distanceByRoute: { r1: [dist] },
    routeIds: ['r1'],
    status: 'suunniteltu',
  }
}

/** oma = km 0…6000, vieras = km 9000 (fokuksen ulkopuolella → himmeä) */
const SEGMENT = { routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 6000 }

function setup() {
  const map = { on: () => {}, getZoom: () => 13, setView: () => {} } as unknown as L.Map
  const mgr = new MarkerManager(map, ROUTES, () => {}, [marker('m-in', 1000), marker('m-out', 9000)])
  const els = (mgr as unknown as { leafletMarkers: Map<string, FakeLeafletMarker> }).leafletMarkers
  return {
    mgr,
    lmIn: els.get('m-in')!,
    lmOut: els.get('m-out')!,
    elIn: els.get('m-in')!.getElement(),
    elOut: els.get('m-out')!.getElement(),
  }
}

beforeEach(() => {
  installLeafletMock()
  setMarkerFactory((ll) => fakeMarker(ll))
  document.body.innerHTML = ''
})

describe('T416/V306 — claimable on kolmas tila, ⊥ lukon puute', () => {
  it("claimable + kytketty käsittelijä → oma luokka, EI --locked", () => {
    const s = setup()
    s.mgr.setClaimHandler(() => {})
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    expect(s.elOut.classList.contains('marker-dimmed')).toBe(true)
    expect(s.elOut.classList.contains('marker-dimmed--claimable')).toBe(true)
    expect(s.elOut.classList.contains('marker-dimmed--locked')).toBe(false)
  })

  it('claimable ILMAN käsittelijää käyttäytyy kuin locked (kyky on opt-in)', () => {
    const s = setup()
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    expect(s.elOut.classList.contains('marker-dimmed--claimable')).toBe(false)
    expect(s.elOut.classList.contains('marker-dimmed--locked')).toBe(true)
  })

  it('oma merkki ⊥ saa claimable-luokkaa (se on jo tehtävässä)', () => {
    const s = setup()
    s.mgr.setClaimHandler(() => {})
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    expect(s.elIn.classList.contains('marker-dimmed--claimable')).toBe(false)
    expect(s.elIn.classList.contains('marker-dimmed')).toBe(false)
  })

  it("järjestäjän 'vapaa' ⊥ saa claimablea eikä lukkoa", () => {
    const s = setup()
    s.mgr.setClaimHandler(() => {})
    s.mgr.setFocusSegment(SEGMENT, { lock: 'vapaa' })
    expect(s.elOut.classList.contains('marker-dimmed--claimable')).toBe(false)
    expect(s.elOut.classList.contains('marker-dimmed--locked')).toBe(false)
  })
})

describe('T416/V306 — klikkiväylä', () => {
  it('himmeän merkin klikki menee claim-käsittelijään, EI detail-modaaliin', () => {
    const s = setup()
    const claim = vi.fn()
    const detail = vi.fn()
    s.mgr.setClaimHandler(claim)
    s.mgr.setOnMarkerClick(detail)
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    s.lmOut.handlers.click?.({ originalEvent: new MouseEvent('click') })
    expect(claim).toHaveBeenCalledWith('m-out')
    expect(detail).not.toHaveBeenCalled()
  })

  it('OMAN merkin klikki menee detail-modaaliin normaalisti', () => {
    const s = setup()
    const claim = vi.fn()
    const detail = vi.fn()
    s.mgr.setClaimHandler(claim)
    s.mgr.setOnMarkerClick(detail)
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    s.lmIn.handlers.click?.({ originalEvent: new MouseEvent('click') })
    expect(detail).toHaveBeenCalledWith('m-in')
    expect(claim).not.toHaveBeenCalled()
  })

  it('status-päivitys ⊥ pudota claimable-luokkaa (setIcon korvaa elementin)', () => {
    const s = setup()
    s.mgr.setClaimHandler(() => {})
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    s.mgr.updateStatus('m-out', 'aseta')
    expect(s.elOut.classList.contains('marker-dimmed--claimable')).toBe(true)
  })

  it('fokuksen nollaus poistaa claimablen ∴ klikki palaa detail-väylään', () => {
    const s = setup()
    const claim = vi.fn()
    const detail = vi.fn()
    s.mgr.setClaimHandler(claim)
    s.mgr.setOnMarkerClick(detail)
    s.mgr.setFocusSegment(SEGMENT, { lock: 'claimable' })
    s.mgr.setFocusSegment(undefined)
    s.lmOut.handlers.click?.({ originalEvent: new MouseEvent('click') })
    expect(detail).toHaveBeenCalledWith('m-out')
    expect(claim).not.toHaveBeenCalled()
  })
})
