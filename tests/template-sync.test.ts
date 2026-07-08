import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchTemplates,
  createTemplateRemote,
  updateTemplateRemote,
  deleteTemplateRemote,
} from '../src/logic/template-sync'
import { outbox } from '../src/logic/outbox-instance'
import type { SignTemplate } from '../src/logic/sign-library'

const TEMPLATE: SignTemplate = {
  id: 'oikealle',
  label: 'Oikealle',
  color: '#16a34a',
  description: 'Käänny oikealle',
  favorite: true,
  iconId: 'arrow-right',
}

describe('T193: template-sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    outbox.clear()
  })

  // T193/V118: fetchTemplates erottelee lataus-epäonnistumisen tyhjästä kirjastosta.
  describe('fetchTemplates', () => {
    it('returns ok:true with templates on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [TEMPLATE] }))
      expect(await fetchTemplates()).toEqual({ ok: true, templates: [TEMPLATE] })
      expect(fetch).toHaveBeenCalledWith('/api/templates')
    })

    it('returns ok:false http on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await fetchTemplates()).toEqual({ ok: false, error: 'http' })
    })

    it('returns ok:false network on fetch reject', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await fetchTemplates()).toEqual({ ok: false, error: 'network' })
    })

    it('returns ok:true empty when body is not an array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: 'array' }) }))
      expect(await fetchTemplates()).toEqual({ ok: true, templates: [] })
    })
  })

  // T193/V123/V124: kirjoitukset outboxin kautta — resourceKey 'template:<id>', 2xx → delivered.
  describe('createTemplateRemote (outbox)', () => {
    it('POST /api/templates, delivered on 201', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
      expect(await createTemplateRemote(TEMPLATE)).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(TEMPLATE),
      }))
    })

    it('epäonnistuminen → delivered:false, jää jonoon (durability)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
      expect(await createTemplateRemote(TEMPLATE)).toBe(false)
      expect(outbox.pending()).toBe(1)
      expect([...outbox.pendingResourceKeys()]).toContain('template:oikealle')
    })

    it('verkkovirhe → delivered:false, jää jonoon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      expect(await createTemplateRemote(TEMPLATE)).toBe(false)
      expect(outbox.pending()).toBe(1)
    })
  })

  describe('updateTemplateRemote (outbox)', () => {
    it('PUT /api/templates/:id delivered on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      expect(await updateTemplateRemote(TEMPLATE)).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/templates/oikealle', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(TEMPLATE),
      }))
    })
  })

  describe('deleteTemplateRemote (outbox)', () => {
    it('DELETE /api/templates/:id delivered on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
      expect(await deleteTemplateRemote('oikealle')).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/templates/oikealle', expect.objectContaining({ method: 'DELETE' }))
    })
  })
})
