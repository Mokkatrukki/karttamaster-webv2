import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

const flush = () => new Promise(r => setTimeout(r, 0))

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response))
}

function setup(extraMarkers: SignMarker[] = []) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [{ name: 'nauhaa', count: 3 }],
    phase: 'asettaminen',
    displayName: 'Testipätkä',
    description: 'Alkuperäinen kuvaus',
  })

  const panel = new SegmentPanel(container, [], store, vi.fn(), {
    getMarkers: () => extraMarkers,
  })
  return { container, store, panel }
}

describe('T69 — SegmentDetailsModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    mockFetchOk()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pätkärivillä on "Lisätiedot & varusteet" -nappi (ei inline toggle)', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open')
    expect(openBtn).not.toBeNull()
    // vanha inline toggle ei enää olemassa
    expect(container.querySelector('.btn-segment-details-toggle')).toBeNull()
  })

  it('nappi avaa modaalin document.body:yyn', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const backdrop = document.querySelector('.segment-details-modal-backdrop')
    const modal = document.querySelector('.segment-details-modal')
    expect(backdrop).not.toBeNull()
    expect(modal).not.toBeNull()
  })

  it('modaali näyttää pätkän nimen', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const title = document.querySelector('.segment-details-modal-title')
    expect(title?.textContent).toBe('Testipätkä')
  })

  it('modaali näyttää kuvauksen tekstialueessa', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const descInput = document.querySelector('.segment-desc-input') as HTMLTextAreaElement
    expect(descInput).not.toBeNull()
    expect(descInput.value).toBe('Alkuperäinen kuvaus')
  })

  it('modaali näyttää manuaalivarusteet', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const equipInputs = document.querySelectorAll('.equipment-name-input')
    expect(equipInputs.length).toBeGreaterThan(0)
    expect((equipInputs[0] as HTMLInputElement).value).toBe('nauhaa')
  })

  it('suljetaan ✕-napilla', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    expect(document.querySelector('.segment-details-modal')).not.toBeNull()
    const closeBtn = document.querySelector('.segment-details-modal-close') as HTMLButtonElement
    closeBtn.click()
    expect(document.querySelector('.segment-details-modal-backdrop')).toBeNull()
  })

  it('suljetaan Escape-näppäimellä', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    expect(document.querySelector('.segment-details-modal')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.segment-details-modal-backdrop')).toBeNull()
  })

  it('suljetaan backdrop-klikillä', () => {
    const { container } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const backdrop = document.querySelector('.segment-details-modal-backdrop') as HTMLElement
    backdrop.click()
    expect(document.querySelector('.segment-details-modal-backdrop')).toBeNull()
  })

  it('displayName-tallennus blur-eventissä päivittää storen', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const nameInput = document.querySelector('.segment-details-name-input') as HTMLInputElement
    nameInput.value = 'Uusi nimi'
    nameInput.dispatchEvent(new Event('blur'))
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.displayName).toBe('Uusi nimi')
  })

  it('displayName-tallennus Enter-näppäimellä päivittää storen', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const nameInput = document.querySelector('.segment-details-name-input') as HTMLInputElement
    nameInput.value = 'Enter-nimi'
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.displayName).toBe('Enter-nimi')
  })

  it('description-tallennus change-eventissä päivittää storen', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const descInput = document.querySelector('.segment-desc-input') as HTMLTextAreaElement
    descInput.value = 'Uusi kuvaus'
    descInput.dispatchEvent(new Event('change'))
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.description).toBe('Uusi kuvaus')
  })

  it('varuste-lisäys "+ Lisää" -napilla', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const addInputs = document.querySelectorAll('.segment-equipment-add .equipment-name-input')
    const addBtn = document.querySelector('.btn-equipment-add') as HTMLButtonElement
    const nameInput = addInputs[addInputs.length - 1] as HTMLInputElement
    nameInput.value = 'Vasara'
    addBtn.click()
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.equipment.some(e => e.name === 'Vasara')).toBe(true)
  })

  it('varuste-poisto ✕-napilla', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const removeBtn = document.querySelector('.btn-equipment-remove') as HTMLButtonElement
    removeBtn.click()
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.equipment).toHaveLength(0)
  })

  it('merkkilista näytetään jos getMarkers palauttaa pätkän merkkejä', () => {
    const marker: SignMarker = {
      id: 'mk1',
      lat: 63.1,
      lon: 27.1,
      bearing: 90,
      type: 'right',
      distanceFromStart: 7000,
      routeIds: ['35km'],
      status: 'asetettu',
    }
    const { container } = setup([marker])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const markerList = document.querySelector('.segment-details-marker-list')
    expect(markerList).not.toBeNull()
    expect(markerList?.querySelectorAll('li').length).toBe(1)
    expect(markerList?.querySelector('.segment-details-marker-info')?.textContent).toContain('Oikealle')
    expect(markerList?.querySelector('.segment-details-marker-status')?.textContent).toContain('Asetettu')
  })

  it('merkkilista piilotettu jos pätkällä ei merkkejä', () => {
    const { container } = setup([])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    expect(document.querySelector('.segment-details-marker-list')).toBeNull()
  })
})
