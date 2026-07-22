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

function setup(displayName: string | null = 'Pätkä 1') {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
    displayName: displayName ?? undefined,
  })

  const panel = new SegmentPanel(container, [], store, vi.fn())
  return { container, store, panel }
}

function openModal(container: HTMLElement): void {
  const detailsBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
  detailsBtn.click()
}

describe('T26/T273/T276 — Segment assign flow (Model B, nimi→slug, V192)', () => {
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

  it('näyttää nimi-lomake modaalissa (ei käsin koodia) kun pätkä ei ole jaettu', () => {
    const { container } = setup()
    openModal(container)
    const codeInput = document.body.querySelector('.input-assign-code')
    const nameInput = document.body.querySelector('.input-assign-name') as HTMLInputElement
    expect(codeInput).toBeNull() // T273: käsin koodi-kenttä poistettu
    expect(nameInput).not.toBeNull()
    expect(nameInput.placeholder.toLowerCase()).toContain('näyttönimi')
    expect(nameInput.value).toBe('Pätkä 1') // esitäytetty displayName
  })

  it('T273: "Luo linkki" auto-generoi slugin nimestä', async () => {
    const { container, store } = setup()
    openModal(container)
    const saveBtn = document.body.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBe('patka-1') // "Pätkä 1" → slug
  })

  it('T273: uniikki slug — sama nimi eri pätkällä saa suffiksin', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 0, endDist: 1000, equipment: [], phase: 'asettaminen', displayName: 'Varikko', assignedCode: 'varikko' })
    createSegment(store, { routeIds: ['35km'], startDist: 2000, endDist: 3000, equipment: [], phase: 'asettaminen', displayName: 'Varikko' })
    new SegmentPanel(container, [], store, vi.fn())

    // avaa toinen (jakamaton) pätkä
    const btns = container.querySelectorAll('.btn-segment-details-open')
    ;(btns[btns.length - 1] as HTMLButtonElement).click()
    const saveBtn = document.body.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    const shared = Array.from(store.values()).find(s => s.assignedCode !== 'varikko')!
    expect(shared.assignedCode).toBe('varikko-2')
  })

  it('ei tallenna kun nimi tyhjä (ei displayNamea)', async () => {
    const { container, store } = setup(null)
    openModal(container)
    const saveBtn = document.body.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const errorEl = document.body.querySelector('.assign-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
  })

  it('V192: linkki + Kopioi näkyvät HETI ilman modaalin sulkemista/uudelleenavausta', async () => {
    const { container } = setup()
    openModal(container)
    const saveBtn = document.body.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    // EI openModal-uudelleenkutsua — linkin pitää olla jo näkyvissä
    expect(document.body.querySelector('.segment-details-modal')).not.toBeNull() // modal yhä auki
    const urlSpan = document.body.querySelector('.segment-url')
    const copyBtn = document.body.querySelector('.btn-copy-url')
    expect(urlSpan?.textContent).toBe('/s/patka-1')
    expect(copyBtn).not.toBeNull()
  })

  it('URL muotoa /s/<slug> ([a-z0-9-])', async () => {
    const { container } = setup('Reitti 55 — Maali')
    openModal(container)
    const saveBtn = document.body.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()
    await flush()

    const urlSpan = document.body.querySelector('.segment-url')
    expect(urlSpan?.textContent).toMatch(/^\/s\/[a-z0-9-]+$/)
    expect(urlSpan?.textContent).toBe('/s/reitti-55-maali')
  })

  it('V192: "Muuta" poistaa koodin ja näyttää lomakkeen HETI ilman uudelleenavausta', async () => {
    const { container, store } = setup()
    openModal(container)
    ;(document.body.querySelector('.btn-assign-save') as HTMLButtonElement).click()
    await flush()

    const editBtn = document.body.querySelector('.btn-assign-edit') as HTMLButtonElement
    editBtn.click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    expect(document.body.querySelector('.segment-details-modal')).not.toBeNull() // yhä auki
    expect(document.body.querySelector('.input-assign-name')).not.toBeNull() // lomake takaisin
  })

  it('pätkän nimi näkyy modaalin nimi-kentässä', () => {
    const { container } = setup()
    openModal(container)
    const nameInput = document.body.querySelector('.segment-details-name-input') as HTMLInputElement
    expect(nameInput.value).toBe('Pätkä 1')
  })
})

describe('T59/T273 — Assign-sync: backend API calls (V34)', () => {
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

  it('saveBtn kutsuu POST /api/admin/codes slugilla + nimellä (V34)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    openModal(container)
    ;(document.body.querySelector('.btn-assign-save') as HTMLButtonElement).click()
    await flush()

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/codes', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"patka-1"'),
    }))
    expect(fetchMock.mock.calls[0][1].body).toContain('"Pätkä 1"')
    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBe('patka-1')
  })

  it('API-virhe → ei tallenneta, näyttää virheen (V34)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response))

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    openModal(container)
    ;(document.body.querySelector('.btn-assign-save') as HTMLButtonElement).click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const errorEl = document.body.querySelector('.assign-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
    expect(errorEl.textContent).toContain('Virhe')
  })

  it('Muuta-nappi kutsuu DELETE /api/admin/codes/:slug (V34)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    openModal(container)
    ;(document.body.querySelector('.btn-assign-save') as HTMLButtonElement).click()
    await flush()

    const editBtn = document.body.querySelector('.btn-assign-edit') as HTMLButtonElement
    editBtn.click()
    await flush()

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/codes/patka-1', { method: 'DELETE' })
    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
  })

  it('network error save → ei tallenneta (V34)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    new SegmentPanel(container, [], store, vi.fn())

    openModal(container)
    ;(document.body.querySelector('.btn-assign-save') as HTMLButtonElement).click()
    await flush()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const errorEl = document.body.querySelector('.assign-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
  })
})
