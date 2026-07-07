import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSegmentByCode, pushSegment, updateSegmentRemote, deleteSegmentRemote, fetchAllSegments } from '../src/logic/segment-sync'
import { outbox } from '../src/logic/outbox-instance'
import type { Segment } from '../src/logic/segments'

const SEG: Segment = {
  id: 'seg-1',
  routeIds: ['35km'],
  startDist: 5000,
  endDist: 12000,
  equipment: [{ name: 'nauhaa', count: 2 }],
  phase: 'asettaminen',
  displayName: 'Pätkä 1',
}

describe('T62: segment-sync — V36', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // T183: pätkäkirjoitukset kulkevat jaetun outbox-singletonin kautta —
    // tyhjennä jono testien välillä ettei edellisen testin epäonnistunut kirjoitus
    // blokkaa saman resurssin (segment:seg-1) seuraavaa yritystä (FIFO).
    outbox.clear()
  })

  describe('fetchSegmentByCode', () => {
    it('returns segment on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SEG,
      }))
      const result = await fetchSegmentByCode('JUKKA')
      expect(result).toEqual(SEG)
      expect(fetch).toHaveBeenCalledWith('/api/segments/by-code/JUKKA')
    })

    it('returns null on 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const result = await fetchSegmentByCode('JUKKA')
      expect(result).toBeNull()
    })

    it('returns null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      const result = await fetchSegmentByCode('JUKKA')
      expect(result).toBeNull()
    })
  })

  describe('pushSegment', () => {
    it('returns true on 200/201', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
      expect(await pushSegment(SEG)).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/segments', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(SEG),
      }))
    })

    it('returns false on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await pushSegment(SEG)).toBe(false)
    })

    it('returns false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await pushSegment(SEG)).toBe(false)
    })
  })

  describe('updateSegmentRemote', () => {
    it('calls PUT with patch', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      await updateSegmentRemote('seg-1', { description: 'ohje' })
      expect(fetch).toHaveBeenCalledWith('/api/segments/seg-1', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ description: 'ohje' }),
      }))
    })
  })

  describe('deleteSegmentRemote', () => {
    it('calls DELETE', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      expect(await deleteSegmentRemote('seg-1')).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/segments/seg-1', { method: 'DELETE' })
    })
  })

  // T184/V118: erottele lataus-epäonnistuminen tyhjästä tuloksesta.
  describe('fetchAllSegments', () => {
    it('returns ok:true with segments on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [SEG] }))
      expect(await fetchAllSegments()).toEqual({ ok: true, segments: [SEG] })
    })

    it('returns ok:true empty on 200 + []', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
      expect(await fetchAllSegments()).toEqual({ ok: true, segments: [] })
    })

    it('returns ok:false http on 500', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await fetchAllSegments()).toEqual({ ok: false, error: 'http' })
    })

    it('returns ok:false network on fetch reject', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchAllSegments()).toEqual({ ok: false, error: 'network' })
    })
  })
})
