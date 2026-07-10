import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  validateNewComment,
  fetchComments,
  postComment,
  deleteComment,
  type NewComment,
} from '../src/logic/comments'

afterEach(() => vi.restoreAllMocks())

describe('T221: comments client-slice', () => {
  describe('validateNewComment', () => {
    it('marker ilman targetId → missing_target_id', () => {
      expect(validateNewComment({ targetType: 'marker', text: 'hei' })).toBe('missing_target_id')
    })
    it('point ilman koordinaatteja → missing_coordinates', () => {
      expect(validateNewComment({ targetType: 'point', text: 'hei' })).toBe('missing_coordinates')
    })
    it('point koordinaateilla → ok', () => {
      expect(validateNewComment({ targetType: 'point', lat: 1, lon: 2, text: 'hei' })).toBeNull()
    })
    it('tyhjä text → missing_text', () => {
      expect(validateNewComment({ targetType: 'marker', targetId: 'm1', text: '   ' })).toBe('missing_text')
    })
    it('tuntematon targetType → invalid_target_type', () => {
      expect(validateNewComment({ targetType: 'nope' as NewComment['targetType'], text: 'x' })).toBe('invalid_target_type')
    })
    it('validi marker-kommentti → null', () => {
      expect(validateNewComment({ targetType: 'marker', targetId: 'm1', text: 'hei' })).toBeNull()
    })
  })

  describe('fetchComments', () => {
    it('rakentaa query-stringin targetType+targetId', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
      vi.stubGlobal('fetch', fetchMock)
      await fetchComments('marker', 'm1')
      expect(fetchMock.mock.calls[0][0]).toBe('/api/comments?targetType=marker&targetId=m1')
    })
    it('ilman suodatinta → paljas /api/comments', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
      vi.stubGlobal('fetch', fetchMock)
      await fetchComments()
      expect(fetchMock.mock.calls[0][0]).toBe('/api/comments')
    })
    it('array-vastaus → kommentit', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'c1', targetType: 'marker', targetId: 'm1', text: 'hei', createdAt: '2026-07-10T10:00:00.000Z' }],
      }))
      const rows = await fetchComments('marker', 'm1')
      expect(rows).not.toBeNull()
      expect(rows!.length).toBe(1)
      expect(rows![0].text).toBe('hei')
    })
    it('ei-array-JSON → null (V14-vahti)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'x' }) }))
      expect(await fetchComments('marker', 'm1')).toBeNull()
    })
    it('ei-ok → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => [] }))
      expect(await fetchComments()).toBeNull()
    })
    it('verkkovirhe → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchComments()).toBeNull()
    })
  })

  describe('postComment', () => {
    it('validi → lähettää POST + palauttaa luodun kommentin', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'c1', targetType: 'marker', targetId: 'm1', text: 'hei', createdAt: 'x' }),
      })
      vi.stubGlobal('fetch', fetchMock)
      const created = await postComment({ targetType: 'marker', targetId: 'm1', text: '  hei  ' })
      expect(created).not.toBeNull()
      expect(created!.id).toBe('c1')
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/comments')
      expect(opts.method).toBe('POST')
      // text trimmataan payloadissa
      expect(JSON.parse(opts.body).text).toBe('hei')
    })
    it('invalid (ei text) → EI fetchiä, null', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const created = await postComment({ targetType: 'marker', targetId: 'm1', text: '' })
      expect(created).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })
    it('ei-ok → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
      expect(await postComment({ targetType: 'marker', targetId: 'm1', text: 'hei' })).toBeNull()
    })
    it('ok mutta ei-objekti (virhe-JSON) → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => 'oops' }))
      expect(await postComment({ targetType: 'marker', targetId: 'm1', text: 'hei' })).toBeNull()
    })
    it('verkkovirhe → null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await postComment({ targetType: 'marker', targetId: 'm1', text: 'hei' })).toBeNull()
    })
  })

  describe('deleteComment', () => {
    it('ok → true, oikea DELETE-url', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      expect(await deleteComment('c 1')).toBe(true)
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/comments/c%201')
      expect(opts.method).toBe('DELETE')
    })
    it('ei-ok → false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      expect(await deleteComment('c1')).toBe(false)
    })
    it('verkkovirhe → false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await deleteComment('c1')).toBe(false)
    })
  })
})
