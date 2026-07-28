// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MapFilterBar } from '../src/ui/map-filter-bar'
import type { MapFilter } from '../src/logic/map-filter'

// T377/V272: suodatinbar — kartan "mitä näkyy" -kontrollit yhdessä paikassa. Bar PÄÄTTÄÄ tilan
// & huutaa onChange; kartan soveltaminen on wiringin työ (V271). Taso 2 Vitest-jsdom.

const ROUTES = [
  { id: 'r1', label: '30 km', color: '#1D8CB4', event: 'SyöteMTB' },
  { id: 'r2', label: '55 km', color: '#4D6FCB', dashArray: '18 8', event: 'SyöteMTB' },
  { id: 'r3', label: '62 km', color: '#A58312', event: 'Gravel Fest' },
]

function stubStorage(): void {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
  })
}

function setup(opts: { narrow?: boolean; onIsolationClear?: () => void } = {}) {
  stubStorage()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const changes: MapFilter[] = []
  const bar = new MapFilterBar(container, {
    routes: ROUTES,
    getSegmentName: id => (id === 's1' ? 'Ykköspätkä' : undefined),
    narrow: opts.narrow,
    onIsolationClear: opts.onIsolationClear,
    onChange: f => changes.push(f),
  })
  return { bar, container, changes }
}

beforeEach(() => { document.body.replaceChildren() })

const rowByLabel = (container: HTMLElement, label: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('.map-filter-row'))
    .find(r => r.querySelector('.map-filter-row-label')?.textContent === label)!

describe('T377 — rakenne', () => {
  it('järjestäjä saa neljä akselia: Reitit · Pätkät · Merkit · Himmennys', () => {
    const { container } = setup()
    const labels = Array.from(container.querySelectorAll('.map-filter-trigger-label')).map(e => e.textContent)
    expect(labels).toEqual(['Reitit', 'Pätkät', 'Merkit', 'Himmennys'])
  })

  it('V137: uudelleenrakennus ⊥ jätä tuplakontrolleja (idempotentti render)', () => {
    const { container } = setup()
    expect(container.querySelectorAll('.map-filter-trigger')).toHaveLength(4)
  })

  it('reitit ryhmittyvät tapahtumittain & rivillä on swatch (V216: legenda vastaa karttaa)', () => {
    const { container } = setup()
    const groups = Array.from(container.querySelectorAll('.map-filter-group-label')).map(e => e.textContent)
    expect(groups).toContain('SyöteMTB')
    expect(groups).toContain('Gravel Fest')
    expect(container.querySelectorAll('.map-filter-swatch').length).toBe(ROUTES.length)
  })

  it('§A/V268: kaikki kontrollit ≥44px (min-height inline-tyyleistä riippumatta luokista)', () => {
    const { container } = setup()
    // jsdom ⊥ laske CSS:ää ∴ vahdi luokkasopimusta: jokainen klikattava on <button>, ⊥ div.
    const clickable = container.querySelectorAll('.map-filter-trigger, .map-filter-row, .map-filter-reset, .map-filter-only')
    for (const el of clickable) expect(el.tagName).toBe('BUTTON')
  })
})

describe('T377 — dropdownit avautuvat yksi kerrallaan', () => {
  it('toisen avaaminen sulkee ensimmäisen (⊥ kahta auki päällekkäin)', () => {
    const { container } = setup()
    const [routes, segments] = Array.from(container.querySelectorAll<HTMLButtonElement>('.map-filter-trigger'))
    routes.click()
    expect(routes.getAttribute('aria-expanded')).toBe('true')
    segments.click()
    expect(routes.getAttribute('aria-expanded')).toBe('false')
    expect(segments.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('T377 — reittiakseli', () => {
  it('reitin piilotus päivittää tilan & ilmoittaa muutoksen', () => {
    const { container, changes } = setup()
    rowByLabel(container, '30 km').click()
    expect(changes[changes.length - 1].visibleRouteIds).toEqual(['r2', 'r3'])
  })

  it('V6: viimeistä näkyvää reittiä ⊥ voi piilottaa', () => {
    const { container, bar } = setup()
    const only = container.querySelector<HTMLButtonElement>('.map-filter-route-row[data-route-id="r1"] .map-filter-only')!
    only.click()
    expect(bar.getFilter().visibleRouteIds).toEqual(['r1'])
    rowByLabel(container, '30 km').click()
    expect(bar.getFilter().visibleRouteIds).toEqual(['r1'])   // torjuttu
    expect(rowByLabel(container, '30 km').disabled).toBe(true)
  })

  it('"vain tämä" -oikotie: yksi klikki ⊥ N−1', () => {
    const { container, bar } = setup()
    container.querySelector<HTMLButtonElement>('.map-filter-route-row[data-route-id="r2"] .map-filter-only')!.click()
    expect(bar.getFilter().visibleRouteIds).toEqual(['r2'])
  })
})

describe('T377 — merkki- & pätkätilasuodattimet', () => {
  it('statuksen poisto rajaa; viimeistä ⊥ voi poistaa (V272)', () => {
    const { container, bar } = setup()
    for (const label of ['Asetettu', 'Tarkistettu', 'Kerätty', 'Ei tarpeen']) rowByLabel(container, label).click()
    expect([...bar.getFilter().markerStatuses]).toEqual(['suunniteltu'])
    rowByLabel(container, 'Suunniteltu').click()
    expect([...bar.getFilter().markerStatuses]).toEqual(['suunniteltu'])
  })

  it('pätkätila-suodatin rajaa ("vain kesken")', () => {
    const { container, bar } = setup()
    rowByLabel(container, 'Ei aloitettu').click()
    rowByLabel(container, 'Valmis').click()
    expect([...bar.getFilter().segmentStates]).toEqual(['kesken'])
  })

  it('himmennysporras on yksinvalinta & oletus vahva (V243-amend)', () => {
    const { container, bar } = setup()
    expect(bar.getFilter().dimLevel).toBe('vahva')
    rowByLabel(container, 'Piilota kokonaan').click()
    expect(bar.getFilter().dimLevel).toBe('piilota')
    expect(rowByLabel(container, 'Piilota kokonaan').getAttribute('aria-pressed')).toBe('true')
    expect(rowByLabel(container, 'Vahva himmennys').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('T377/V272 — suodatettu kartta kertoo olevansa suodatettu', () => {
  it('oletustilassa ⊥ banneria eikä nollausnappia', () => {
    const { container } = setup()
    expect(container.dataset.activeFilters).toBe('0')
    expect(container.querySelector<HTMLElement>('.map-filter-banner')!.hidden).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('.map-filter-reset')!.hidden).toBe(true)
  })

  it('rajaus → laskuri, banneri & nollaus näkyviin', () => {
    const { container } = setup()
    rowByLabel(container, 'Asetettu').click()
    expect(container.dataset.activeFilters).toBe('1')
    const banner = container.querySelector<HTMLElement>('.map-filter-banner')!
    expect(banner.hidden).toBe(false)
    expect(banner.textContent).toContain('Suodatin päällä (1)')
    expect(container.querySelector<HTMLButtonElement>('.map-filter-reset')!.hidden).toBe(false)
  })

  it('nollaus palauttaa oletukset & ilmoittaa muutoksen', () => {
    const { container, bar, changes } = setup()
    rowByLabel(container, 'Asetettu').click()
    rowByLabel(container, 'Valmis').click()
    container.querySelector<HTMLButtonElement>('.map-filter-reset')!.click()
    expect(container.dataset.activeFilters).toBe('0')
    expect(bar.getFilter().markerStatuses.size).toBe(5)
    expect(bar.getFilter().segmentStates.size).toBe(3)
    expect(changes[changes.length - 1].isolatedSegmentId).toBeUndefined()
  })

  it('persistoitu tila menee kartalle heti latauksessa (⊥ bar väitä suodattavansa yksin)', () => {
    const { changes } = setup()
    expect(changes).toHaveLength(1)     // ctor kutsuu onChangen kertaalleen
  })
})

describe('T377 — isolointi on TILA ⊥ toinen laukaisin', () => {
  it('ilman isolointia paneeli kertoo mistä eristys tehdään', () => {
    const { container } = setup()
    expect(container.querySelector('.map-filter-isolation-hint')!.textContent).toContain('kartalta')
  })

  it('ulkoa asetettu isolointi näkyy nimellä & ✕ nollaa myös korostuksen', () => {
    const onIsolationClear = vi.fn()
    const { container, bar } = setup({ onIsolationClear })
    bar.setIsolatedSegment('s1')
    expect(container.querySelector('.map-filter-isolation-label')!.textContent).toBe('Vain: Ykköspätkä')
    container.querySelector<HTMLButtonElement>('.map-filter-isolation-clear')!.click()
    expect(bar.getFilter().isolatedSegmentId).toBeUndefined()
    expect(onIsolationClear).toHaveBeenCalledOnce()
  })

  it('nollaus barista sammuttaa korostuksen vain jos isolointi oli päällä', () => {
    const onIsolationClear = vi.fn()
    const { container, bar } = setup({ onIsolationClear })
    rowByLabel(container, 'Asetettu').click()
    container.querySelector<HTMLButtonElement>('.map-filter-reset')!.click()
    expect(onIsolationClear).not.toHaveBeenCalled()
    bar.setIsolatedSegment('s1')
    container.querySelector<HTMLButtonElement>('.map-filter-reset')!.click()
    expect(onIsolationClear).toHaveBeenCalledOnce()
  })
})

describe('T379 — talkoolaisen kapea versio', () => {
  it('yksi valinta, ⊥ neljää akselia', () => {
    const { container } = setup({ narrow: true })
    const labels = Array.from(container.querySelectorAll('.map-filter-trigger-label')).map(e => e.textContent)
    expect(labels).toEqual(['Näytä'])
  })

  it('"vain asettamattomat" rajaa suunniteltu-statukseen (sama predikaatti, esiasetus)', () => {
    const { container, bar } = setup({ narrow: true })
    rowByLabel(container, 'Vain asettamattomat').click()
    expect([...bar.getFilter().markerStatuses]).toEqual(['suunniteltu'])
    rowByLabel(container, 'Kaikki merkit').click()
    expect(bar.getFilter().markerStatuses.size).toBe(5)
  })

  it('valinta näkyy trigger-napissa (tila luettavissa ilman avaamista)', () => {
    const { container } = setup({ narrow: true })
    rowByLabel(container, 'Vain asettamattomat').click()
    expect(container.querySelector('.map-filter-trigger-value')!.textContent).toBe('vain asettamattomat')
  })
})
