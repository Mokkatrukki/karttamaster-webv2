import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

const ROUTES = [{ id: 'r1', routePoints: [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
] }]

function makeMarker(id: string, templateId?: string, label?: string): SignMarker {
  return { id, type: 'right', lat: 0, lon: 0, distanceFromStart: 100, routeIds: ['r1'], status: 'suunniteltu',
    ...(templateId ? { templateId } : {}), ...(label ? { label } : {}) }
}

function setup(markers: SignMarker[] = [], store?: SegmentStore) {
  const s = store ?? createSegmentStore()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const callbacks = {
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    getMarkers: () => markers,
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'seg-' + Math.random() })
  const panel = new SegmentPanel(container, ROUTES, s, vi.fn(), callbacks)
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  return { panel, store: s, callbacks, container }
}

describe('T216 — reitittömän (alue)tehtävän luonti', () => {
  beforeEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

  it('"Luo aluetehtävä" -nappi näkyy laajennettuna', () => {
    setup()
    expect(document.querySelector('#btn-segment-create-routeless')).toBeTruthy()
  })

  it('avaa modaalin reititön-tilassa (otsikko "Luo aluetehtävä", ei reitti-ohjetta)', () => {
    setup()
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    const modal = document.querySelector('.segment-creation-modal')!
    expect(modal).toBeTruthy()
    expect(modal.querySelector('.segment-creation-modal-title')!.textContent).toBe('Luo aluetehtävä')
    expect(modal.textContent).not.toContain('Klikkaa kartalta')
  })

  it('Tallenna luo reitittömän tehtävän ilman route-kenttiä', () => {
    const { store } = setup()
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    const nameInput = document.querySelector('.segment-creation-name-input') as HTMLInputElement
    nameInput.value = 'Maalialue'
    const descInput = document.querySelector('.segment-creation-desc-input') as HTMLTextAreaElement
    descInput.value = 'Kerää maalialueen kyltit'
    ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()

    const segs = Array.from(store.values())
    expect(segs).toHaveLength(1)
    expect(segs[0].displayName).toBe('Maalialue')
    expect(segs[0].description).toBe('Kerää maalialueen kyltit')
    expect(segs[0].routeIds).toBeUndefined()
    expect(segs[0].startDist).toBeUndefined()
    expect(segs[0].endDist).toBeUndefined()
  })

  it('tyyppisuodatin-dropdown listaa uniikit templateId:t olemassa olevista merkeistä', () => {
    setup([makeMarker('m1', 'keräyskasa', 'Keräyskasa'), makeMarker('m2', 'keräyskasa', 'Keräyskasa'), makeMarker('m3', 'wc', 'WC')])
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    const select = document.querySelector('.segment-creation-typefilter') as HTMLSelectElement
    expect(select).toBeTruthy()
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toContain('keräyskasa')
    expect(values).toContain('wc')
    // uniikki: keräyskasa vain kerran
    expect(values.filter(v => v === 'keräyskasa')).toHaveLength(1)
  })

  it('tyyppisuodattimen valinta tallentuu markerTypeFilteriin', () => {
    const { store } = setup([makeMarker('m1', 'keräyskasa', 'Keräyskasa')])
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    const select = document.querySelector('.segment-creation-typefilter') as HTMLSelectElement
    select.value = 'keräyskasa'
    ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()
    expect(Array.from(store.values())[0].markerTypeFilter).toBe('keräyskasa')
  })

  it('merkkien rasti tallentuu linkedMarkerIds:iin', () => {
    const { store } = setup([makeMarker('m1', undefined, 'Kyltti 1'), makeMarker('m2', undefined, 'Kyltti 2')])
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    const checks = document.querySelectorAll('.segment-creation-marker-check input') as NodeListOf<HTMLInputElement>
    expect(checks).toHaveLength(2)
    checks[0].checked = true
    checks[0].dispatchEvent(new Event('change'))
    ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()
    expect(Array.from(store.values())[0].linkedMarkerIds).toEqual(['m1'])
  })

  it('reititön-tilassa kartta-klikki ei siirrä tilaa (ei route-poimintaa)', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    // ei kaadu, ei luo segmenttiä vahingossa
    expect(() => panel.onMapClick(65.05, 25.05)).not.toThrow()
    expect(document.querySelector('.segment-creation-modal-title')!.textContent).toBe('Luo aluetehtävä')
  })

  it('ei tyyppisuodatinta / checklistiä kun ei merkkejä', () => {
    setup([])
    ;(document.querySelector('#btn-segment-create-routeless') as HTMLButtonElement).click()
    expect(document.querySelector('.segment-creation-typefilter')).toBeNull()
    expect(document.querySelector('.segment-creation-marker-checklist')).toBeNull()
  })
})
