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

function marker(overrides: Partial<SignMarker>): SignMarker {
  return {
    id: 'mk-' + Math.random(),
    lat: 63.1,
    lon: 27.1,
    type: 'left',
    distanceFromStart: 7000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

describe('T199 — SegmentDetailsModal yhtenäinen merkit & varusteet -lista', () => {
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

  it('per-merkki-rivi näyttää oikean merkkivisuaalin (ei enää pelkkää tekstiä)', () => {
    const { container } = setup([marker({ type: 'right' })])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const item = document.querySelector('.segment-details-marker-item')!
    expect(item.querySelector('.marker-visual-row-sv')).toBeTruthy()
  })

  it('per-merkki-rivi näyttää km-lukeman erillisessä spanissa', () => {
    const { container } = setup([marker({ type: 'right', distanceFromStart: 8400 })])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const km = document.querySelector('.segment-details-marker-km')
    expect(km?.textContent).toBe('8.4 km')
  })

  it('tuplamerkki (parts) renderöi ilman kulmabadgea per-merkki-rivillä', () => {
    const { container } = setup([
      marker({ type: 'combo', label: 'Risteys', parts: [{ iconId: 'arrow-left' }, { iconId: 'arrow-right' }] }),
    ])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const item = document.querySelector('.segment-details-marker-item')!
    expect(item.querySelectorAll('.marker-visual-row-combo-slot')).toHaveLength(2)
    expect(item.querySelector('.badge-combo')).toBeFalsy()
  })

  it('zoom-nappi rivillä avaa lightboxin oikealla merkillä', () => {
    const { container } = setup([marker({ type: 'left', label: 'Vasemmalle' })])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const zoomBtn = document.querySelector<HTMLButtonElement>('.segment-details-marker-item .marker-visual-row-zoom')!
    zoomBtn.click()
    expect(document.querySelector('.marker-visual-lightbox')).toBeTruthy()
    expect(document.querySelector('.marker-visual-lightbox-caption')?.textContent).toBe('Vasemmalle')
  })

  it('yhteenveto-chip näyttää oikean lukumäärän groupitettuna tyypin mukaan', () => {
    const { container } = setup([
      marker({ type: 'left', label: 'Vasemmalle' }),
      marker({ type: 'left', label: 'Vasemmalle' }),
      marker({ type: 'right', label: 'Oikealle' }),
    ])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const chips = document.querySelectorAll('.segment-equipment-chip')
    expect(chips).toHaveLength(2)
    const counts = Array.from(chips).map(c => c.querySelector('.segment-equipment-chip-count')?.textContent)
    expect(counts).toContain('2×')
    expect(counts).toContain('1×')
    const names = Array.from(chips).map(c => c.querySelector('.segment-equipment-chip-name')?.textContent)
    expect(names).toContain('Vasemmalle')
    expect(names).toContain('Oikealle')
  })

  it('yhteenveto-chip ei sisällä zoom-nappia', () => {
    const { container } = setup([marker({ type: 'left', label: 'Vasemmalle' })])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const chip = document.querySelector('.segment-equipment-chip')!
    expect(chip.querySelector('.marker-visual-row-zoom')).toBeFalsy()
  })

  it('manuaalinen lisävaruste-lisäys toimii ennallaan (regressio)', async () => {
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

  it('manuaalinen lisävaruste-poisto toimii ennallaan (regressio)', async () => {
    const { container, store } = setup()
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    const removeBtn = document.querySelector('.btn-equipment-remove') as HTMLButtonElement
    removeBtn.click()
    await flush()
    const seg = Array.from(store.values())[0]
    expect(seg.equipment).toHaveLength(0)
  })

  it('ei merkkejä → ei merkkilistaa eikä yhteenveto-chippejä, manuaalilista näkyy silti', () => {
    const { container } = setup([])
    const openBtn = container.querySelector('.btn-segment-details-open') as HTMLButtonElement
    openBtn.click()
    expect(document.querySelector('.segment-details-marker-list')).toBeNull()
    expect(document.querySelector('.segment-equipment-chip-list')).toBeNull()
    expect(document.querySelector('.equipment-name-input')).toBeTruthy()
  })
})
