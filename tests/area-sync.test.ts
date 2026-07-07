import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAreas, createArea, updateArea, deleteArea } from '../src/logic/area-sync'
import { outbox } from '../src/logic/outbox-instance'
import type { AreaMarker } from '../src/logic/area-types'

const AREA: AreaMarker = {
  id: 'area-1',
  name: 'Parkkialue',
  centerLat: 65.62,
  centerLng: 27.62,
  widthM: 20,
  heightM: 15,
  rotation: 0,
  markdownDescription: '',
  status: 'suunniteltu',
  hashCode: 'abc123',
  features: [],
}

describe('T154/T190: area-sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // T190/T183: aluekirjoitukset kulkevat jaetun outbox-singletonin kautta —
    // tyhjennä jono testien välillä (FIFO-eristys, sama kuin segment-sync).
    outbox.clear()
  })

  // T190/V118: fetchAreas erottelee lataus-epäonnistumisen tyhjästä tuloksesta.
  describe('fetchAreas', () => {
    it('returns ok:true with areas on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [AREA] }))
      expect(await fetchAreas()).toEqual({ ok: true, areas: [AREA] })
      expect(fetch).toHaveBeenCalledWith('/api/areas')
    })

    it('returns ok:false http on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await fetchAreas()).toEqual({ ok: false, error: 'http' })
    })

    it('returns ok:false network on fetch reject', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchAreas()).toEqual({ ok: false, error: 'network' })
    })

    it('returns ok:true empty when body is not an array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: 'an array' }) }))
      expect(await fetchAreas()).toEqual({ ok: true, areas: [] })
    })
  })

  // T190/V116/B85: kirjoitukset outboxin kautta — 2xx → delivered:true, muu → jää jonoon.
  describe('createArea (outbox)', () => {
    it('POST /api/areas, delivered on 201', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
      expect(await createArea(AREA)).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/areas', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(AREA),
      }))
    })

    it('epäonnistuminen → delivered:false, kirjoitus jää jonoon (durability)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await createArea(AREA)).toBe(false)
      expect(outbox.pending()).toBe(1)
    })

    it('verkkovirhe → delivered:false, jää jonoon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await createArea(AREA)).toBe(false)
      expect(outbox.pending()).toBe(1)
    })
  })

  describe('updateArea (outbox)', () => {
    it('PUT /api/areas/:id delivered on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      expect(await updateArea(AREA)).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/areas/area-1', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(AREA),
      }))
    })

    it('ei enää hiljainen fire-and-forget — epäonnistuminen jää jonoon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
      expect(await updateArea(AREA)).toBe(false)
      expect(outbox.pending()).toBe(1)
    })
  })

  describe('deleteArea (outbox)', () => {
    it('DELETE /api/areas/:id delivered on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      expect(await deleteArea('area-1')).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/areas/area-1', expect.objectContaining({ method: 'DELETE' }))
    })
  })
})
