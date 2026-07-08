import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WriteOutbox } from '../src/logic/write-outbox'

function memStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    _map: m,
  }
}

const KEY = 'karttamaster-outbox'

describe('T183/V116: WriteOutbox', () => {
  let storage: ReturnType<typeof memStorage>

  beforeEach(() => {
    storage = memStorage()
  })

  it('enqueue persistoi jonon localStorageen', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 201 }))
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}' })
    // 2xx → poistettu jonosta, mutta persist() ajettiin (jono nyt tyhjä tallennettuna)
    expect(storage.getItem(KEY)).toBe('[]')
    expect(ob.pending()).toBe(0)
  })

  it('2xx poistaa entryn jonosta', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'PUT', url: '/api/markers/a', body: '{}' })
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(ob.pending()).toBe(0)
  })

  it('ohimenevä non-2xx (5xx) säilyttää entryn + kutsuu onFailure(permanent=false)', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }))
    const onFailure = vi.fn()
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch, onFailure })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}' })
    expect(ob.pending()).toBe(1)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ resourceKey: 'marker:a' }), 500, false)
    // persistoitu jonoon
    const saved = JSON.parse(storage.getItem(KEY)!)
    expect(saved).toHaveLength(1)
    expect(saved[0].attempts).toBe(1)
  })

  // B-lista3b: pysyvä 4xx (403/400/404) → dead-letter. Entry POISTETAAN jonosta (retry ei auta,
  // muuten jono myrkyttyy ja virhebanneri toistuu joka kierroksella). onFailure(permanent=true).
  it('pysyvä 403 → dead-letter: entry poistuu jonosta, onFailure(permanent=true)', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 403 }))
    const onFailure = vi.fn()
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch, onFailure })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}' })
    expect(ob.pending()).toBe(0)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ resourceKey: 'marker:a' }), 403, true)
    expect(storage.getItem(KEY)).toBe('[]')
  })

  it.each([400, 404, 409, 422])('pysyvä %i → dead-letter (entry poistuu)', async (status) => {
    const fetchFn = vi.fn(async () => new Response(null, { status }))
    const onFailure = vi.fn()
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch, onFailure })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'PUT', url: '/api/markers/a', body: '{}' })
    expect(ob.pending()).toBe(0)
    expect(onFailure).toHaveBeenCalledWith(expect.anything(), status, true)
  })

  it.each([401, 408, 429])('%i EI ole pysyvä → jää jonoon retryä varten', async (status) => {
    const fetchFn = vi.fn(async () => new Response(null, { status }))
    const onFailure = vi.fn()
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch, onFailure })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'PUT', url: '/api/markers/a', body: '{}' })
    expect(ob.pending()).toBe(1)
    expect(onFailure).toHaveBeenCalledWith(expect.anything(), status, false)
  })

  it('verkkovirhe (fetch throw) säilyttää entryn, status null, permanent=false', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down')
    })
    const onFailure = vi.fn()
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch, onFailure })
    await ob.enqueue({ resourceKey: 'seg:a', method: 'DELETE', url: '/api/segments/a' })
    expect(ob.pending()).toBe(1)
    expect(onFailure).toHaveBeenCalledWith(expect.anything(), null, false)
  })

  it('käynnistyslataus + retry tyhjentää jonon kun palvelin taas vastaa', async () => {
    // 1. epäonnistuu → jää jonoon persistoituna
    const failing = vi.fn(async () => new Response(null, { status: 500 }))
    const ob1 = new WriteOutbox({ storage, fetchFn: failing as unknown as typeof fetch })
    await ob1.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{"x":1}' })
    expect(ob1.pending()).toBe(1)

    // 2. uusi instanssi lataa saman storagen (sivun päivitys) → retry onnistuu
    const ok = vi.fn(async () => new Response(null, { status: 201 }))
    const ob2 = new WriteOutbox({ storage, fetchFn: ok as unknown as typeof fetch })
    expect(ob2.pending()).toBe(1) // ladattiin jonosta
    await ob2.flush()
    expect(ok).toHaveBeenCalledOnce()
    expect(ob2.pending()).toBe(0)
    expect(storage.getItem(KEY)).toBe('[]')
  })

  it('saman resurssin FIFO: epäonnistunut POST blokkaa myöhemmän PUT:n samalle resurssille', async () => {
    // POST epäonnistuu, PUT samalle marker:a → PUT ei saa mennä ennen POSTia
    const calls: string[] = []
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`)
      if (url === '/api/markers') return new Response(null, { status: 500 }) // POST fail
      return new Response(null, { status: 200 })
    })
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}' })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'PUT', url: '/api/markers/a', body: '{}' })
    // PUT ei saa olla yritetty (POST blokkaa saman resurssin)
    expect(calls.filter((c) => c.startsWith('PUT')).length).toBe(0)
    expect(ob.pending()).toBe(2)
  })

  it('eri resurssit eivät blokkaa toisiaan', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/api/markers/a') return new Response(null, { status: 500 }) // a fail
      return new Response(null, { status: 200 }) // b ok
    })
    const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
    await ob.enqueue({ resourceKey: 'marker:a', method: 'PUT', url: '/api/markers/a', body: '{}' })
    await ob.enqueue({ resourceKey: 'marker:b', method: 'PUT', url: '/api/markers/b', body: '{}' })
    expect(ob.pending()).toBe(1) // vain a jäi
    expect(ob.pendingResourceKeys().has('marker:a')).toBe(true)
    expect(ob.pendingResourceKeys().has('marker:b')).toBe(false)
  })

  it('korruptoitunut jono → reset (V14)', () => {
    storage.setItem(KEY, '{ ei validia jsonia')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ob = new WriteOutbox({ storage, fetchFn: (async () => new Response()) as unknown as typeof fetch })
    expect(ob.pending()).toBe(0)
    expect(storage.getItem(KEY)).toBeNull()
    warn.mockRestore()
  })

  it('ei-taulukko JSON → reset (V14)', () => {
    storage.setItem(KEY, '{"foo":1}')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ob = new WriteOutbox({ storage, fetchFn: (async () => new Response()) as unknown as typeof fetch })
    expect(ob.pending()).toBe(0)
    warn.mockRestore()
  })

  // T187: onDelivered saa 2xx-vastauksen bodyn (reconcile); ei-2xx ei laukaise.
  describe('onDelivered (T187 reconcile)', () => {
    it('2xx → onDelivered saa vastaus-bodyn', async () => {
      const body = JSON.stringify({ id: 'a', route_ids: ['35km', '55km'], distance_from_start: 500 })
      const fetchFn = vi.fn(async () => new Response(body, { status: 201 }))
      const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
      const onDelivered = vi.fn()
      await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}', onDelivered })
      expect(onDelivered).toHaveBeenCalledWith(body)
    })

    it('non-2xx → onDelivered EI kutsuta', async () => {
      const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }))
      const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
      const onDelivered = vi.fn()
      await ob.enqueue({ resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}', onDelivered })
      expect(onDelivered).not.toHaveBeenCalled()
    })

    it('onDelivered heittää → ei kaada toimitusta (entry silti poistuu)', async () => {
      const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }))
      const ob = new WriteOutbox({ storage, fetchFn: fetchFn as unknown as typeof fetch })
      await ob.enqueue({
        resourceKey: 'marker:a', method: 'POST', url: '/api/markers', body: '{}',
        onDelivered: () => { throw new Error('boom') },
      })
      expect(ob.pending()).toBe(0)
    })
  })
})
