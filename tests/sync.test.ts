import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMarkers } from '../src/logic/sync'

const SERVER_MARKER = {
  id: 'test-id',
  type: 'right',
  lat: 61.0,
  lon: 25.0,
  distance_from_start: 1000,
  route_ids: ['35km'],
  status: 'suunniteltu',
  location_note: null,
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: 'admin',
}

afterEach(() => vi.unstubAllGlobals())

// T184/V118: fetchMarkers palauttaa diskriminoidun unionin — erottele
// "lataus onnistui" (ok:true) ja "lataus epäonnistui" (ok:false). Testit
// ottavat markkerit vain ok:true-haarasta.
function okMarkers(res: Awaited<ReturnType<typeof fetchMarkers>>) {
  if (!res.ok) throw new Error('expected ok:true')
  return res.markers
}

describe('fetchMarkers', () => {
  it('fetches from server and maps to SignMarker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))

    const markers = okMarkers(await fetchMarkers())
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

    const markers = okMarkers(await fetchMarkers())
    expect(markers[0].locationNote).toBe('Puu vasemmalla')
  })

  // T184/V118: verkkovirhe → {ok:false, error:'network'} — EI hiljainen tyhjä.
  it('returns ok:false network error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
    const res = await fetchMarkers()
    expect(res).toEqual({ ok: false, error: 'network' })
  })

  // T184/V118: HTTP 500 → {ok:false, error:'http'} — erottuu tyhjästä tuloksesta.
  it('returns ok:false http error on server 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))
    const res = await fetchMarkers()
    expect(res).toEqual({ ok: false, error: 'http' })
  })

  it('returns ok:false http error on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }))
    const res = await fetchMarkers()
    expect(res).toEqual({ ok: false, error: 'http' })
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

    const markers = okMarkers(await fetchMarkers())
    expect(markers[0].description).toBe('Kiinnitä puuhun')
    expect(markers[0].images).toEqual(['/api/markers/test-id/images/img1'])
  })

  it('T103: omits description/images fields when absent (SignMarker accepts optional fields)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))

    const markers = okMarkers(await fetchMarkers())
    expect(markers[0].description).toBeUndefined()
    expect(markers[0].images).toBeUndefined()
  })

  // T184/V118: 200 + [] → {ok:true, markers:[]} — tyhjä on validi tulos, ei virhe.
  it('returns ok:true with empty markers when server returns []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    }))
    const res = await fetchMarkers()
    expect(res).toEqual({ ok: true, markers: [] })
  })

  // T196/V131: image_id denormalisoitu markerille (backend-URL tai bundle-avain) → imageId
  it('T196: maps image_id → imageId (backend-URL)', async () => {
    const withImage = { ...SERVER_MARKER, image_id: '/api/templates/wc/images/uuid-1' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [withImage],
    }))
    const markers = okMarkers(await fetchMarkers())
    expect(markers[0].imageId).toBe('/api/templates/wc/images/uuid-1')
  })

  it('T196: omits imageId when image_id absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SERVER_MARKER],
    }))
    const markers = okMarkers(await fetchMarkers())
    expect(markers[0].imageId).toBeUndefined()
  })
})
