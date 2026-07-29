// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SegmentEquipment } from '../src/ui/segment-equipment'
import { EquipmentModal } from '../src/ui/equipment-modal'
import { getEquipmentCounts } from '../src/logic/equipment-counts'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

// T394/V285 — varustelista näyttää mitä pakata & mikä on jo maastossa. Vitest-jsdom.
// CLAUDE.md: localStorage aina vi.stubGlobal-mock (natiivi konfliktoi Node v26:ssa).
function mockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1', routeIds: ['35km'], startDist: 0, endDist: 10000,
    equipment: [], phase: 'asettaminen', displayName: 'Pätkä', ...overrides,
  }
}

let n = 0
function mk(type: string, status: MarkerStatus): SignMarker {
  return {
    id: `m${n++}`, type, lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status,
  }
}

function mountInline(seg: Segment, markers: SignMarker[]): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  new SegmentEquipment(el, {
    getSegment: () => seg,
    getMarkers: () => markers,
    onEdit: () => {},
  }).render()
  return el
}

function rows(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('.equipment-auto-list .equipment-check')]
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.stubGlobal('localStorage', mockLocalStorage())
})

describe('SegmentEquipment — iso luku = ota mukaan (V285)', () => {
  it('näyttää jäljellä olevat, ei kokonaismäärää', () => {
    const el = mountInline(makeSeg(), [
      ...Array.from({ length: 4 }, () => mk('right', 'suunniteltu')),
      ...Array.from({ length: 6 }, () => mk('right', 'asetettu')),
    ])
    const label = el.querySelector('.equipment-check-label')!
    expect(label.textContent).toContain('4×')
    expect(label.textContent).not.toContain('10×')
  })

  it('meta kertoo mikä on jo maastossa', () => {
    const el = mountInline(makeSeg(), [
      mk('right', 'suunniteltu'), mk('right', 'asetettu'), mk('right', 'asetettu'),
    ])
    expect(el.querySelector('.equipment-count-meta')!.textContent).toBe('2/3 asetettu')
  })

  it('done = 0 → ⊥ metaa DOM:issa (ei kohinaa ennen lähtöä)', () => {
    const el = mountInline(makeSeg(), [mk('right', 'suunniteltu'), mk('right', 'suunniteltu')])
    expect(el.querySelector('.equipment-count-meta')).toBeNull()
  })

  it('take = 0 → rivi saa --done-kohtelun & rasti pois käytöstä', () => {
    const el = mountInline(makeSeg(), [mk('right', 'asetettu'), mk('right', 'asetettu')])
    const row = rows(el)[0]
    expect(row.classList.contains('equipment-check--done')).toBe(true)
    expect(row.querySelector<HTMLInputElement>('.equipment-check-box')!.disabled).toBe(true)
  })

  it('purku-phase kääntää sanan & luvun', () => {
    const el = mountInline(makeSeg({ phase: 'purku' }), [
      mk('right', 'asetettu'), mk('right', 'asetettu'), mk('right', 'kerätty'),
    ])
    expect(el.querySelector('.equipment-check-label')!.textContent).toContain('2×')
    expect(el.querySelector('.equipment-count-meta')!.textContent).toBe('1/3 kerätty')
  })
})

describe('SegmentEquipment — sektiorivi', () => {
  it('laskee V285-sanamuodon mukaan', () => {
    const el = mountInline(makeSeg(), [
      ...Array.from({ length: 10 }, () => mk('right', 'asetettu')),
      ...Array.from({ length: 10 }, () => mk('left', 'suunniteltu')),
    ])
    expect(el.querySelector('.equipment-summary')!.textContent)
      .toBe('Pätkällä 20 merkkiä · 10 jo asetettu · ota mukaan 10')
  })

  it('"ei tarpeen" -osa näkyy vain kun niitä on', () => {
    const ilman = mountInline(makeSeg(), [mk('right', 'suunniteltu')])
    expect(ilman.querySelector('.equipment-summary')!.textContent).not.toContain('ei tarpeen')
    document.body.innerHTML = ''
    const kanssa = mountInline(makeSeg(), [mk('right', 'suunniteltu'), mk('left', 'ei_tarpeen')])
    expect(kanssa.querySelector('.equipment-summary')!.textContent).toContain('1 ei tarpeen')
  })

  it('tyhjä pätkä → ⊥ sektioriviä', () => {
    expect(mountInline(makeSeg(), []).querySelector('.equipment-summary')).toBeNull()
  })
})

describe('Varustarkastus-kytkös (V285/V182)', () => {
  it('täysin asetettu tyyppi ⊥ ole varustarkastuksen nimittäjässä', () => {
    // 'right' kokonaan maastossa, 'left' vielä otettava → nimittäjä 1, ei 2.
    const el = mountInline(makeSeg(), [
      mk('right', 'asetettu'), mk('left', 'suunniteltu'),
    ])
    expect(el.querySelector('.segment-view-equipment-progress')!.textContent)
      .toBe('Varustarkastus: 0/1 otettu')
  })

  it('kaikki tyypit maastossa + ei omia varusteita → nimittäjä 0 (⊥ ikuisesti kesken)', () => {
    const el = mountInline(makeSeg(), [mk('right', 'asetettu'), mk('left', 'kerätty')])
    expect(el.querySelector('.segment-view-equipment-progress')!.textContent)
      .toBe('Ei varusteita listalla vielä')
  })

  it('ei_tarpeen-only-tyyppi ⊥ tuota riviä eikä nimittäjää', () => {
    const el = mountInline(makeSeg(), [mk('right', 'ei_tarpeen')])
    expect(rows(el)).toHaveLength(0)
  })
})

describe('EquipmentModal jakaa saman laskennan (⊥ kolmea totuutta)', () => {
  it('modaali näyttää samat luvut kuin inline-lista samalla datalla', () => {
    const seg = makeSeg()
    const markers = [
      mk('right', 'suunniteltu'), mk('right', 'asetettu'),
      mk('left', 'asetettu'), mk('left', 'asetettu'),
    ]
    const inline = mountInline(seg, markers)
    const inlineTexts = rows(inline).map(r => r.textContent)

    const modal = new EquipmentModal(() => {})
    modal.open(seg, markers)
    const modalTexts = [...document.querySelectorAll<HTMLElement>('.equipment-modal-auto-list .equipment-check')]
      .map(r => r.textContent)
    modal.close()

    expect(modalTexts).toEqual(inlineTexts)
  })

  it('molemmat johtavat lukunsa getEquipmentCountsista (regressiovahti)', () => {
    const seg = makeSeg()
    const markers = [mk('right', 'suunniteltu'), mk('right', 'asetettu')]
    const expected = getEquipmentCounts(seg, markers)[0]
    const el = mountInline(seg, markers)
    expect(el.querySelector('.equipment-check-label')!.textContent).toContain(`${expected.take}×`)
    expect(el.querySelector('.equipment-count-meta')!.textContent)
      .toBe(`${expected.done}/${expected.total} ${expected.label}`)
  })
})

// SegmentDetailsModal (järjestäjä) käyttää samaa laskentaa — t199 kattaa chipit vain
// pelkillä `suunniteltu`-merkeillä (regressiovahti: mikään ei muutu ennen lähtöä).
// Sekastatus jäi kattamatta ∴ tässä.
describe('SegmentDetailsModal-chipit jakavat saman laskennan (V285)', () => {
  const flush = () => new Promise(r => setTimeout(r, 0))

  async function openModal(markers: SignMarker[], phase: Segment['phase'] = 'asettaminen') {
    const { SegmentPanel } = await import('../src/ui/segment-panel')
    const { createSegmentStore, createSegment } = await import('../src/logic/segments')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, {
      routeIds: ['35km'], startDist: 0, endDist: 12000, equipment: [],
      phase, displayName: 'Testipätkä', description: '',
    })
    new SegmentPanel(container, [], store, vi.fn(), { getMarkers: () => markers })
    ;(container.querySelector('.segment-info') as HTMLButtonElement).click()
    await flush()
  }

  function chip(): HTMLElement {
    return document.querySelector<HTMLElement>('.segment-equipment-chip')!
  }

  it('chipin luku = ota mukaan, meta kertoo jo asetetut', async () => {
    await openModal([
      mk('left', 'suunniteltu'), mk('left', 'asetettu'), mk('left', 'asetettu'),
    ])
    expect(chip().querySelector('.segment-equipment-chip-count')!.textContent).toBe('1×')
    expect(chip().querySelector('.equipment-count-meta')!.textContent).toBe('2/3 asetettu')
  })

  it('kokonaan asetettu tyyppi → --done-chip, ⊥ katoa listalta', async () => {
    await openModal([mk('left', 'asetettu'), mk('left', 'asetettu')])
    expect(chip().classList.contains('segment-equipment-chip--done')).toBe(true)
    expect(chip().querySelector('.segment-equipment-chip-count')!.textContent).toBe('0×')
  })

  it('sektiorivi näkyy myös järjestäjälle — sama luku kuin talkoolaisella', async () => {
    const markers = [mk('left', 'asetettu'), mk('right', 'suunniteltu')]
    await openModal(markers)
    const jarjestaja = document.querySelector('.equipment-summary')!.textContent
    document.body.innerHTML = ''
    const talkoolainen = mountInline(makeSeg(), markers).querySelector('.equipment-summary')!.textContent
    expect(jarjestaja).toBe(talkoolainen)
  })

  it('ei_tarpeen-merkki ⊥ kasvata chipin nimittäjää', async () => {
    await openModal([mk('left', 'asetettu'), mk('left', 'ei_tarpeen')])
    expect(chip().querySelector('.equipment-count-meta')!.textContent).toBe('1/1 asetettu')
  })
})
