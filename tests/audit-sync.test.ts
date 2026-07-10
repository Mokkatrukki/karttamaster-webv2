import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchSegmentAudit, undoSegmentActions } from '../src/logic/audit-sync'

afterEach(() => vi.restoreAllMocks())

describe('T227: audit-sync', () => {
  describe('fetchSegmentAudit', () => {
    it('palauttaa lokin array-vastauksesta', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'a', marker_id: 'm', action: 'add', actor: 'X', actor_role: 'talkoolainen', segment_code: 'SEG', created_at: '2026-07-09T10:00:00.000Z', payload: null }],
      }))
      const rows = await fetchSegmentAudit('SEG')
      expect(rows).not.toBeNull()
      expect(rows!.length).toBe(1)
      expect(rows![0].action).toBe('add')
    })

    it('ei-ok → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
      expect(await fetchSegmentAudit('SEG')).toBeNull()
    })

    it('ei-array-JSON (virhevastaus/mock) → null (Array.isArray-vahti, ei kaada)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'x' }) }))
      expect(await fetchSegmentAudit('SEG')).toBeNull()
    })

    it('verkkovirhe → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchSegmentAudit('SEG')).toBeNull()
    })
  })

  describe('undoSegmentActions', () => {
    it('palauttaa peruutettujen määrän', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, undone: 3 }) })
      vi.stubGlobal('fetch', fetchMock)
      const undone = await undoSegmentActions('SEG', 'add')
      expect(undone).toBe(3)
      // Oikea payload
      const [, opts] = fetchMock.mock.calls[0]
      expect(JSON.parse(opts.body)).toEqual({ segment_code: 'SEG', action: 'add' })
    })

    it('ei-ok → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
      expect(await undoSegmentActions('SEG', 'add')).toBeNull()
    })

    it('verkkovirhe → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await undoSegmentActions('SEG', 'add')).toBeNull()
    })
  })
})
