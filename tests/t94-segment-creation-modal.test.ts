import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

const ROUTE_POINTS = [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.1, lon: 25.1, distanceFromStart: 5000 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
]

const ROUTES = [{ id: 'r1', routePoints: ROUTE_POINTS }]

function setup(store?: SegmentStore) {
  const s = store ?? createSegmentStore()
  const container = document.createElement('div')
  document.body.appendChild(container)

  const callbacks = {
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    onFirstPoint: vi.fn(),
    onFirstPointClear: vi.fn(),
  }

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id-' + Math.random() })

  const panel = new SegmentPanel(container, ROUTES, s, vi.fn(), callbacks)
  // Expand panel so footer button (#btn-segment-create) is rendered
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  return { panel, store: s, callbacks, container }
}

describe('T94 — pätkäluonti-modal tilakone', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('aluksi ei modaalia', () => {
    setup()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
  })

  it('isCreationMode() false alussa', () => {
    const { panel } = setup()
    expect(panel.isCreationMode()).toBe(false)
  })

  it('"Luo uusi pätkä" avaa modaalin ja kutsuu onEnterCreationMode', () => {
    const { callbacks } = setup()
    const createBtn = document.querySelector('#btn-segment-create') as HTMLButtonElement
    createBtn.click()
    expect(document.querySelector('[data-testid="creation-modal"]')).toBeTruthy()
    expect(callbacks.onEnterCreationMode).toHaveBeenCalledOnce()
    expect(callbacks.onShowSnapMarkers).toHaveBeenCalledOnce()
  })

  it('isCreationMode() true vaihe1:ssä', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    expect(panel.isCreationMode()).toBe(true)
  })

  it('vaihe1: näyttää ohjetekstin "Klikkaa kartalta aloituspiste"', () => {
    setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    const modal = document.querySelector('.segment-creation-modal')!
    expect(modal.textContent).toContain('Klikkaa kartalta aloituspiste')
  })

  it('peruuta-nappi sulkee modaalin ja palauttaa idle', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    const cancelBtn = document.querySelector('.segment-creation-modal-cancel') as HTMLButtonElement
    cancelBtn.click()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
    expect(panel.isCreationMode()).toBe(false)
    expect(callbacks.onExitCreationMode).toHaveBeenCalledOnce()
    expect(callbacks.onHideSnapMarkers).toHaveBeenCalledOnce()
  })

  it('cancelCreation() sulkee modaalin ja palauttaa idle', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.cancelCreation()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
    expect(panel.isCreationMode()).toBe(false)
    expect(callbacks.onExitCreationMode).toHaveBeenCalledOnce()
  })

  it('Esc sulkee modaalin', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    expect(panel.isCreationMode()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(panel.isCreationMode()).toBe(false)
  })

  it('ensimmäinen mapClick siirtää vaihe2:een', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    expect(callbacks.onFirstPoint).toHaveBeenCalledOnce()
    const modal = document.querySelector('.segment-creation-modal')!
    expect(modal.textContent).toContain('Klikkaa kartalta lopetuspiste')
  })

  it('toinen mapClick riittävän kaukana siirtää tiedot-vaiheeseen', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    const modal = document.querySelector('.segment-creation-modal')!
    expect(modal.textContent).toContain('Tallenna')
  })

  it('toinen mapClick liian lähellä näyttää virheen', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.0, 25.0) // same point
    const errorEl = document.querySelector('.segment-creation-error') as HTMLElement
    expect(errorEl?.hidden).toBe(false)
    expect(errorEl?.textContent).toContain('liian lähellä')
  })

  it('overlap näyttää virheen', () => {
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['r1'], startDist: 0, endDist: 6000, equipment: [], phase: 'asettaminen' }, 'existing')
    const { panel } = setup(store)
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0) // dist ~0
    panel.onMapClick(65.1, 25.1) // dist ~5000 — overlaps [0,6000]
    const errorEl = document.querySelector('.segment-creation-error') as HTMLElement
    expect(errorEl?.hidden).toBe(false)
    expect(errorEl?.textContent).toContain('päällekkäin')
  })

  it('tiedot-vaiheessa mapClick ei tee mitään', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    // In tiedot phase
    expect(document.querySelector('.btn-segment-creation-save')).toBeTruthy()
    const beforeHtml = document.querySelector('.segment-creation-modal')!.innerHTML
    panel.onMapClick(65.1, 25.1) // should be ignored
    expect(document.querySelector('.segment-creation-modal')!.innerHTML).toBe(beforeHtml)
  })
})
