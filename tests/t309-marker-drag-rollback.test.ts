import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SignMarker, RoutePoint } from '../src/logic/types'

// T309/V220: MarkerManagerin dragend-polku päästä päähän — Leaflet ja outbox mockattuna.
// Tämä on se kanava jossa B121 eli: optimistinen mutaatio ilman rollbackia → merkki putosi
// resolveTaskMarkers-jäsenyydestä → hero tyhjeni & merkki muuttui ei-raahattavaksi.

interface FakeLeafletMarker {
  ll: [number, number]
  handlers: Record<string, (...a: unknown[]) => void>
  setLatLngCalls: Array<[number, number]>
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
  const fm: FakeLeafletMarker = {
    ll,
    handlers: {},
    setLatLngCalls: [],
    addTo: () => fm,
    on: (ev, fn) => { fm.handlers[ev] = fn; return fm },
    getLatLng: () => ({ lat: fm.ll[0], lng: fm.ll[1] }),
    setLatLng: (next) => { fm.ll = [next[0], next[1]]; fm.setLatLngCalls.push([next[0], next[1]]); return fm },
    getElement: () => el,
    remove: () => {},
    setIcon: () => {},
    dragging: { enable: () => {}, disable: () => {} },
  }
  return fm
}

vi.mock('leaflet', () => ({
  default: {
    marker: (ll: [number, number]) => fakeMarker(ll),
    DomEvent: { stopPropagation: () => {} },
  },
}))
vi.mock('../src/map/icons', () => ({ createSignIcon: () => ({}) }))

const enqueue = vi.fn<(input: unknown) => Promise<{ delivered: boolean; status: number | null }>>()
vi.mock('../src/logic/outbox-instance', () => ({
  outbox: { enqueue: (input: unknown) => enqueue(input) },
  setOutboxSaveErrorHandler: () => {},
}))

const { MarkerManager } = await import('../src/map/markers')

// Jaettu osuus: sama polku, r1 km 0…10000, r2 km 40000…50000 (B121-asetelma).
const PATH = [
  { lat: 65.0, lon: 25.0 },
  { lat: 65.05, lon: 25.05 },
  { lat: 65.1, lon: 25.1 },
]
const ROUTES = [
  { id: 'r1', routePoints: PATH.map((p, i) => ({ ...p, distanceFromStart: i * 5000 })) as RoutePoint[] },
  { id: 'r2', routePoints: PATH.map((p, i) => ({ ...p, distanceFromStart: 40000 + i * 5000 })) as RoutePoint[] },
]

function marker(): SignMarker {
  return {
    id: 'm1', type: 'nuoli', lat: 65.1, lon: 25.1,
    distanceFromStart: 50000,
    distanceByRoute: { r1: [10000], r2: [50000] },
    routeIds: ['r1', 'r2'],
    status: 'suunniteltu',
  }
}

function setup(status: number | null) {
  enqueue.mockReset()
  enqueue.mockResolvedValue({ delivered: status !== null && status >= 200 && status < 300, status })
  const m = marker()
  const onUpdate = vi.fn()
  const onSaveError = vi.fn()
  const map = { on: () => {}, getZoom: () => 13, setView: () => {} } as unknown as L.Map
  const mgr = new MarkerManager(map, ROUTES, onUpdate, [m], undefined, onSaveError)
  // pätkän km-akseli (V221) = r2
  mgr.setKmAxisRouteFn(() => 'r2')
  const lm = (mgr as unknown as { leafletMarkers: Map<string, FakeLeafletMarker> }).leafletMarkers.get('m1')!
  return { m, mgr, lm, onUpdate, onSaveError }
}

async function drag(lm: FakeLeafletMarker, to: [number, number]): Promise<void> {
  lm.setLatLng(to)
  lm.setLatLngCalls.length = 0
  lm.handlers.dragend()
  await new Promise((r) => setTimeout(r, 0))
}

describe('T309/V220 — dragend + serverin hylkäys', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('403 → merkin kentät palautetaan, Leaflet-marker takaisin, varoitus näkyy', async () => {
    const { m, lm, onUpdate, onSaveError } = setup(403)
    await drag(lm, [65.0, 25.0])

    expect(m.lat).toBe(65.1)
    expect(m.lon).toBe(25.1)
    expect(m.distanceFromStart).toBe(50000)
    expect(m.distanceByRoute).toEqual({ r1: [10000], r2: [50000] })
    expect(m.routeIds).toEqual(['r1', 'r2'])
    expect(lm.setLatLngCalls).toEqual([[65.1, 25.1]])
    // optimistinen render + rollback-render
    expect(onUpdate).toHaveBeenCalledTimes(2)
    expect(onSaveError).toHaveBeenCalledWith('⚠ Siirto ei sallittu — merkki palautettiin')
  })

  it('offline (verkkovirhe, status null) EI rollbackaa — kirjoitus on jonossa', async () => {
    const { m, lm, onUpdate, onSaveError } = setup(null)
    await drag(lm, [65.0, 25.0])

    expect(m.lat).toBe(65.0)
    expect(m.distanceFromStart).toBe(40000)
    expect(lm.setLatLngCalls).toEqual([])
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('5xx EI rollbackaa (ohimenevä, retry hoitaa)', async () => {
    const { m, lm, onSaveError } = setup(503)
    await drag(lm, [65.0, 25.0])
    expect(m.distanceFromStart).toBe(40000)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('200 → uusi tila jää voimaan, km pätkän primary-reitiltä (V221)', async () => {
    const { m, lm, onUpdate, onSaveError } = setup(200)
    await drag(lm, [65.05, 25.05])

    expect(m.lat).toBe(65.05)
    // vanha sääntö (lähin yli kaikkien reittien) olisi kirjoittanut r1:n 5000:n
    expect(m.distanceFromStart).toBe(45000)
    expect(m.distanceByRoute).toEqual({ r1: [5000], r2: [45000] })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('PUT-payload sisältää samat km-kentät jotka muistitilaan kirjoitettiin (V213)', async () => {
    const { lm } = setup(200)
    await drag(lm, [65.05, 25.05])
    const body = JSON.parse((enqueue.mock.calls.at(-1)![0] as { body: string }).body)
    expect(body.distance_from_start).toBe(45000)
    expect(body.distance_by_route).toEqual({ r1: [5000], r2: [45000] })
    expect(body.route_ids).toEqual(['r1', 'r2'])
  })
})
