import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wireLiveSync } from '../src/app/live-sync'
import type { EventSourceLike, ChangeEvent } from '../src/logic/sync'
import type { MarkerManager } from '../src/map/markers'

// T446(b)/V330 — SSE-heräte PÄÄSOVELLUKSELLE (kartta + pätkänäkymä).
// `startChangeStream` oli kytketty vain `/kasat`-sivulle ∴ pääsovellus näki toisen porukan
// muutokset vasta sivun latauksesta. Nämä testit suojaavat V330:n kolme sääntöä siinä muodossa
// jossa ne koskevat TÄTÄ kytkentää: heräte vain aikaistaa haun, katkos ⊥ kaada mitään, eikä
// epäonnistunut haku saa tyhjentää karttaa (V118).

type Listener = (e: { data?: string }) => void

class FakeEventSource implements EventSourceLike {
  listeners = new Map<string, Listener[]>()
  closed = false
  constructor(public url: string) {}
  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? []
    arr.push(listener)
    this.listeners.set(type, arr)
  }
  close(): void { this.closed = true }
  emit(e: Partial<ChangeEvent>): void {
    for (const l of this.listeners.get('change') ?? []) l({ data: JSON.stringify(e) })
  }
}

let es: FakeEventSource
const create = (url: string): EventSourceLike => (es = new FakeEventSource(url))

const ROW = {
  id: 'm1', type: 'right', lat: 63, lon: 27, distance_from_start: 100,
  route_ids: ['35km'], status: 'suunniteltu', location_note: null, color: null,
  label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
  description: null, images: [], created_by: null,
}

function stubFetch(impl: () => Promise<unknown>) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

const okFetch = () => stubFetch(async () => ({ ok: true, json: async () => [ROW] }))

function mount(reloadSegments = vi.fn(async () => {})) {
  const reload = vi.fn()
  const manager = { reload } as unknown as MarkerManager
  const stop = wireLiveSync({
    getMarkerManager: () => manager,
    reloadSegments,
    stream: { create, coalesceMs: 0 },
  })
  return { reload, reloadSegments, stop }
}

// Heräte → haku on asynkroninen ketju (setTimeout 0 → fetch → json). Anna sen valua läpi.
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('T446(b)/V330 — SSE-heräte pääsovelluksessa', () => {
  it('merkkiheräte hakee merkit ja syöttää ne MarkerManagerille', async () => {
    const fetchFn = okFetch()
    const { reload } = mount()

    es.emit({ type: 'marker', id: 'm1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()

    expect(fetchFn).toHaveBeenCalledWith('/api/markers')
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reload.mock.calls[0][0]).toHaveLength(1)
    expect(reload.mock.calls[0][0][0].id).toBe('m1')
  })

  it('kasaheräte kulkee samaa merkkipolkua — kasa ON merkki (V314/V331)', async () => {
    okFetch()
    const { reload } = mount()
    es.emit({ type: 'pile', id: 'kasa-1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('pätkäheräte lataa pätkät, ⊥ merkkejä', async () => {
    const fetchFn = okFetch()
    const reloadSegments = vi.fn(async () => {})
    const { reload } = mount(reloadSegments)

    es.emit({ type: 'segment', id: 'seg-1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()

    expect(reloadSegments).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('V118: epäonnistunut haku ⊥ pyyhi karttaa — reload([]) on kielletty', async () => {
    stubFetch(async () => { throw new Error('offline') })
    const { reload } = mount()

    es.emit({ type: 'marker', id: 'm1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()

    expect(reload).not.toHaveBeenCalled()
  })

  it('reload joka heittää ⊥ kaada streamia — seuraava heräte tulee yhä perille', async () => {
    okFetch()
    let calls = 0
    const manager = {
      reload: vi.fn(() => { calls++; if (calls === 1) throw new Error('render') }),
    } as unknown as MarkerManager
    wireLiveSync({ getMarkerManager: () => manager, reloadSegments: async () => {}, stream: { create, coalesceMs: 0 } })

    es.emit({ type: 'marker', id: 'm1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    es.emit({ type: 'marker', id: 'm1', rev: 2 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()

    expect(calls).toBe(2)
  })

  it('ilman EventSource-tukea kytkentä on no-op ⊥ poikkeus (V330: katkos ⊥ pysäytä mitään)', () => {
    expect(() => {
      const stop = wireLiveSync({
        getMarkerManager: () => null,
        reloadSegments: async () => {},
        stream: { create: () => { throw new Error('ei tukea') } },
      })
      stop()
      stop()
    }).not.toThrow()
  })

  it('markerManager puuttuu (init kesken) → heräte ⊥ kaada', async () => {
    okFetch()
    const stop = wireLiveSync({
      getMarkerManager: () => null,
      reloadSegments: async () => {},
      stream: { create, coalesceMs: 0 },
    })
    es.emit({ type: 'marker', id: 'm1', rev: 1 })
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(() => stop()).not.toThrow()
  })
})
