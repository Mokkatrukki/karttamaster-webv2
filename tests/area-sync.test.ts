import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAreas, createArea, updateArea, deleteArea } from '../src/logic/area-sync'
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

describe('T154: area-sync — testihygienia (Taso 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchAreas', () => {
    it('returns areas on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [AREA],
      }))
      const result = await fetchAreas()
      expect(result).toEqual([AREA])
      expect(fetch).toHaveBeenCalledWith('/api/areas')
    })

    it('returns [] on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      expect(await fetchAreas()).toEqual([])
    })

    it('returns [] on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchAreas()).toEqual([])
    })

    it('returns [] when response body is not an array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ not: 'an array' }),
      }))
      expect(await fetchAreas()).toEqual([])
    })
  })

  describe('createArea', () => {
    it('returns created area on 200/201', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => AREA,
      }))
      const result = await createArea(AREA)
      expect(result).toEqual(AREA)
      expect(fetch).toHaveBeenCalledWith('/api/areas', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(AREA),
      }))
    })

    it('returns null on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      expect(await createArea(AREA)).toBeNull()
    })

    it('returns null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await createArea(AREA)).toBeNull()
    })
  })

  describe('updateArea', () => {
    it('calls PUT with area payload', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      await updateArea(AREA)
      expect(fetch).toHaveBeenCalledWith('/api/areas/area-1', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(AREA),
      }))
    })

    it('swallows network error silently (overlay already updated in-memory)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      await expect(updateArea(AREA)).resolves.toBeUndefined()
    })
  })

  describe('deleteArea', () => {
    it('calls DELETE', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      await deleteArea('area-1')
      expect(fetch).toHaveBeenCalledWith('/api/areas/area-1', { method: 'DELETE' })
    })

    it('swallows network error silently', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      await expect(deleteArea('area-1')).resolves.toBeUndefined()
    })
  })
})
