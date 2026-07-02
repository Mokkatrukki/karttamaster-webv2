import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMarkers } from '../src/logic/sync'

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

afterEach(() => vi.unstubAllGlobals())

describe('fetchMarkers', () => {
  it('fetches from server and maps to SignMarker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))

    const markers = await fetchMarkers()
    expect(markers).toHaveLength(1)
    expect(markers[0].id).toBe('test-id')
    expect(markers[0].distanceFromStart).toBe(1000)
    expect(markers[0].routeIds).toEqual(['35km'])
    expect(markers[0].status).toBe('suunniteltu')
  })

  it('maps location_note to locationNote', async () => {
    const withNote = { ...SERVER_MARKER, location_note: 'Puu vasemmalla' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [withNote],
    }))

    const markers = await fetchMarkers()
    expect(markers[0].locationNote).toBe('Puu vasemmalla')
  })

  it('returns [] on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
    const markers = await fetchMarkers()
    expect(markers).toEqual([])
  })

  it('returns [] on server 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))
    const markers = await fetchMarkers()
    expect(markers).toEqual([])
  })

  it('returns [] on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }))
    const markers = await fetchMarkers()
    expect(markers).toEqual([])
  })

  it('T103: maps description and images from server', async () => {
    const withDesc = {
      ...SERVER_MARKER,
      description: 'Kiinnitä puuhun',
      images: ['/api/markers/test-id/images/img1'],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [withDesc],
    }))

    const markers = await fetchMarkers()
    expect(markers[0].description).toBe('Kiinnitä puuhun')
    expect(markers[0].images).toEqual(['/api/markers/test-id/images/img1'])
  })

  it('T103: omits description/images fields when absent (SignMarker accepts optional fields)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))

    const markers = await fetchMarkers()
    expect(markers[0].description).toBeUndefined()
    expect(markers[0].images).toBeUndefined()
  })

  it('returns [] when server returns []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    }))
    const markers = await fetchMarkers()
    expect(markers).toEqual([])
  })
})
