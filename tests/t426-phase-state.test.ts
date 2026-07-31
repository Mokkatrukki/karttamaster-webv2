// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Moduulitason tila (`active`) ∴ tuore import per testi — muuten edellinen testi vuotaa.
async function freshModule() {
  vi.resetModules()
  return await import('../src/logic/phase-view')
}

function mockStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  })
  return store
}

describe('T426/V317 — vaihe on järjestelmän tila, localStorage vain välimuisti', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('lataa vaiheen serveriltä ja päivittää välimuistin', async () => {
    const store = mockStorage()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phase: 'purku' }) })))
    const m = await freshModule()
    expect(await m.loadActivePhase()).toBe('purku')
    expect(m.getActivePhase()).toBe('purku')
    expect(store.get('karttamaster-active-phase')).toBe('purku')
  })

  it('serveri poikki → välimuistin arvo kelpaa (offline toimii)', async () => {
    mockStorage({ 'karttamaster-active-phase': 'tarkastus' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const m = await freshModule()
    expect(await m.loadActivePhase()).toBe('tarkastus')
    expect(m.getActivePhase()).toBe('tarkastus')
  })

  it('tyhjä välimuisti + serveri poikki → asettaminen (⊥ heitto)', async () => {
    mockStorage()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const m = await freshModule()
    expect(await m.loadActivePhase()).toBe('asettaminen')
  })

  it('serverin roskavaihe ei korvaa kelvollista välimuistia', async () => {
    mockStorage({ 'karttamaster-active-phase': 'purku' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phase: 'muinainen' }) })))
    const m = await freshModule()
    expect(await m.loadActivePhase()).toBe('purku')
  })

  it('vaihdon tallennus onnistuu → uusi arvo jää voimaan', async () => {
    const store = mockStorage()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phase: 'purku' }) })))
    const m = await freshModule()
    expect(await m.setActivePhase('purku')).toBe(true)
    expect(m.getActivePhase()).toBe('purku')
    expect(store.get('karttamaster-active-phase')).toBe('purku')
  })

  it('epäonnistunut tallennus PALAUTTAA edellisen — kerrokset eivät jää eri mieleen', async () => {
    const store = mockStorage({ 'karttamaster-active-phase': 'asettaminen' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))
    const m = await freshModule()
    expect(await m.setActivePhase('purku')).toBe(false)
    expect(m.getActivePhase()).toBe('asettaminen')
    expect(store.get('karttamaster-active-phase')).toBe('asettaminen')
  })

  it('verkkovirhe tallennuksessa käyttäytyy kuten HTTP-virhe', async () => {
    mockStorage({ 'karttamaster-active-phase': 'asettaminen' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const m = await freshModule()
    expect(await m.setActivePhase('purku')).toBe(false)
    expect(m.getActivePhase()).toBe('asettaminen')
  })

  it('PUT lähtee oikeaan osoitteeseen oikealla rungolla', async () => {
    mockStorage()
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    const m = await freshModule()
    await m.setActivePhase('tarkastus')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/phase')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ phase: 'tarkastus' })
  })
})
