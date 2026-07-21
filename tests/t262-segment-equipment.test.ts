import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SegmentEquipment } from '../src/ui/segment-equipment'
import { loadChecked, checkKeyForType, checkKeyForItem } from '../src/logic/varustarkastus'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T262/V182 — KOTI-inline-varustelista (SegmentEquipment). Vitest-jsdom.
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
function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status: 'suunniteltu', ...overrides,
  }
}

function mount(seg: Segment, markers: SignMarker[], onEdit = () => {}): { el: HTMLElement; comp: SegmentEquipment } {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const comp = new SegmentEquipment(el, {
    getSegment: () => seg,
    getMarkers: () => markers,
    onEdit,
  })
  comp.render()
  return { el, comp }
}

describe('T262 — SegmentEquipment (KOTI-inline-varustelista)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    document.body.innerHTML = ''
  })

  it('renderöi auto-laskurin merkkityypeittäin + otsikon + Muokkaa-napin', () => {
    const { el } = mount(makeSeg(), [makeMarker({ type: 'right' }), makeMarker({ id: 'm2', type: 'right' }), makeMarker({ id: 'm3', type: 'left' })])
    expect(el.querySelector('.segment-view-equipment-title')?.textContent).toContain('Varustelista')
    expect(el.querySelector('.segment-view-equipment-edit')).not.toBeNull()
    const autoTexts = [...el.querySelectorAll('.equipment-auto-item .equipment-check-label')].map(n => n.textContent)
    expect(autoTexts).toContain('2× Oikealle')
    expect(autoTexts).toContain('1× Vasemmalle')
  })

  it('renderöi manuaalirivit (readonly + checkoff)', () => {
    const { el } = mount(makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), [])
    const labels = [...el.querySelectorAll('.equipment-check-label')].map(n => n.textContent)
    expect(labels).toContain('5× Nauha')
  })

  it('tyhjä manuaalilista → empty-viesti', () => {
    const { el } = mount(makeSeg(), [makeMarker()])
    expect(el.querySelector('.segment-view-equipment-empty')).not.toBeNull()
  })

  it('checkoff togglaa + persistoi client-only + päivittää edistymän', () => {
    const seg = makeSeg()
    const { el } = mount(seg, [makeMarker({ type: 'right' })])
    const progress = el.querySelector('.segment-view-equipment-progress') as HTMLElement
    expect(progress.textContent).toBe('Varustarkastus: 0/1 otettu')
    const cb = el.querySelector('.equipment-check-box') as HTMLInputElement
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    expect(progress.textContent).toBe('Varustarkastus: 1/1 otettu')
    expect(progress.classList.contains('equipment-modal-progress--done')).toBe(true)
    // Persistoi client-only (localStorage per pätkä).
    expect(loadChecked(seg.id).has(checkKeyForType('right'))).toBe(true)
  })

  it('checkoff-avaimet identtiset EquipmentModalin kanssa (V182 parity)', () => {
    const seg = makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] })
    const { el } = mount(seg, [makeMarker({ type: 'right' })])
    // Rastita molemmat inlinesta.
    ;(el.querySelectorAll('.equipment-check-box') as NodeListOf<HTMLInputElement>).forEach(cb => {
      cb.checked = true
      cb.dispatchEvent(new Event('change'))
    })
    const checked = loadChecked(seg.id)
    // Samat avaimet joita EquipmentModal lukisi → checkoff näkyy myös modaalissa.
    expect(checked.has(checkKeyForType('right'))).toBe(true)
    expect(checked.has(checkKeyForItem('Nauha'))).toBe(true)
  })

  it('checkoff palautuu localStoragesta re-renderissä (persistointi)', () => {
    const seg = makeSeg()
    const { el, comp } = mount(seg, [makeMarker({ type: 'right' })])
    const cb = el.querySelector('.equipment-check-box') as HTMLInputElement
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    comp.render()
    const cb2 = el.querySelector('.equipment-check-box') as HTMLInputElement
    expect(cb2.checked).toBe(true)
    expect(el.querySelector('.equipment-check')?.classList.contains('equipment-check--done')).toBe(true)
  })

  it('"Muokkaa varusteita" kutsuu onEdit (→ EquipmentModal)', () => {
    let edited = false
    const { el } = mount(makeSeg(), [makeMarker()], () => { edited = true })
    ;(el.querySelector('.segment-view-equipment-edit') as HTMLButtonElement).click()
    expect(edited).toBe(true)
  })
})
