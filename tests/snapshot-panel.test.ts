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
      return {
        ok: true,
        status: 200,
        json: async () => data,
      }
    }),
  )
}

function setupContainer() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('T50 — SnapshotPanel', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = setupContainer()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('role gate', () => {
    // CSS [data-role] handles visual visibility — test fetch gating behavior

    it('talkoolainen — ei fetch (CSS piilottaa paneelin)', () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel(container, 'talkoolainen')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('järjestäjä — fetches snapshot-lista', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    })

    it('admin — fetches snapshot-lista', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel(container, 'admin')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    })
  })

  describe('list rendering', () => {
    it('shows empty message when no snapshots', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => {
        expect(container.querySelector('.snapshot-empty')).not.toBeNull()
      })
    })

    it('renders snapshot items', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1, SNAP2] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => {
        expect(container.querySelectorAll('.snapshot-item').length).toBe(2)
      })
    })

    it('each item has "Palauta tämä versio" button', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => {
        const btn = container.querySelector('.btn-snapshot-restore') as HTMLButtonElement
        expect(btn).not.toBeNull()
        expect(btn.textContent).toBe('Palauta tämä versio')
      })
    })

    it('item info includes label and created_by', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => {
        const info = container.querySelector('.snapshot-info')!.textContent ?? ''
        expect(info).toContain('Versio 1')
        expect(info).toContain('Testi Järjestäjä')
      })
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

      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('#btn-snapshot-create')).not.toBeNull())

      const btn = container.querySelector<HTMLButtonElement>('#btn-snapshot-create')!
      btn.click()

      await vi.waitFor(() => {
        const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>
        expect(calls.some(([url, opts]) => url === '/api/admin/snapshots' && opts?.method === 'POST')).toBe(true)
      })
    })
  })

  describe('T57 — collapsible (default collapsed)', () => {
    it('list hidden by default', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.snapshot-item')).not.toBeNull())
      expect(container.querySelector('#snapshot-list')?.hasAttribute('hidden')).toBe(true)
    })

    it('backup button always visible (collapsed or not)', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
      expect(container.querySelector<HTMLElement>('#btn-snapshot-create')?.hidden).toBe(false)
    })

    it('title shows count when collapsed', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1, SNAP2] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => {
        const h3 = container.querySelector('h3')!.textContent ?? ''
        expect(h3).toContain('2')
      })
    })

    it('header click expands panel', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.snapshot-item')).not.toBeNull())
      const header = container.querySelector('.snapshot-header') as HTMLElement
      header.click()
      expect(container.querySelector('#snapshot-list')?.hasAttribute('hidden')).toBe(false)
      expect(container.querySelector<HTMLElement>('#btn-snapshot-create')?.hidden).toBe(false)
    })

    it('header click again collapses panel', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.snapshot-item')).not.toBeNull())
      const header = container.querySelector('.snapshot-header') as HTMLElement
      header.click() // expand
      header.click() // collapse
      expect(container.querySelector('#snapshot-list')?.hasAttribute('hidden')).toBe(true)
    })

    it('title shows "Varmuuskopiot" without count when expanded', async () => {
      mockFetch({ 'GET /api/admin/snapshots': [SNAP1, SNAP2] })
      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.snapshot-item')).not.toBeNull())
      const header = container.querySelector('.snapshot-header') as HTMLElement
      header.click()
      expect(container.querySelector('h3')!.textContent).toBe('Varmuuskopiot')
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

      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.btn-snapshot-restore')).not.toBeNull())

      const btn = container.querySelector<HTMLButtonElement>('.btn-snapshot-restore')!
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

      new SnapshotPanel(container, 'järjestäjä')
      await vi.waitFor(() => expect(container.querySelector('.btn-snapshot-restore')).not.toBeNull())

      const initialCallCount = fetchMock.mock.calls.length
      const btn = container.querySelector<HTMLButtonElement>('.btn-snapshot-restore')!
      btn.click()

      await new Promise(r => setTimeout(r, 50))
      // No new POST calls
      const postCalls = (fetchMock.mock.calls as Array<[string, RequestInit?]>)
        .slice(initialCallCount)
        .filter(([, opts]) => opts?.method === 'POST')
      expect(postCalls.length).toBe(0)
    })
  })
})
