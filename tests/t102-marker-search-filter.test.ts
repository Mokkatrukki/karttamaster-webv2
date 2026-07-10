import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkerList } from '../src/ui/marker-list'
import type { MarkerManager } from '../src/map/markers'
import type { SignMarker } from '../src/logic/types'

type Partial = { type?: SignMarker['type']; label?: string; dist?: number; status?: SignMarker['status'] }

function makeMarker(id: string, p: Partial = {}): SignMarker {
  return {
    id,
    type: p.type ?? 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: p.dist ?? 1000,
    routeIds: ['35km'],
    status: p.status ?? 'suunniteltu',
    ...(p.label ? { label: p.label } : {}),
  }
}

function makeManager(markers: SignMarker[], bulkSetStatus = vi.fn()): MarkerManager {
  return {
    getAll: () => markers,
    panTo: vi.fn(),
    remove: vi.fn(),
    updateNote: vi.fn(),
    updateStatus: vi.fn(),
    updateType: vi.fn(),
    bulkSetStatus,
  } as unknown as MarkerManager
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="marker-modal">
      <div id="marker-modal-header"></div>
      <div id="marker-modal-items"></div>
    </div>
    <span id="marker-count"></span>
  `
}

function setupLocalStorage() {
  let store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
}

// Näkyviä ovat rivit, joita ei ole suodatettu pois.
function visibleItems() {
  return Array.from(document.querySelectorAll<HTMLElement>('.marker-item'))
    .filter((el) => !el.classList.contains('marker-item--filtered-out'))
}

describe('T102 — Merkkilista-haku + tyyppifiltteri (V9, T10, T101)', () => {
  beforeEach(() => {
    setupDOM()
    setupLocalStorage()
    localStorage.setItem('karttamaster-role', 'järjestäjä')
  })

  it('filtteribar (haku + tyyppi + nollaus) näkyy järjestäjälle', () => {
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-filter-bar')).not.toBeNull()
    expect(document.getElementById('marker-search')).not.toBeNull()
    expect(document.getElementById('marker-type-filter')).not.toBeNull()
    expect(document.getElementById('marker-filter-clear')).not.toBeNull()
  })

  it('talkoolaisella filtteribar ei näy', () => {
    localStorage.setItem('karttamaster-role', 'talkoolainen')
    renderMarkerList(makeManager([makeMarker('m1')]))
    expect(document.getElementById('marker-filter-bar')).toBeNull()
  })

  it('haku rajaa listaa labelin mukaan', () => {
    const markers = [
      makeMarker('m1', { type: 'left' }),   // "Vasemmalle"
      makeMarker('m2', { type: 'right' }),  // "Oikealle"
      makeMarker('m3', { type: 'right' }),
    ]
    renderMarkerList(makeManager(markers))
    const search = document.getElementById('marker-search') as HTMLInputElement
    search.value = 'vasem'
    search.dispatchEvent(new Event('input'))
    const vis = visibleItems()
    expect(vis.length).toBe(1)
    expect(vis[0].dataset.id).toBe('m1')
  })

  it('haku rajaa listaa km-välin mukaan', () => {
    const markers = [
      makeMarker('m1', { dist: 1000 }),  // 1.00 km
      makeMarker('m2', { dist: 2500 }),  // 2.50 km
      makeMarker('m3', { dist: 5000 }),  // 5.00 km
    ]
    renderMarkerList(makeManager(markers))
    const search = document.getElementById('marker-search') as HTMLInputElement
    search.value = '2.50'
    search.dispatchEvent(new Event('input'))
    const vis = visibleItems()
    expect(vis.length).toBe(1)
    expect(vis[0].dataset.id).toBe('m2')
  })

  it('tyyppifiltteri rajaa listaa', () => {
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
      makeMarker('m3', { type: 'left' }),
    ]
    renderMarkerList(makeManager(markers))
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))
    const vis = visibleItems()
    expect(vis.length).toBe(2)
    expect(vis.map((e) => e.dataset.id).sort()).toEqual(['m1', 'm3'])
  })

  it('haku + tyyppi yhdistyvät (AND)', () => {
    const markers = [
      makeMarker('m1', { type: 'left', dist: 1000 }),   // Vasemmalle 1.00
      makeMarker('m2', { type: 'left', dist: 3000 }),   // Vasemmalle 3.00
      makeMarker('m3', { type: 'right', dist: 3000 }),  // Oikealle 3.00
    ]
    renderMarkerList(makeManager(markers))
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    const search = document.getElementById('marker-search') as HTMLInputElement
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))
    search.value = '3.00'
    search.dispatchEvent(new Event('input'))
    const vis = visibleItems()
    expect(vis.length).toBe(1)
    expect(vis[0].dataset.id).toBe('m2')
  })

  it('tyhjä tulos näyttää "Ei tuloksia"', () => {
    renderMarkerList(makeManager([makeMarker('m1', { type: 'left' })]))
    const search = document.getElementById('marker-search') as HTMLInputElement
    search.value = 'zzz-ei-osumaa'
    search.dispatchEvent(new Event('input'))
    expect(visibleItems().length).toBe(0)
    const empty = document.querySelector('.filter-empty-state')
    expect(empty).not.toBeNull()
    expect(empty?.textContent).toBe('Ei tuloksia')
  })

  it('nollaus-nappi (✕) tyhjentää haun, tyypin ja valinnat', () => {
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
    ]
    renderMarkerList(makeManager(markers))
    const search = document.getElementById('marker-search') as HTMLInputElement
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    search.value = 'vasem'
    search.dispatchEvent(new Event('input'))
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))
    // select the visible checkbox
    const visCb = document.querySelector<HTMLInputElement>('.marker-item:not(.marker-item--filtered-out) .marker-item-checkbox[data-id]')!
    visCb.click()

    const clear = document.getElementById('marker-filter-clear') as HTMLButtonElement
    clear.click()

    expect(search.value).toBe('')
    expect(typeSel.value).toBe('')
    expect(visibleItems().length).toBe(2)
    const checked = Array.from(document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')).filter((c) => c.checked)
    expect(checked.length).toBe(0)
  })

  it('"Valitse kaikki" valitsee VAIN näkyvät (filtteröidyt) rivit', () => {
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
      makeMarker('m3', { type: 'left' }),
    ]
    renderMarkerList(makeManager(markers))
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))

    const selectAll = document.getElementById('bulk-select-all') as HTMLInputElement
    selectAll.click()

    const checkedIds = Array.from(document.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]'))
      .filter((c) => c.checked)
      .map((c) => c.dataset.id)
    expect(checkedIds.sort()).toEqual(['m1', 'm3'])
  })

  it('bulk "Aseta valituille" kohdistuu VAIN näkyviin riveihin', () => {
    const bulkFn = vi.fn()
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
      makeMarker('m3', { type: 'left' }),
    ]
    renderMarkerList(makeManager(markers, bulkFn))
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))

    // valitse kaikki näkyvät
    const selectAll = document.getElementById('bulk-select-all') as HTMLInputElement
    selectAll.click()

    const statusSel = document.getElementById('bulk-status-select') as HTMLSelectElement
    statusSel.value = 'asetettu'
    const applyBtn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    applyBtn.click()

    expect(bulkFn).toHaveBeenCalledOnce()
    const [ids, status] = bulkFn.mock.calls[0]
    expect(ids.sort()).toEqual(['m1', 'm3'])
    expect(ids).not.toContain('m2')
    expect(status).toBe('asetettu')
  })

  it('aiemmin valittu, sitten filtteröity-pois rivi jää bulkin ulkopuolelle', () => {
    const bulkFn = vi.fn()
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
    ]
    renderMarkerList(makeManager(markers, bulkFn))
    // valitse m2 (right) ennen filtteriä
    const cbM2 = document.querySelector<HTMLInputElement>('.marker-item[data-id="m2"] .marker-item-checkbox')!
    cbM2.click()
    expect(cbM2.checked).toBe(true)

    // filtteröi tyyppiin left → m2 piiloutuu
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    typeSel.value = 'left'
    typeSel.dispatchEvent(new Event('change'))

    // valitse näkyvät (m1)
    const cbM1 = document.querySelector<HTMLInputElement>('.marker-item[data-id="m1"] .marker-item-checkbox')!
    cbM1.click()

    const applyBtn = document.getElementById('btn-bulk-apply') as HTMLButtonElement
    applyBtn.click()

    const [ids] = bulkFn.mock.calls[0]
    expect(ids).toContain('m1')
    expect(ids).not.toContain('m2')
  })

  it('tyyppifiltterissä on optio jokaiselle listalla olevalle tyypille', () => {
    const markers = [
      makeMarker('m1', { type: 'left' }),
      makeMarker('m2', { type: 'right' }),
      makeMarker('m3', { type: 'left' }),
    ]
    renderMarkerList(makeManager(markers))
    const typeSel = document.getElementById('marker-type-filter') as HTMLSelectElement
    const optionValues = Array.from(typeSel.options).map((o) => o.value)
    expect(optionValues).toContain('left')
    expect(optionValues).toContain('right')
    // ei duplikaatteja + tyhjä "kaikki" -optio ensimmäisenä
    expect(optionValues[0]).toBe('')
    expect(optionValues.filter((v) => v === 'left').length).toBe(1)
  })
})
