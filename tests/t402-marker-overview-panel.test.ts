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

  it('⊥ valintaa jos onCreateTask puuttuu (checkbox on toiminnon affordanssi ⊥ koriste)', () => {
    const h = mount({ open: true, segments: [seg('A')], markers: [marker('m1')] })
    expect(h.el.querySelectorAll('.marker-item-checkbox').length).toBe(0)
    expect(h.el.querySelector('.marker-overview-actionbar')).toBeNull()
  })
})
