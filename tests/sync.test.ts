import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncMarkers, pushPending, SyncError } from '../src/logic/sync'
import type { SignMarker } from '../src/logic/types'

const SERVER_MARKER = {
  id: 'test-id',
  type: 'right',
  lat: 61.0,
  lon: 25.0,
  bearing: 90,
  distance_from_start: 1000,
  route_ids: ['35km'],
  status: 'suunniteltu',
  location_note: null,
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: 'admin',
}

const CLIENT_MARKER: SignMarker = {
  id: 'test-id',
  type: 'right',
  lat: 61.0,
  lon: 25.0,
  bearing: 90,
  distanceFromStart: 1000,
  routeIds: ['35km'],
  status: 'suunniteltu',
}

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageMock())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('syncMarkers', () => {
  it('V18: fetches from server and saves to localStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))

    const markers = await syncMarkers()
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject(CLIENT_MARKER)
    const stored = JSON.parse(localStorage.getItem('karttamaster-markers')!)
    expect(stored.markers).toHaveLength(1)
    expect(stored.markers[0].id).toBe('test-id')
  })

  it('V18: falls back to localStorage on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [CLIENT_MARKER] }),
    )

    const markers = await syncMarkers()
    expect(markers).toHaveLength(1)
    expect(markers[0].id).toBe('test-id')
  })

  it('V18: falls back to localStorage on server 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [CLIENT_MARKER] }),
    )

    const markers = await syncMarkers()
    expect(markers[0].id).toBe('test-id')
  })

  it('V22: throws SyncError map_not_ready on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'map_not_ready' }),
    }))

    await expect(syncMarkers()).rejects.toThrow(SyncError)
    await expect(syncMarkers()).rejects.toMatchObject({ reason: 'map_not_ready' })
  })

  it('throws SyncError auth_required on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }))

    await expect(syncMarkers()).rejects.toMatchObject({ reason: 'auth_required' })
  })

  it('maps snake_case server fields to camelCase (V18)', async () => {
    const withNote = { ...SERVER_MARKER, location_note: 'Puu vasemmalla' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [withNote],
    }))

    const markers = await syncMarkers()
    expect(markers[0].locationNote).toBe('Puu vasemmalla')
    expect(markers[0].distanceFromStart).toBe(1000)
    expect(markers[0].routeIds).toEqual(['35km'])
  })

  it('returns empty array when server returns [] and localStorage is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    }))

    const markers = await syncMarkers()
    expect(markers).toEqual([])
  })
})

describe('pushPending', () => {
  it('V19: sends pendingSync markers to server', async () => {
    const pending: SignMarker = { ...CLIENT_MARKER, status: 'asetettu', pendingSync: true }
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [pending] }),
    )
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await pushPending()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/markers/test-id',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('V19: clears pendingSync after successful push', async () => {
    const pending: SignMarker = { ...CLIENT_MARKER, status: 'asetettu', pendingSync: true }
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [pending] }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

    await pushPending()
    const stored = JSON.parse(localStorage.getItem('karttamaster-markers')!)
    expect(stored.markers[0].pendingSync).toBeFalsy()
  })

  it('V19: skips markers without pendingSync', async () => {
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [CLIENT_MARKER] }),
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await pushPending()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('V19: keeps pendingSync on failed push, does not throw', async () => {
    const pending: SignMarker = { ...CLIENT_MARKER, status: 'asetettu', pendingSync: true }
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [pending] }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(pushPending()).resolves.not.toThrow()
    const stored = JSON.parse(localStorage.getItem('karttamaster-markers')!)
    expect(stored.markers[0].pendingSync).toBe(true)
  })

  it('V19: partial push — clears only succeeded markers', async () => {
    const m1: SignMarker = { ...CLIENT_MARKER, id: 'id-1', pendingSync: true }
    const m2: SignMarker = { ...CLIENT_MARKER, id: 'id-2', pendingSync: true }
    localStorage.setItem(
      'karttamaster-markers',
      JSON.stringify({ version: 1, markers: [m1, m2] }),
    )
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500 }),
    )

    await pushPending()
    const stored = JSON.parse(localStorage.getItem('karttamaster-markers')!)
    const m1Stored = stored.markers.find((m: SignMarker) => m.id === 'id-1')
    const m2Stored = stored.markers.find((m: SignMarker) => m.id === 'id-2')
    expect(m1Stored.pendingSync).toBeFalsy()
    expect(m2Stored.pendingSync).toBe(true)
  })
})
