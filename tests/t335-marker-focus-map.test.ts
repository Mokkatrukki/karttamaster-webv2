// @vitest-environment jsdom
// T335/V243 — MarkerManagerin fokus-tila kartalla. Leaflet mockattuna, oikeat DOM-elementit:
// testataan mitä LUOKKIA merkin elementti kantaa, koska juuri ne ovat V243:n sopimus
// (himmennä, älä piilota) ja juuri ne katosivat aiemmin setIconin alta (V178-oppi).
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
  // Leafletin oikea `setIcon` korvaa elementin; tässä pidetään sama elementti ja tarkistetaan
  // että manager kirjoittaa luokat uudelleen (reapplyElementState) — sama havainto käyttäjälle.
  const el = document.createElement('div')
  el.appendChild(document.createElement('div')) // sisäwrapper (applyZoomScale)
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

// oma = km 0…6000 (m-in), vieras = km 9000 (m-out)
const SEGMENT = { routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 6000 }

function setup() {
  const map = { on: () => {}, getZoom: () => 13, setView: () => {} } as unknown as L.Map
  const mgr = new MarkerManager(map, ROUTES, () => {}, [marker('m-in', 1000), marker('m-out', 9000)])
  const els = (mgr as unknown as { leafletMarkers: Map<string, FakeLeafletMarker> }).leafletMarkers
  return {
    mgr,
    elIn: els.get('m-in')!.getElement(),
    elOut: els.get('m-out')!.getElement(),
  }
}

describe('MarkerManager.setFocusSegment (T335/V243)', () => {
  beforeEach(() => {
    installLeafletMock()
    setMarkerFactory((ll) => fakeMarker(ll))
    document.body.innerHTML = ''
  })

  it('fokus himmentää vieraan, EI piilota sitä', () => {
    const { mgr, elIn, elOut } = setup()
    mgr.setFocusSegment(SEGMENT)
    expect(elIn.classList.contains('marker-dimmed')).toBe(false)
    expect(elOut.classList.contains('marker-dimmed')).toBe(true)
    // V243: himmennetty on yhä kartalla — ei display:none, ei poistoa
    expect(elOut.style.display).not.toBe('none')
    expect((mgr as unknown as { leafletMarkers: Map<string, unknown> }).leafletMarkers.size).toBe(2)
  })

  it('undefined nollaa korostuksen', () => {
    const { mgr, elOut } = setup()
    mgr.setFocusSegment(SEGMENT)
    mgr.setFocusSegment(undefined)
    expect(elOut.classList.contains('marker-dimmed')).toBe(false)
    expect(mgr.hasFocusSegment()).toBe(false)
  })

  it("lock:'locked' lisää lukkoluokan — järjestäjän 'vapaa' ei (V142/V270)", () => {
    const a = setup()
    a.mgr.setFocusSegment(SEGMENT, { lock: 'locked' })
    expect(a.elOut.classList.contains('marker-dimmed--locked')).toBe(true)

    const b = setup()
    b.mgr.setFocusSegment(SEGMENT)
    expect(b.elOut.classList.contains('marker-dimmed')).toBe(true)
    expect(b.elOut.classList.contains('marker-dimmed--locked')).toBe(false)
  })

  it('status-päivitys ⊥ pudota fokus-luokkaa (setIcon korvaa elementin)', () => {
    const { mgr, elOut } = setup()
    mgr.setFocusSegment(SEGMENT, { lock: 'locked' })
    mgr.updateStatus('m-out', 'aseta')
    expect(elOut.classList.contains('marker-dimmed')).toBe(true)
    expect(elOut.classList.contains('marker-dimmed--locked')).toBe(true)
  })

  it('status-päivitys ⊥ pudota .marker-next-highlightia (V178-regressio)', () => {
    const { mgr, elIn } = setup()
    mgr.setNextHighlight('m-in')
    expect(elIn.classList.contains('marker-next-highlight')).toBe(true)
    mgr.updateStatus('m-in', 'aseta')
    expect(elIn.classList.contains('marker-next-highlight')).toBe(true)
  })

  it('reload säilyttää fokuksen (uudet elementit saavat luokan renderissä)', () => {
    const { mgr } = setup()
    mgr.setFocusSegment(SEGMENT)
    mgr.reload([marker('m-in', 1000), marker('m-out', 9000)])
    const els = (mgr as unknown as { leafletMarkers: Map<string, FakeLeafletMarker> }).leafletMarkers
    expect(els.get('m-out')!.getElement().classList.contains('marker-dimmed')).toBe(true)
    expect(els.get('m-in')!.getElement().classList.contains('marker-dimmed')).toBe(false)
  })

  it('ilman fokusta yksikään merkki ⊥ ole himmennetty', () => {
    const { mgr, elIn, elOut } = setup()
    mgr.updateStatus('m-out', 'aseta')
    expect(elIn.classList.contains('marker-dimmed')).toBe(false)
    expect(elOut.classList.contains('marker-dimmed')).toBe(false)
  })
})
