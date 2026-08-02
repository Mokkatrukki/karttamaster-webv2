// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SegmentMarkerList } from '../src/ui/segment-marker-list'
import type { MarkerStatus } from '../src/logic/marker-status'
import type { SignMarker } from '../src/logic/types'
import type { Segment } from '../src/logic/segments'

// T468/V355 — LISTA PUHUU VAIHEEN KIELTÄ (B202).
//
// Verification contract: sama merkkijoukko renderöitynä purkupätkälle & asetuspätkälle antaa
// ERI ryhmäotsikot & ERI kuittausstatuksen. Ennen tätä lista kovakoodasi asetusvaiheen jaon ∴
// purussa `asetettu|tarkistettu` (purkamatta) & `kerätty` (purettu) olivat SAMASSA ryhmässä &
// joukkokuittaus vei merkin `asetettu`uun ⊥ `kerätty`yn. Regressio olisi hiljainen: molemmat
// näyttäisivät listalta, väärä vain sille joka tietää mitä purussa pitäisi lukea.

function seg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-test', routeIds: ['35km'], primaryRouteId: '35km',
    startDist: 0, endDist: 100000, equipment: [], phase: 'asettaminen', ...overrides,
  }
}

const PURKU = seg({ phase: 'purku' })

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status: 'suunniteltu', ...overrides,
  }
}

function mount(
  markers: SignMarker[],
  segment: Segment,
  onBulkStatus?: (ids: string[], s: MarkerStatus) => void,
) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const list = new SegmentMarkerList(el, {
    getMarkers: () => markers,
    getSegment: () => segment,
    onOpenDetail: () => {},
    onBulkStatus,
  })
  list.render()
  return el
}

const groups = (el: HTMLElement) =>
  [...el.querySelectorAll('.segment-view-markers-group')].map(g => g.textContent!)

/** Minkä otsikon alla merkki on? Ryhmä = lähin edeltävä otsikko DOM-järjestyksessä. */
function groupOf(el: HTMLElement, id: string): string | null {
  const li = el.querySelector(`.segment-view-markers-item[data-id="${id}"]`)
  if (!li) return null
  let node: Element | null = li.closest('.segment-view-markers-list')
  while (node) {
    node = node.previousElementSibling
    if (node?.classList.contains('segment-view-markers-group')) return node.textContent!
  }
  return null
}

const checkbox = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLInputElement>(`.segment-view-markers-item[data-id="${id}"] .marker-item-checkbox`)

const primary = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.btn-bulk-checkin-aseta')!
const secondary = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.btn-bulk-checkin-ohita')!

// Sama joukko molempiin vaiheisiin — ero ! tulla VAIHEESTA ⊥ syötteestä.
const MIXED = [
  makeMarker({ id: 'suunniteltu-1', status: 'suunniteltu', distanceFromStart: 1000 }),
  makeMarker({ id: 'asetettu-1', status: 'asetettu', distanceFromStart: 2000 }),
  makeMarker({ id: 'tarkistettu-1', status: 'tarkistettu', distanceFromStart: 3000 }),
  makeMarker({ id: 'kerätty-1', status: 'kerätty', distanceFromStart: 4000 }),
  makeMarker({ id: 'ei-tarpeen-1', status: 'ei_tarpeen', distanceFromStart: 5000 }),
]

describe('T468/V355 — ryhmäotsikot & kuittaus tulevat vaihetavoitteesta', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('purussa purkamattomat & puretut ovat ERI ryhmissä (B202: olivat samassa)', () => {
    const el = mount(MIXED, PURKU)
    expect(groupOf(el, 'asetettu-1')).toBe('Purkamatta (2)')
    expect(groupOf(el, 'tarkistettu-1')).toBe('Purkamatta (2)')
    expect(groupOf(el, 'kerätty-1')).toBe('Puretut (1)')
    expect(groupOf(el, 'asetettu-1')).not.toBe(groupOf(el, 'kerätty-1'))
  })

  it('asetusvaihe säilyy bitti bitiltä ennallaan (asetettu·tarkistettu·kerätty = "Asetetut")', () => {
    const el = mount(MIXED, seg())
    expect(groups(el)).toEqual(['Asettamatta (1)', 'Asetetut (3)', 'Ei tarpeen (1)'])
    expect(groupOf(el, 'kerätty-1')).toBe('Asetetut (3)')
  })

  it('sama joukko, eri vaihe → eri otsikot (ero tulee vaiheesta, ei syötteestä)', () => {
    const asetus = groups(mount(MIXED, seg()))
    document.body.innerHTML = ''
    const purku = groups(mount(MIXED, PURKU))
    expect(purku).not.toEqual(asetus)
    expect(purku).toEqual([
      'Purkamatta (2)', 'Ei kuitattu asetetuksi (1)', 'Puretut (1)', 'Ei löytynyt (1)',
    ])
  })

  it('purussa `suunniteltu` on VÄLITILA omassa ryhmässään — ⊥ "asettamatta" (V326/B175)', () => {
    const el = mount(MIXED, PURKU)
    expect(groupOf(el, 'suunniteltu-1')).toBe('Ei kuitattu asetetuksi (1)')
  })

  it('avoin ryhmä on ENSIN & välitila ennen tehtyjä — järjestys on merkitys', () => {
    expect(groups(mount(MIXED, PURKU))).toEqual([
      'Purkamatta (2)', 'Ei kuitattu asetetuksi (1)', 'Puretut (1)', 'Ei löytynyt (1)',
    ])
  })

  it('tyhjät ryhmät jätetään pois', () => {
    const el = mount([makeMarker({ id: 'a', status: 'asetettu' })], PURKU)
    expect(groups(el)).toEqual(['Purkamatta (1)'])
  })

  it('purun joukkokuittaus vie `kerätty`yn ⊥ `asetettu`uun (B202: vei väärään tilaan)', () => {
    const onBulkStatus = vi.fn()
    const el = mount(MIXED, PURKU, onBulkStatus)
    checkbox(el, 'asetettu-1')!.click()
    expect(primary(el).textContent).toBe('✓ Kerää valitut (1)')
    primary(el).click()
    expect(onBulkStatus).toHaveBeenCalledWith(['asetettu-1'], 'kerätty')
  })

  it('purun sekundääri on "Ei löytynyt" ⊥ "Ei tarpeen" (T429/V319)', () => {
    const onBulkStatus = vi.fn()
    const el = mount(MIXED, PURKU, onBulkStatus)
    checkbox(el, 'tarkistettu-1')!.click()
    expect(secondary(el).textContent).toBe('Ei löytynyt (1)')
    secondary(el).click()
    expect(onBulkStatus).toHaveBeenCalledWith(['tarkistettu-1'], 'ei_tarpeen')
  })

  it('asetusvaiheen napit ennallaan (T409-sopimus ⊥ rikkoudu)', () => {
    const el = mount([makeMarker({ id: 'a' })], seg(), vi.fn())
    checkbox(el, 'a')!.click()
    expect(primary(el).textContent).toBe('✓ Aseta valituille (1)')
    expect(secondary(el).textContent).toBe('Ei tarpeen (1)')
  })

  it('purussa `ei_tarpeen` ⊥ saa checkboxia — se on vaiheen päätetila (V326)', () => {
    const el = mount(MIXED, PURKU, vi.fn())
    expect(checkbox(el, 'ei-tarpeen-1')).toBeNull()
    expect(checkbox(el, 'kerätty-1')).toBeNull()
    expect(checkbox(el, 'asetettu-1')).not.toBeNull()
    // Purun välitila on yhä valittavissa: se ⊥ ole päätetila & sen ! voida kuitata.
    expect(checkbox(el, 'suunniteltu-1')).not.toBeNull()
  })

  // KÄYTTÄYTYMISMUUTOS asetusvaiheessa (tietoinen, T409-sopimuksen tarkennus): `ei_tarpeen` oli
  // valittavissa koska globaali `isTerminal` näki sen siirtymän (`peru`). Tehtävän kannalta se on
  // päätetila ∴ checkbox lupasi joukkokuittausta jolle ⊥ ole kohdetta. Paluu ⊥ katoa: rivin oma
  // ↩-nappi (T437/V323) purkaa sen samaa reittiä.
  it('asetusvaiheessa `ei_tarpeen` ⊥ enää saa checkboxia — päätetila luetaan tehtävästä', () => {
    const el = mount(MIXED, seg(), vi.fn())
    expect(checkbox(el, 'ei-tarpeen-1')).toBeNull()
    expect(el.querySelector('.segment-view-markers-item[data-id="ei-tarpeen-1"] .segment-view-markers-revert'))
      .not.toBeNull()
    expect(checkbox(el, 'suunniteltu-1')).not.toBeNull()
  })

  it('keräystehtävä (markerTypeFilter) saa OMAT sanansa vaikka phase on asettaminen (V143)', () => {
    const kasat = seg({ markerTypeFilter: 'pile', phase: 'asettaminen' })
    const el = mount([
      makeMarker({ id: 'hakematta', status: 'suunniteltu', distanceFromStart: 1000 }),
      makeMarker({ id: 'haettu', status: 'kerätty', distanceFromStart: 2000 }),
    ], kasat, vi.fn())
    expect(groups(el)).toEqual(['Hakematta (1)', 'Haetut (1)'])
    checkbox(el, 'hakematta')!.click()
    expect(primary(el).textContent).toBe('✓ Hae valitut (1)')
  })
})
