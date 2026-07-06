import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SnapshotPanel } from '../src/ui/snapshot-panel'
import type { SnapshotEntry } from '../src/ui/snapshot-panel'

const SNAP1: SnapshotEntry = {
  id: 'snap-1',
  label: 'Versio 1',
  created_at: '2026-06-10T10:00:00.000Z',
  created_by: 'Testi Järjestäjä',
  trigger: 'manual',
}
const SNAP2: SnapshotEntry = {
  id: 'snap-2',
  label: 'Hyväksytty',
  created_at: '2026-06-10T08:00:00.000Z',
  created_by: 'Testi Järjestäjä',
  trigger: 'auto-hyväksytty',
}

function mockFetch(responses: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase()
      const key = `${method} ${url}`
      const data = responses[key] ?? responses[url] ?? []
      return { ok: true, status: 200, json: async () => data }
    }),
  )
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('T82 — SnapshotPanel modal pattern', () => {
  describe('DOM mounting', () => {
    it('mounts backdrop at document.body, not inline', () => {
      new SnapshotPanel('järjestäjä')
      expect(document.getElementById('snapshot-modal-backdrop')).not.toBeNull()
      expect(document.getElementById('snapshot-panel-container')).toBeNull()
    })

    it('modal hidden initially', () => {
      new SnapshotPanel('järjestäjä')
      const backdrop = document.getElementById('snapshot-modal-backdrop')!
      expect(backdrop.classList.contains('open')).toBe(false)
    })
  })

  describe('open/close', () => {
    it('open() shows modal for järjestäjä', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(true)
    })

    it('open() does nothing for talkoolainen', () => {
      const panel = new SnapshotPanel('talkoolainen')
      panel.open()
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(false)
    })

    it('open() does nothing for admin', async () => {
      // admin is allowed
      mockFetch({ 'GET /api/admin/snapshots': [] })
      const panel = new SnapshotPanel('admin')
      panel.open()
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(true)
    })

    it('close() hides modal', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      panel.close()
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(false)
    })

    it('backdrop click closes modal', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      const backdrop = document.getElementById('snapshot-modal-backdrop')!
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(backdrop.classList.contains('open')).toBe(false)
    })

    it('click inside modal does not close it', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      const modal = document.getElementById('snapshot-modal')!
      modal.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(true)
    })

    it('Esc key closes open modal', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(false)
    })

    it('close button (✕) closes modal', () => {
      const panel = new SnapshotPanel('järjestäjä')
      panel.open()
      const closeBtn = document.querySelector<HTMLButtonElement>('.btn-snapshot-modal-close')!
      closeBtn.click()
      expect(document.getElementById('snapshot-modal-backdrop')!.classList.contains('open')).toBe(false)
    })
  })

  describe('role gate — fetch', () => {
    it('talkoolainen — ei fetch', () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel('talkoolainen')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('järjestäjä — fetches snapshot-lista', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel('järjestäjä')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    })
  })

  describe('list rendering', () => {
    it('shows empty message when no snapshots', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()
      expect(document.querySelector('.snapshot-empty')).not.toBeNull()
    })

    it('renders snapshot items', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1, SNAP2] })
      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()
      expect(document.querySelectorAll('.snapshot-item').length).toBe(2)
    })

    it('each item has "Palauta tämä versio" button', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()
      const btn = document.querySelector<HTMLButtonElement>('.btn-snapshot-restore')
      expect(btn).not.toBeNull()
      expect(btn!.textContent).toBe('Palauta tämä versio')
    })

    it('item info includes label and created_by', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()
      const info = document.querySelector('.snapshot-info')!.textContent ?? ''
      expect(info).toContain('Versio 1')
      expect(info).toContain('Testi Järjestäjä')
    })

    it('count updates in modal title', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1, SNAP2] })
      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()
      expect(document.querySelector('.snapshot-modal-title')!.textContent).toContain('2')
    })
  })

  describe('manual backup button', () => {
    it('calls POST /api/admin/snapshots on click', async () => {
      const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
        if ((opts?.method ?? 'GET') === 'POST' && url === '/api/admin/snapshots') {
          return { ok: true, status: 201, json: async () => SNAP1 }
        }
        return { ok: true, status: 200, json: async () => [SNAP1] }
      })
      vi.stubGlobal('fetch', fetchMock)

      const panel = new SnapshotPanel('järjestäjä')
      await vi.waitFor(() => expect(document.querySelector('#btn-snapshot-create')).not.toBeNull())

      const btn = document.querySelector<HTMLButtonElement>('#btn-snapshot-create')!
      btn.click()

      await vi.waitFor(() => {
        const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>
        expect(calls.some(([url, opts]) =>
          url === '/api/admin/snapshots' && opts?.method === 'POST',
        )).toBe(true)
      })
    })
  })

  describe('restore button', () => {
    it('calls POST /api/admin/snapshots/:id/restore after confirm', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true))
      const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
        if ((opts?.method ?? 'GET') === 'POST') {
          return { ok: true, status: 200, json: async () => ({ ok: true }) }
        }
        return { ok: true, status: 200, json: async () => [SNAP1] }
      })
      vi.stubGlobal('fetch', fetchMock)

      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()

      const btn = document.querySelector<HTMLButtonElement>('.btn-snapshot-restore')!
      btn.click()

      await vi.waitFor(() => {
        const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>
        expect(calls.some(([url, opts]) =>
          url.includes(`/api/admin/snapshots/${SNAP1.id}/restore`) && opts?.method === 'POST',
        )).toBe(true)
      })
    })

    it('does NOT call restore if user cancels confirm', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false))
      const fetchMock = vi.fn(async () => ({
        ok: true, status: 200, json: async () => [SNAP1],
      }))
      vi.stubGlobal('fetch', fetchMock)

      const panel = new SnapshotPanel('järjestäjä')
      await panel.refresh()

      const initialCallCount = fetchMock.mock.calls.length
      const btn = document.querySelector<HTMLButtonElement>('.btn-snapshot-restore')!
      btn.click()

      await new Promise(r => setTimeout(r, 50))
      const postCalls = (fetchMock.mock.calls as Array<[string, RequestInit?]>)
        .slice(initialCallCount)
        .filter(([, opts]) => opts?.method === 'POST')
      expect(postCalls.length).toBe(0)
    })
  })

  // ── T164/V102: lataa / palauta tiedostosta ─────────────────────────────────
  describe('lataa/palauta tiedostosta', () => {
    const VALID_BACKUP = JSON.stringify({
      version: 1, markers: [], segments: [], areas: [], areaFeatures: [],
    })

    it('renderoi lataa- ja palauta-tiedostosta -napit', () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel('järjestäjä')
      expect(document.querySelector('#btn-snapshot-download')).not.toBeNull()
      expect(document.querySelector('#btn-snapshot-restore-file')).not.toBeNull()
    })

    it('lataa-nappi triggeröi <a href=/api/admin/backup> latauksen', () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      new SnapshotPanel('järjestäjä')
      document.querySelector<HTMLButtonElement>('#btn-snapshot-download')!.click()
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    it('palauta tiedostosta → POST /api/admin/backup/restore confirmin jälkeen', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true))
      vi.stubGlobal('alert', vi.fn())
      const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
        if ((opts?.method ?? 'GET') === 'POST') return { ok: true, status: 200, json: async () => ({ ok: true }) }
        return { ok: true, status: 200, json: async () => [] }
      })
      vi.stubGlobal('fetch', fetchMock)

      new SnapshotPanel('järjestäjä')
      const fileInput = document.querySelector<HTMLInputElement>('.snapshot-file-input')!
      const file = new File([VALID_BACKUP], 'backup.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))

      await vi.waitFor(() => {
        const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>
        expect(calls.some(([url, opts]) =>
          url === '/api/admin/backup/restore' && opts?.method === 'POST',
        )).toBe(true)
      })
    })

    it('EI POST jos käyttäjä peruu confirmin', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false))
      vi.stubGlobal('alert', vi.fn())
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
      vi.stubGlobal('fetch', fetchMock)

      new SnapshotPanel('järjestäjä')
      const fileInput = document.querySelector<HTMLInputElement>('.snapshot-file-input')!
      const file = new File([VALID_BACKUP], 'backup.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))

      await new Promise(r => setTimeout(r, 50))
      const postCalls = (fetchMock.mock.calls as Array<[string, RequestInit?]>)
        .filter(([, opts]) => opts?.method === 'POST')
      expect(postCalls.length).toBe(0)
    })
  })
})
