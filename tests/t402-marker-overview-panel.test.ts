// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerOverviewPanel } from '../src/ui/marker-overview-panel'
import { defaultMapFilter } from '../src/logic/map-filter'
import type { MapFilter } from '../src/logic/map-filter'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

// T402/V290: telakoitu merkkijono. Testit vahtivat että paneeli RENDERÖI T400:n tuloksen —
// ei sitä että se laskisi ryhmiä itse (se on logiikkakerroksen testi).

function track(lat0: number, lat1: number, lon = 27.0) {
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const lat = lat0 + ((lat1 - lat0) * i) / 10
    pts.push({ lat, lon, d: (lat - lat0) * 111_000 })
  }
  return pts
}

function seg(id: string, over: Partial<Segment> = {}): Segment {
  return {
    id,
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: 0,
    endDist: 11000,
    phase: 'asettaminen',
    equipment: [],
    displayName: id,
    track: track(65.0, 65.1),
    ...over,
  } as Segment
}

function marker(id: string, over: Partial<SignMarker> = {}): SignMarker {
  return {
    id,
    type: 'right',
    lat: 65.05,
    lon: 27.0,
    distanceFromStart: 5000,
    routeIds: ['r1'],
    status: 'suunniteltu' as MarkerStatus,
    ...over,
  } as SignMarker
}

interface Harness {
  panel: MarkerOverviewPanel
  el: HTMLElement
  panTo: ReturnType<typeof vi.fn>
  openDetail: ReturnType<typeof vi.fn>
  visibility: ReturnType<typeof vi.fn>
}

function mount(opts: {
  markers?: SignMarker[]
  segments?: Segment[]
  filter?: Partial<MapFilter>
  open?: boolean
  onCreateTask?: (ids: string[]) => void
  getExistingOwners?: (ids: string[]) => Array<{ markerId: string; segmentId: string }>
  onBulkStatus?: (ids: string[], status: MarkerStatus) => void
  getPendingIds?: () => Set<string>
} = {}): Harness {
  // CLAUDE.md: localStorage AINA vi.stubGlobal (Node v26 -konflikti). `unstubGlobals:true`
  // palauttaa globaalit ennen jokaista testiä ∴ siivousta ⊥ kirjoiteta.
  const store = new Map<string, string>()
  if (opts.open) store.set('karttamaster-marker-overview-open', '1')
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })

  const el = document.createElement('div')
  document.body.appendChild(el)
  const panTo = vi.fn()
  const openDetail = vi.fn()
  const visibility = vi.fn()
  const panel = new MarkerOverviewPanel(el, {
    getMarkers: () => opts.markers ?? [],
    getSegments: () => opts.segments ?? [],
    getFilter: () => ({ ...defaultMapFilter(), ...opts.filter }),
    onPanTo: panTo,
    onOpenDetail: openDetail,
    onVisibilityChange: visibility,
    onCreateTask: opts.onCreateTask,
    getExistingOwners: opts.getExistingOwners,
    onBulkStatus: opts.onBulkStatus,
    getPendingIds: opts.getPendingIds,
  })
  if (opts.open) panel.render()
  return { panel, el, panTo, openDetail, visibility }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('MarkerOverviewPanel (T402)', () => {
  it('renderöi ryhmät T400:n järjestyksessä, laskurit otsikoissa', () => {
    const h = mount({
      open: true,
      segments: [seg('Pätkä 1')],
      markers: [marker('m1'), marker('m2', { status: 'asetettu' }), marker('m3', { status: 'ei_tarpeen' })],
    })
    const groups = [...h.el.querySelectorAll('.marker-overview-group')].map(g => (g as HTMLElement).dataset.group)
    expect(groups).toEqual(['asettamatta', 'asetetut', 'ei_tarpeen'])

    const headers = [...h.el.querySelectorAll('.marker-overview-group-header')].map(x => x.textContent)
    expect(headers[0]).toContain('Asettamatta')
    expect(headers[0]).toContain('(1)')
    // Alaotsikko = pätkän nimi + määrä
    expect(h.el.querySelector('.marker-overview-subhead')!.textContent).toBe('Pätkä 1 (1)')
  })

  it('"Suodattimen ulkopuolella" renderöityy KIINNI (V290: jäännös ⊥ työjono)', () => {
    const h = mount({
      open: true,
      segments: [seg('A')],
      markers: [marker('m1'), marker('m2', { status: 'kerätty' })],
      filter: { markerStatuses: new Set<MarkerStatus>(['suunniteltu']) },
    })
    const suod = h.el.querySelector('.marker-overview-group[data-group="suodatettu"]')!
    expect(suod).toBeTruthy()
    // Otsikko näkyy laskurilla, rivit EIVÄT ole renderöityinä (kiinni).
    expect(suod.querySelector('.marker-overview-group-header')!.textContent).toContain('(1)')
    expect(suod.querySelectorAll('.marker-overview-item').length).toBe(0)
    // Avaus paljastaa rivin — luku ⊥ ole umpikuja.
    ;(suod.querySelector('.marker-overview-group-header') as HTMLElement).click()
    const suod2 = h.el.querySelector('.marker-overview-group[data-group="suodatettu"]')!
    expect(suod2.querySelectorAll('.marker-overview-item').length).toBe(1)
  })

  it('rivin klikkaus panoroi kartan oikeaan merkkiin; ··· avaa modaalin', () => {
    const h = mount({ open: true, segments: [seg('A')], markers: [marker('m1'), marker('m2')] })
    const rows = [...h.el.querySelectorAll<HTMLElement>('.marker-overview-row')]
    expect(rows.length).toBe(2)
    rows[1].click()
    expect(h.panTo).toHaveBeenCalledTimes(1)
    const clickedId = (rows[1].closest('.marker-overview-item') as HTMLElement).dataset.id
    expect(h.panTo).toHaveBeenCalledWith(clickedId)

    ;(h.el.querySelector('.marker-overview-menu') as HTMLElement).click()
    expect(h.openDetail).toHaveBeenCalledTimes(1)
  })

  it('rivit ovat oikeita nappeja & 44px-sopimus koskee niitä (V268)', () => {
    const h = mount({ open: true, segments: [seg('A')], markers: [marker('m1')] })
    const row = h.el.querySelector('.marker-overview-row')!
    expect(row.tagName).toBe('BUTTON')
    expect(h.el.querySelector('.marker-overview-menu')!.tagName).toBe('BUTTON')
    // Otsikko on jaetusta apurista (T371/V267) ∴ myös se on <button>
    expect(h.el.querySelector('.left-panel-section-header')!.tagName).toBe('BUTTON')
  })

  it('tyhjätilat: ei merkkejä vs. kaikki asetettu (onnistuminen ⊥ tyhjä lista)', () => {
    const tyhja = mount({ open: true, segments: [seg('A')], markers: [] })
    expect(tyhja.el.querySelector('.marker-overview-empty')!.textContent).toBe('Ei merkkejä')

    const valmis = mount({ open: true, segments: [seg('A')], markers: [marker('m1', { status: 'asetettu' })] })
    const done = valmis.el.querySelector('.marker-overview-done')!
    expect(done.textContent).toContain('Kaikki merkit asetettu')
    // Lista näkyy silti — merkit ovat yhä selattavissa.
    expect(valmis.el.querySelectorAll('.marker-overview-item').length).toBe(1)
  })

  it('toggle persistoi tilan & ilmoittaa kartalle (invalidateSize-kutsupaikka)', () => {
    const h = mount({ segments: [seg('A')], markers: [marker('m1')] })
    expect(h.panel.isOpen()).toBe(false)
    expect(h.el.hidden).toBe(true)

    h.panel.toggle()
    expect(h.panel.isOpen()).toBe(true)
    expect(h.el.hidden).toBe(false)
    expect(localStorage.getItem('karttamaster-marker-overview-open')).toBe('1')
    expect(h.visibility).toHaveBeenCalledWith(true)

    h.panel.toggle()
    expect(h.panel.isOpen()).toBe(false)
    expect(localStorage.getItem('karttamaster-marker-overview-open')).toBe('0')
    expect(h.visibility).toHaveBeenLastCalledWith(false)
  })

  it('kiinni oleva paneeli ei anna panorointi-paddingia (käytös = entinen)', () => {
    const h = mount({ segments: [seg('A')], markers: [marker('m1')] })
    expect(h.panel.visibleWidth()).toBe(0)
  })

  it('avaustila luetaan localStoragesta; vioittunut arvo → kiinni (V5-kuvio)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{ei json}',
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    })
    const el = document.createElement('div')
    const panel = new MarkerOverviewPanel(el, {
      getMarkers: () => [],
      getSegments: () => [],
      getFilter: () => defaultMapFilter(),
      onPanTo: () => {},
      onOpenDetail: () => {},
    })
    expect(panel.isOpen()).toBe(false)
  })

  it('orpo merkki näkyy omassa "Ei pätkää" -alaryhmässä', () => {
    const h = mount({
      open: true,
      segments: [seg('A')],
      markers: [marker('m1'), marker('orpo', { lat: 60.0, lon: 20.0, routeIds: [] })],
    })
    const subheads = [...h.el.querySelectorAll('.marker-overview-subhead')].map(x => x.textContent)
    expect(subheads).toContain('Ei pätkää (1)')
  })

  it('⊥ valintaa jos yhtään bulk-toimintoa ⊥ ole (checkbox on affordanssi ⊥ koriste)', () => {
    const h = mount({ open: true, segments: [seg('A')], markers: [marker('m1')] })
    expect(h.el.querySelectorAll('.marker-item-checkbox').length).toBe(0)
    expect(h.el.querySelector('.marker-overview-actionbar')).toBeNull()
  })
})

// T403/V291/V294/V250: valinta → reititön tehtävä.
describe('MarkerOverviewPanel — valinta & tehtävän luonti (T403)', () => {
  const segments = [seg('Pätkä 1')]
  const markers = [marker('m1'), marker('m2'), marker('orpo', { lat: 60.0, lon: 20.0, routeIds: [] })]

  function withSelection(extra: Parameters<typeof mount>[0] = {}) {
    const onCreateTask = vi.fn()
    const h = mount({
      open: true,
      segments,
      markers,
      onCreateTask,
      getExistingOwners: ids =>
        ids.filter(id => id !== 'orpo').map(id => ({ markerId: id, segmentId: 'Pätkä 1' })),
      ...extra,
    })
    const cb = (id: string) =>
      h.el.querySelector<HTMLInputElement>(`.marker-overview-item[data-id="${id}"] .marker-item-checkbox`)!
    const btn = () => h.el.querySelector<HTMLButtonElement>('.marker-overview-create')!
    const note = () => h.el.querySelector<HTMLElement>('.marker-overview-note')!
    return { ...h, onCreateTask, cb, btn, note }
  }

  it('(i) 0 valittua → nappi disabloitu JA disabloitu tila näkyy (V250)', () => {
    const h = withSelection()
    expect(h.btn().textContent).toBe('Luo tehtävä valituista (0)')
    expect(h.btn().disabled).toBe(true)
    expect(h.btn().classList.contains('is-disabled')).toBe(true)
    h.btn().click()
    expect(h.onCreateTask).not.toHaveBeenCalled()
  })

  it('(ii) valinta säilyy re-renderin yli (kartan päivitys ⊥ nollaa valintaa)', () => {
    const h = withSelection()
    h.cb('m1').click()
    expect(h.btn().textContent).toContain('(1)')
    h.panel.render()
    expect(h.cb('m1').checked).toBe(true)
    expect(h.btn().textContent).toContain('(1)')
  })

  it('(iii) omistajallisia valittu → info-rivi listaa pätkänimet (V291: "kuuluu myös")', () => {
    const h = withSelection()
    h.cb('m1').click()
    expect(h.note().hidden).toBe(false)
    expect(h.note().textContent).toContain('kuuluu myös pätkiin: Pätkä 1')
    expect(h.note().textContent).toContain('säilyvät')
    // ⊥ puhu menetyksestä — sitä ⊥ tapahdu (mitattu V291-korjaus).
    expect(h.note().textContent).not.toContain('siirtyy')
  })

  it('(iv) vain orpoja valittu → info-riviä EI ole', () => {
    const h = withSelection()
    h.cb('orpo').click()
    expect(h.note().hidden).toBe(true)
    expect(h.btn().disabled).toBe(false)
  })

  it('(v) luonti kutsuu callbackia valituilla id:illä & tyhjentää valinnan', () => {
    const h = withSelection()
    h.cb('m1').click()
    h.cb('m2').click()
    h.btn().click()
    expect(h.onCreateTask).toHaveBeenCalledTimes(1)
    expect(new Set(h.onCreateTask.mock.calls[0][0])).toEqual(new Set(['m1', 'm2']))
    expect(h.btn().textContent).toContain('(0)')
    expect(h.cb('m1').checked).toBe(false)
  })

  it('(vi) V294: suodattimen ulkopuolinen rivi ⊥ ole valittavissa', () => {
    const h = mount({
      open: true,
      segments,
      markers: [marker('m1'), marker('piilossa', { status: 'kerätty' })],
      filter: { markerStatuses: new Set<MarkerStatus>(['suunniteltu']) },
      onCreateTask: vi.fn(),
    })
    // Avaa suodatettu ryhmä → rivi näkyy mutta ilman checkboxia.
    ;(h.el.querySelector('.marker-overview-group[data-group="suodatettu"] .marker-overview-group-header') as HTMLElement).click()
    const row = h.el.querySelector('.marker-overview-item[data-id="piilossa"]')!
    expect(row.querySelector('.marker-item-checkbox')).toBeNull()
    expect(h.el.querySelector('.marker-overview-item[data-id="m1"] .marker-item-checkbox')).toBeTruthy()
  })

  it('V294: suodattimen muutos pudottaa kadonneen merkin valinnasta (⊥ näkymätön valinta)', () => {
    let statuses = new Set<MarkerStatus>(['suunniteltu', 'asetettu'])
    const onCreateTask = vi.fn()
    const store = new Map<string, string>([['karttamaster-marker-overview-open', '1']])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: () => {},
      clear: () => {},
    })
    const el = document.createElement('div')
    document.body.appendChild(el)
    const panel = new MarkerOverviewPanel(el, {
      getMarkers: () => [marker('m1'), marker('kohta-pois', { status: 'asetettu' })],
      getSegments: () => segments,
      getFilter: () => ({ ...defaultMapFilter(), markerStatuses: statuses }),
      onPanTo: () => {},
      onOpenDetail: () => {},
      onCreateTask,
    })
    panel.render()
    el.querySelector<HTMLInputElement>('.marker-overview-item[data-id="kohta-pois"] .marker-item-checkbox')!.click()
    expect(el.querySelector('.marker-overview-create')!.textContent).toContain('(1)')

    statuses = new Set<MarkerStatus>(['suunniteltu'])
    panel.render()
    expect(el.querySelector('.marker-overview-create')!.textContent).toContain('(0)')
  })
})

// T404-parity: kyvyt jotka olivat vanhassa `#marker-modal`issa ! säilyä korvaajassa —
// muuten poisto on kyvyn menetys ⊥ siivous. Nämä korvaavat t101/t102/t185-testit.
describe('MarkerOverviewPanel — parity poistuneelle modaalille (T404)', () => {
  const segments = [seg('A')]

  it('V117: pending-merkki saa marker-item--pending + "tallentamatta"-lapun', () => {
    const h = mount({
      open: true,
      segments,
      markers: [marker('m1'), marker('odottaa')],
      getPendingIds: () => new Set(['odottaa']),
    })
    const row = h.el.querySelector('.marker-overview-item[data-id="odottaa"]')!
    expect(row.classList.contains('marker-item--pending')).toBe(true)
    expect(row.querySelector('.marker-pending-tag')!.textContent).toBe('tallentamatta')
    // Vahvistettu merkki ⊥ saa korostusta
    const clean = h.el.querySelector('.marker-overview-item[data-id="m1"]')!
    expect(clean.classList.contains('marker-item--pending')).toBe(false)
    expect(clean.querySelector('.marker-pending-tag')).toBeNull()
  })

  it('V117: vahvistus (avain poistuu) → korostus katoaa re-renderillä', () => {
    let pending = new Set(['m1'])
    const el = document.createElement('div')
    document.body.appendChild(el)
    vi.stubGlobal('localStorage', {
      getItem: () => '1', setItem: () => {}, removeItem: () => {}, clear: () => {},
    })
    const panel = new MarkerOverviewPanel(el, {
      getMarkers: () => [marker('m1')],
      getSegments: () => segments,
      getFilter: () => defaultMapFilter(),
      onPanTo: () => {},
      onOpenDetail: () => {},
      getPendingIds: () => pending,
    })
    panel.render()
    expect(el.querySelector('.marker-item--pending')).toBeTruthy()
    pending = new Set()
    panel.render()
    expect(el.querySelector('.marker-item--pending')).toBeNull()
  })

  it('haku rajaa rivit nimen mukaan (T102-parity)', () => {
    const h = mount({
      open: true,
      segments,
      markers: [marker('m1', { label: 'Nuoli oikealle' }), marker('m2', { label: 'Huoltopiste' })],
    })
    const input = h.el.querySelector<HTMLInputElement>('.marker-overview-search')!
    input.value = 'huolto'
    input.dispatchEvent(new Event('input'))
    const ids = [...h.el.querySelectorAll<HTMLElement>('.marker-overview-item')].map(x => x.dataset.id)
    expect(ids).toEqual(['m2'])
  })

  it('haku rajaa km-luvun mukaan & tyhjä tulos sanoo "Ei tuloksia"', () => {
    const h = mount({ open: true, segments, markers: [marker('m1')] })
    const input = () => h.el.querySelector<HTMLInputElement>('.marker-overview-search')!
    input().value = '5.5'
    input().dispatchEvent(new Event('input'))
    expect(h.el.querySelector('.marker-overview-item')).toBeTruthy()

    input().value = 'ei-osu-mihinkään'
    input().dispatchEvent(new Event('input'))
    expect(h.el.querySelector('.marker-overview-item')).toBeNull()
    expect(h.el.querySelector('.marker-overview-empty')!.textContent).toBe('Ei tuloksia')
  })

  it('haussa piiloon jäänyt rivi putoaa valinnasta (V294 koskee myös hakua)', () => {
    const h = mount({
      open: true,
      segments,
      markers: [marker('m1', { label: 'Nuoli' }), marker('m2', { label: 'Huolto' })],
      onCreateTask: vi.fn(),
    })
    h.el.querySelector<HTMLInputElement>('.marker-overview-item[data-id="m2"] .marker-item-checkbox')!.click()
    expect(h.el.querySelector('.marker-overview-create')!.textContent).toContain('(1)')

    const input = h.el.querySelector<HTMLInputElement>('.marker-overview-search')!
    input.value = 'nuoli'
    input.dispatchEvent(new Event('input'))
    expect(h.el.querySelector('.marker-overview-create')!.textContent).toContain('(0)')
  })

  it('bulk-status kutsuu callbackia oikeilla id:illä & statuksella (T101-parity)', () => {
    const onBulkStatus = vi.fn()
    const h = mount({ open: true, segments, markers: [marker('m1'), marker('m2')], onBulkStatus })
    const apply = h.el.querySelector<HTMLButtonElement>('.marker-overview-apply-status')!
    expect(apply.disabled).toBe(true)
    expect(apply.classList.contains('is-disabled')).toBe(true)

    h.el.querySelector<HTMLInputElement>('.marker-overview-item[data-id="m1"] .marker-item-checkbox')!.click()
    expect(apply.textContent).toBe('Aseta valituille (1)')
    expect(apply.disabled).toBe(false)

    const select = h.el.querySelector<HTMLSelectElement>('.marker-overview-status-select')!
    select.value = 'asetettu'
    apply.click()
    expect(onBulkStatus).toHaveBeenCalledWith(['m1'], 'asetettu')
    // Valinta tyhjenee toiminnon jälkeen — sama merkki ⊥ jää vahingossa seuraavaan tekoon.
    expect(h.el.querySelector('.marker-overview-apply-status')!.textContent).toContain('(0)')
  })

  it('status-valikossa on kaikki 5 statusta', () => {
    const h = mount({ open: true, segments, markers: [marker('m1')], onBulkStatus: vi.fn() })
    const opts = [...h.el.querySelectorAll('.marker-overview-status-select option')].map(o => (o as HTMLOptionElement).value)
    expect(opts).toEqual(['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen'])
  })
})
