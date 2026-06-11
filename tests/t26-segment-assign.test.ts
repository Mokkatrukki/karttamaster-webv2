import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

const flush = () => new Promise(r => setTimeout(r, 0))

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response))
}

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
    displayName: 'Pätkä 1',
  })

  const panel = new SegmentPanel(container, [], store, vi.fn())
  return { container, store, panel }
}

describe('T26 — Segment assign flow', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
    mockFetchOk()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('näyttää assign-lomake kun pätkä ei ole jaettu', () => {
    const { container } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    expect(codeInput).not.toBeNull()
    expect(codeInput.placeholder).toBe('Koodi')
  })

  it('tallentaa assignedCode + displayName kun Tallenna klikataan', async () => {
    const { container, store } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const nameInput = container.querySelector('.input-assign-name') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    nameInput.value = 'Matin pätkä'
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBe('matti123')
    expect(seg.displayName).toBe('Matin pätkä')
  })

  it('ei tallenna kun koodi on tyhjä', async () => {
    const { container, store } = setup()
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
  })

  it('näyttää URL ja kopiointinappi kun assignedCode on asetettu', async () => {
    const { container } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    saveBtn.click()
    await flush()

    const urlSpan = container.querySelector('.segment-url')
    const copyBtn = container.querySelector('.btn-copy-url')
    expect(urlSpan?.textContent).toBe('/s/matti123')
    expect(copyBtn).not.toBeNull()
  })

  it('URL muotoa /s/<koodi> (V27)', async () => {
    const { container } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'pekkanen'
    saveBtn.click()
    await flush()

    const urlSpan = container.querySelector('.segment-url')
    expect(urlSpan?.textContent).toMatch(/^\/s\/[a-z0-9]+$/)
    expect(urlSpan?.textContent).toBe('/s/pekkanen')
  })

  it('Muuta-nappi poistaa assignedCode ja näyttää lomakkeen uudelleen', async () => {
    const { container, store } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    saveBtn.click()
    await flush()

    const editBtn = container.querySelector('.btn-assign-edit') as HTMLButtonElement
    editBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const newCodeInput = container.querySelector('.input-assign-code')
    expect(newCodeInput).not.toBeNull()
  })

  it('käyttää segment displayName kenttäarvona nimen inputissa', () => {
    const { container } = setup()
    const nameInput = container.querySelector('.input-assign-name') as HTMLInputElement
    expect(nameInput.value).toBe('Pätkä 1')
  })
})

describe('T59 — Assign-sync: backend API calls (V34)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saveBtn kutsuu POST /api/admin/codes ennen localStorage-päivitystä (V34)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    codeInput.value = 'tiimi1'
    saveBtn.click()
    await flush()

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/codes', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"tiimi1"'),
    }))
    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBe('tiimi1')
  })

  it('API-virhe → localStorage ei päivity, näyttää virheen (V34)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response))

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen' })
    new SegmentPanel(container, [], store, vi.fn())

    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    codeInput.value = 'tiimi1'
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const errorEl = container.querySelector('.assign-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
    expect(errorEl.textContent).toContain('Virhe')
  })

  it('Muuta-nappi kutsuu DELETE /api/admin/codes/:code (V34)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    codeInput.value = 'tiimi1'
    saveBtn.click()
    await flush()

    const editBtn = container.querySelector('.btn-assign-edit') as HTMLButtonElement
    editBtn.click()
    await flush()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/codes/tiimi1', { method: 'DELETE' })
    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
  })

  it('network error save → localStorage ei päivity (V34)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen' })
    new SegmentPanel(container, [], store, vi.fn())

    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    codeInput.value = 'tiimi1'
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const errorEl = container.querySelector('.assign-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
  })
})
