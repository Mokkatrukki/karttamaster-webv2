// T415/V305: järjestäjä lisää valitut merkit OLEMASSA OLEVAAN tehtävään merkkijono-paneelista.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerOverviewPanel } from '../src/ui/marker-overview-panel'
import { defaultMapFilter } from '../src/logic/map-filter'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

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

function mount(opts: {
  markers?: SignMarker[]
  segments?: Segment[]
  onAddToSegment?: (ids: string[], segmentId: string) => void
  onCreateTask?: (ids: string[]) => void
  getSegmentMarkerCount?: (id: string) => number
  getExistingOwners?: (ids: string[]) => Array<{ markerId: string; segmentId: string }>
} = {}) {
  // CLAUDE.md: localStorage AINA vi.stubGlobal (Node v26 -konflikti).
  const store = new Map<string, string>([['karttamaster-marker-overview-open', '1']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  const panel = new MarkerOverviewPanel(el, {
    getMarkers: () => opts.markers ?? [],
    getSegments: () => opts.segments ?? [],
    getFilter: () => defaultMapFilter(),
    onPanTo: vi.fn(),
    onOpenDetail: vi.fn(),
    onAddToSegment: opts.onAddToSegment,
    onCreateTask: opts.onCreateTask,
    getSegmentMarkerCount: opts.getSegmentMarkerCount,
    getExistingOwners: opts.getExistingOwners,
  })
  panel.render()
  return { panel, el }
}

const targetSelect = (el: HTMLElement) =>
  el.querySelector<HTMLSelectElement>('.marker-overview-target-select')!
const addBtn = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('.marker-overview-add-existing')!
const checkboxes = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLInputElement>('.marker-item-checkbox')]

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T415/V305 — "Lisää valitut tehtävään"', () => {
  it('kohdevalikko listaa aktiivisen vaiheen pätkät: nimi · merkkimäärä · km-väli', () => {
    const h = mount({
      segments: [seg('Matin pätkä', { startDist: 5000, endDist: 12000 })],
      markers: [marker('m1')],
      onAddToSegment: vi.fn(),
      getSegmentMarkerCount: () => 12,
    })
    const opts = [...targetSelect(h.el).options]
    expect(opts).toHaveLength(1)
    expect(opts[0].value).toBe('Matin pätkä')
    expect(opts[0].textContent).toBe('Matin pätkä · 12 merkkiä · 5.0–12.0 km')
  })

  it('reititön tehtävä on SAMASSA listassa mutta merkitty "reititön" (V305)', () => {
    const h = mount({
      segments: [seg('Jälkihoito', { routeIds: undefined, startDist: undefined, endDist: undefined, track: undefined })],
      markers: [marker('m1')],
      onAddToSegment: vi.fn(),
      getSegmentMarkerCount: () => 3,
    })
    expect([...targetSelect(h.el).options][0].textContent).toBe('Jälkihoito · 3 merkkiä · reititön')
  })

  it('valinta → nappi kutsuu onAddToSegment valituilla id:illä + kohteella', () => {
    const onAddToSegment = vi.fn()
    const h = mount({
      segments: [seg('s1'), seg('s2')],
      markers: [marker('m1'), marker('m2'), marker('m3')],
      onAddToSegment,
    })
    const cbs = checkboxes(h.el)
    cbs[0].click()
    cbs[1].click()
    targetSelect(h.el).value = 's2'
    addBtn(h.el).click()
    expect(onAddToSegment).toHaveBeenCalledTimes(1)
    const [ids, segmentId] = onAddToSegment.mock.calls[0]
    expect(new Set(ids)).toEqual(new Set(['m1', 'm2']))
    expect(segmentId).toBe('s2')
  })

  it('N=0 → nappi disabloitu & MITATTAVASTI disabloidun näköinen (V250)', () => {
    const h = mount({ segments: [seg('s1')], markers: [marker('m1')], onAddToSegment: vi.fn() })
    const btn = addBtn(h.el)
    expect(btn.textContent).toBe('Lisää valitut tehtävään (0)')
    expect(btn.disabled).toBe(true)
    expect(btn.classList.contains('is-disabled')).toBe(true)
  })

  it('klikkaus disabloituna ⊥ kutsu mitään (kuollut pinta ⊥ saa mutatoida)', () => {
    const onAddToSegment = vi.fn()
    const h = mount({ segments: [seg('s1')], markers: [marker('m1')], onAddToSegment })
    addBtn(h.el).click()
    expect(onAddToSegment).not.toHaveBeenCalled()
  })

  it('valinnan laskuri päivittyy napin tekstiin', () => {
    const h = mount({ segments: [seg('s1')], markers: [marker('m1'), marker('m2')], onAddToSegment: vi.fn() })
    checkboxes(h.el)[0].click()
    expect(addBtn(h.el).textContent).toBe('Lisää valitut tehtävään (1)')
    expect(addBtn(h.el).disabled).toBe(false)
  })

  it('aktiivisessa vaiheessa ⊥ ole pätkiä → nappi & valitsin disabloitu (kohde puuttuu)', () => {
    const h = mount({ segments: [], markers: [marker('m1')], onAddToSegment: vi.fn() })
    checkboxes(h.el)[0].click()
    expect(addBtn(h.el).disabled).toBe(true)
    expect(targetSelect(h.el).disabled).toBe(true)
  })

  it('valittu kohde SÄILYY kun valinta muuttuu (⊥ nollaudu kesken työn)', () => {
    const h = mount({
      segments: [seg('s1'), seg('s2')],
      markers: [marker('m1'), marker('m2')],
      onAddToSegment: vi.fn(),
    })
    targetSelect(h.el).value = 's2'
    checkboxes(h.el)[0].click()
    expect(targetSelect(h.el).value).toBe('s2')
  })

  it('lisäyksen jälkeen valinta tyhjenee — sama kuvio kuin luonnissa', () => {
    const h = mount({
      segments: [seg('s1')],
      markers: [marker('m1'), marker('m2')],
      onAddToSegment: vi.fn(),
    })
    checkboxes(h.el)[0].click()
    addBtn(h.el).click()
    expect(checkboxes(h.el).every(cb => !cb.checked)).toBe(true)
    expect(addBtn(h.el).textContent).toBe('Lisää valitut tehtävään (0)')
  })

  it('"kuuluu jo" -informaatio näkyy myös tässä polussa (V291, ⊥ menetysvaroitus)', () => {
    const h = mount({
      segments: [seg('s1')],
      markers: [marker('m1')],
      onAddToSegment: vi.fn(),
      getExistingOwners: () => [{ markerId: 'm1', segmentId: 's1' }],
    })
    checkboxes(h.el)[0].click()
    const note = h.el.querySelector<HTMLElement>('.marker-overview-note')!
    expect(note.hidden).toBe(false)
    expect(note.textContent).toContain('säilyvät')
  })

  it('molemmat napit elävät rinnakkain: luonti EI korvaa lisäystä', () => {
    const h = mount({
      segments: [seg('s1')],
      markers: [marker('m1')],
      onAddToSegment: vi.fn(),
      onCreateTask: vi.fn(),
    })
    expect(addBtn(h.el)).not.toBeNull()
    expect(h.el.querySelector('.marker-overview-create')).not.toBeNull()
  })

  it('checkboxit renderöityvät myös kun VAIN onAddToSegment on kytketty', () => {
    const h = mount({ segments: [seg('s1')], markers: [marker('m1')], onAddToSegment: vi.fn() })
    expect(checkboxes(h.el)).toHaveLength(1)
  })
})
