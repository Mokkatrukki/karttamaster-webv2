import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MapStateBadge, showMapNotReadyBanner } from '../src/ui/map-state-badge'

function setupToolbar() {
  document.body.innerHTML = `
    <div id="toolbar">
      <button id="btn-layer">MML</button>
    </div>
    <div id="map-state-banner" hidden></div>
  `
  return document.getElementById('toolbar') as HTMLElement
}

function makeFetchMapState(status: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status }),
  })
}

beforeEach(() => {
  let store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('MapStateBadge — järjestäjä (V13)', () => {
  it('renders badge element for järjestäjä', () => {
    vi.stubGlobal('fetch', makeFetchMapState('luonnos'))
    const toolbar = setupToolbar()
    new MapStateBadge(toolbar, 'järjestäjä')
    expect(document.getElementById('map-state-badge')).not.toBeNull()
  })

  it('does NOT render badge for talkoolainen (V13)', () => {
    vi.stubGlobal('fetch', vi.fn())
    const toolbar = setupToolbar()
    new MapStateBadge(toolbar, 'talkoolainen')
    expect(document.getElementById('map-state-badge')).toBeNull()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('renders badge for admin', () => {
    vi.stubGlobal('fetch', makeFetchMapState('luonnos'))
    const toolbar = setupToolbar()
    new MapStateBadge(toolbar, 'admin')
    expect(document.getElementById('map-state-badge')).not.toBeNull()
  })
})

describe('MapStateBadge.update() — status states', () => {
  it('update luonnos → shows LUONNOS text, approve button visible (V22)', () => {
    vi.stubGlobal('fetch', makeFetchMapState('luonnos'))
    const toolbar = setupToolbar()
    const badge = new MapStateBadge(toolbar, 'järjestäjä')
    badge.update('luonnos')
    expect(document.getElementById('map-state-text')?.textContent).toContain('LUONNOS')
    expect(document.getElementById('map-state-text')?.dataset.status).toBe('luonnos')
    expect((document.getElementById('btn-approve-map') as HTMLButtonElement)?.hidden).toBe(false)
  })

  it('update hyväksytty → shows HYVÄKSYTTY text, approve button hidden', () => {
    vi.stubGlobal('fetch', makeFetchMapState('hyväksytty'))
    const toolbar = setupToolbar()
    const badge = new MapStateBadge(toolbar, 'järjestäjä')
    badge.update('hyväksytty')
    expect(document.getElementById('map-state-text')?.textContent).toContain('HYVÄKSYTTY')
    expect(document.getElementById('map-state-text')?.dataset.status).toBe('hyväksytty')
    expect((document.getElementById('btn-approve-map') as HTMLButtonElement)?.hidden).toBe(true)
  })
})

describe('MapStateBadge.refresh()', () => {
  it('fetches /api/admin/map-state and updates badge', async () => {
    const fetchMock = makeFetchMapState('luonnos')
    vi.stubGlobal('fetch', fetchMock)
    const toolbar = setupToolbar()
    const badge = new MapStateBadge(toolbar, 'järjestäjä')
    await badge.refresh()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/map-state')
    expect(document.getElementById('map-state-text')?.dataset.status).toBe('luonnos')
  })

  it('silently ignores network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const toolbar = setupToolbar()
    const badge = new MapStateBadge(toolbar, 'järjestäjä')
    await expect(badge.refresh()).resolves.not.toThrow()
  })

  it('silently ignores non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    const toolbar = setupToolbar()
    const badge = new MapStateBadge(toolbar, 'järjestäjä')
    await expect(badge.refresh()).resolves.not.toThrow()
  })
})

describe('Approve button — confirm + POST (V22)', () => {
  it('clicking approve with confirm=true sends POST and refreshes', async () => {
    const postResponse = { ok: true, status: 200, json: async () => ({ status: 'hyväksytty' }) }
    const getResponse = { ok: true, status: 200, json: async () => ({ status: 'luonnos' }) }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(getResponse)  // mount refresh
      .mockResolvedValueOnce(postResponse) // POST approve
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'hyväksytty' }) }) // refresh after
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

    const toolbar = setupToolbar()
    new MapStateBadge(toolbar, 'järjestäjä')
    // Wait for initial refresh
    await new Promise(r => setTimeout(r, 0))

    const btn = document.getElementById('btn-approve-map') as HTMLButtonElement
    btn.click()
    await new Promise(r => setTimeout(r, 10))

    const postCall = fetchMock.mock.calls.find(
      c => c[0] === '/api/admin/map-state' && c[1]?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    expect(JSON.parse(postCall![1].body)).toEqual({ status: 'hyväksytty' })
  })

  it('clicking approve with confirm=false does NOT send POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ status: 'luonnos' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))

    const toolbar = setupToolbar()
    new MapStateBadge(toolbar, 'järjestäjä')
    await new Promise(r => setTimeout(r, 0))

    const callsBefore = fetchMock.mock.calls.length
    const btn = document.getElementById('btn-approve-map') as HTMLButtonElement
    btn.click()
    await new Promise(r => setTimeout(r, 10))

    const postCalls = fetchMock.mock.calls.slice(callsBefore).filter(
      c => c[1]?.method === 'POST'
    )
    expect(postCalls).toHaveLength(0)
  })
})

describe('showMapNotReadyBanner — V22', () => {
  it('makes banner visible', () => {
    document.body.innerHTML = `<div id="map-state-banner" hidden></div>`
    showMapNotReadyBanner()
    expect((document.getElementById('map-state-banner') as HTMLElement).hidden).toBe(false)
  })

  it('does not throw if banner element missing', () => {
    document.body.innerHTML = ''
    expect(() => showMapNotReadyBanner()).not.toThrow()
  })
})
