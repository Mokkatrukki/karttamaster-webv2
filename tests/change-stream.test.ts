import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startChangeStream, type EventSourceLike, type ChangeEvent } from '../src/logic/sync'

// T446/V330: SSE-heräte on KIIHDYTIN. Näiden testien tehtävä on suojata kolme sääntöä:
// heräte ei kanna dataa, katkos ei kaada mitään, ja purskeesta tulee yksi haku.

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
  emit(type: string, data?: string): void {
    for (const l of this.listeners.get(type) ?? []) l({ data })
  }
}

let es: FakeEventSource
const create = (url: string): EventSourceLike => (es = new FakeEventSource(url))

function change(e: Partial<ChangeEvent>): string {
  return JSON.stringify(e)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('startChangeStream (T446/V330)', () => {
  it('herättää haun muutostapahtumasta', () => {
    const onWake = vi.fn()
    startChangeStream({ onWake, create })

    es.emit('change', change({ type: 'pile', id: 'kasa-1', rev: 1 }))
    expect(onWake).not.toHaveBeenCalled() // niputus: ei vielä
    vi.advanceTimersByTime(300)

    expect(onWake).toHaveBeenCalledTimes(1)
    expect(onWake.mock.calls[0][0]).toEqual([{ type: 'pile', id: 'kasa-1', rev: 1 }])
  })

  it('niputtaa purskeen yhdeksi herätteeksi (kasan varaus koskee montaa merkkiä)', () => {
    const onWake = vi.fn()
    startChangeStream({ onWake, create })

    es.emit('change', change({ type: 'marker', id: 'a', rev: 1 }))
    es.emit('change', change({ type: 'marker', id: 'b', rev: 2 }))
    es.emit('change', change({ type: 'pile', id: 'c', rev: 3 }))
    vi.advanceTimersByTime(300)

    expect(onWake).toHaveBeenCalledTimes(1)
    expect(onWake.mock.calls[0][0]).toHaveLength(3)
  })

  it('pudottaa duplikaatit/vanhentuneet revit (reconnect toistaa)', () => {
    const onWake = vi.fn()
    startChangeStream({ onWake, create })

    es.emit('change', change({ type: 'marker', id: 'a', rev: 5 }))
    vi.advanceTimersByTime(300)
    es.emit('change', change({ type: 'marker', id: 'a', rev: 5 }))
    es.emit('change', change({ type: 'marker', id: 'a', rev: 3 }))
    vi.advanceTimersByTime(300)

    expect(onWake).toHaveBeenCalledTimes(1)
  })

  it('vioittunut payload ⊥ kaada — pollaus tuo saman muutoksen joka tapauksessa', () => {
    const onWake = vi.fn()
    startChangeStream({ onWake, create })

    expect(() => es.emit('change', '{ ei-jsonia')).not.toThrow()
    expect(() => es.emit('change', change({ id: 'a' }))).not.toThrow() // rev puuttuu
    expect(() => es.emit('change', undefined)).not.toThrow()
    vi.advanceTimersByTime(300)

    expect(onWake).not.toHaveBeenCalled()
  })

  it('error-tapahtuma (yhteys poikki) ⊥ kaada eikä sulje — selain hoitaa reconnectin', () => {
    const onWake = vi.fn()
    startChangeStream({ onWake, create })

    expect(() => es.emit('error')).not.toThrow()
    expect(es.closed).toBe(false)

    // Yhteyden palattua sama instanssi jatkaa herättämistä.
    es.emit('change', change({ type: 'marker', id: 'a', rev: 1 }))
    vi.advanceTimersByTime(300)
    expect(onWake).toHaveBeenCalledTimes(1)
  })

  it('ilman EventSource-tukea palautuu no-op eikä heitä (V330: ⊥ pysäytä mitään)', () => {
    const onWake = vi.fn()
    let stop!: () => void
    expect(() => { stop = startChangeStream({ onWake }) }).not.toThrow() // ei EventSourcea nodessa
    expect(() => stop()).not.toThrow()
    expect(onWake).not.toHaveBeenCalled()
  })

  it('konstruktorin heitto (esim. estetty yhteys) ⊥ vuoda soittajalle', () => {
    const stop = startChangeStream({
      onWake: vi.fn(),
      create: () => { throw new Error('blocked') },
    })
    expect(() => stop()).not.toThrow()
  })

  it('onWaken virhe ⊥ kaada streamia — hakupolun virhe on hakupolun asia', () => {
    const onWake = vi.fn(() => { throw new Error('fetch kaatui') })
    startChangeStream({ onWake, create })

    es.emit('change', change({ type: 'marker', id: 'a', rev: 1 }))
    expect(() => vi.advanceTimersByTime(300)).not.toThrow()

    es.emit('change', change({ type: 'marker', id: 'b', rev: 2 }))
    vi.advanceTimersByTime(300)
    expect(onWake).toHaveBeenCalledTimes(2)
  })

  it('stop sulkee yhteyden eikä herätä enää (idempotentti)', () => {
    const onWake = vi.fn()
    const stop = startChangeStream({ onWake, create })

    es.emit('change', change({ type: 'marker', id: 'a', rev: 1 }))
    stop()
    stop()
    vi.advanceTimersByTime(1000)

    expect(es.closed).toBe(true)
    expect(onWake).not.toHaveBeenCalled()
  })

  it('avaa oletuksena /api/stream', () => {
    startChangeStream({ onWake: vi.fn(), create })
    expect(es.url).toBe('/api/stream')
  })
})
