import { describe, it, expect, vi } from 'vitest'
import {
  defaultMapFilter, markerVisibility, segmentVisibility, toggleFilterValue,
  activeFilterCount, isDefaultFilter, isolatedMarkerIds, loadMapFilter, saveMapFilter,
  ALL_MARKER_STATUSES, ALL_SEGMENT_STATES, DIM_OPACITY,
} from '../src/logic/map-filter'
import type { MapFilter } from '../src/logic/map-filter'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

// T376/V271: kartan näkyvyyspäätös yhdestä moduulista, kolmiarvoisena. Taso 1 Vitest-pure.

const marker = (id: string, status: MarkerStatus, routeIds: string[] = ['r1']): Pick<SignMarker, 'id' | 'status' | 'routeIds'> =>
  ({ id, status, routeIds })

const segment = (over: Partial<Segment> = {}): Segment =>
  ({ id: 's1', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 5000,
     equipment: [], phase: 'asettaminen', ...over }) as Segment

describe('T376/V271 — oletustila', () => {
  it('oletus ⊥ suodata mitään & dimLevel = vahva (V243-amend)', () => {
    const f = defaultMapFilter()
    expect(f.dimLevel).toBe('vahva')
    expect(f.markerStatuses.size).toBe(ALL_MARKER_STATUSES.length)
    expect(f.segmentStates.size).toBe(ALL_SEGMENT_STATES.length)
    expect(isDefaultFilter(f)).toBe(true)
    expect(activeFilterCount(f)).toBe(0)
  })

  it('himmennysportaat: merkki & viiva saavat ERI alfan (§K MarkerFocus)', () => {
    expect(DIM_OPACITY.kevyt.marker).not.toBe(DIM_OPACITY.kevyt.line)
    expect(DIM_OPACITY.vahva.marker).toBeLessThan(DIM_OPACITY.kevyt.marker)
    expect(DIM_OPACITY.vahva.line).toBeLessThan(DIM_OPACITY.kevyt.line)
  })

  it('aktiivilaskuri kasvaa akselia kohti — "piilota" lasketaan, muut portaat ⊥', () => {
    const f = defaultMapFilter()
    expect(activeFilterCount({ ...f, dimLevel: 'kevyt' })).toBe(0)
    expect(activeFilterCount({ ...f, dimLevel: 'piilota' })).toBe(1)
    expect(activeFilterCount({ ...f, visibleRouteIds: ['r1'] })).toBe(1)
    expect(activeFilterCount({ ...f, isolatedSegmentId: 's1', visibleRouteIds: ['r1'] })).toBe(2)
    expect(activeFilterCount({ ...f, markerStatuses: new Set<MarkerStatus>(['suunniteltu']) })).toBe(1)
  })
})

describe('T376/V271 — markerVisibility', () => {
  const f = defaultMapFilter()

  it('oletuksella kaikki full', () => {
    expect(markerVisibility(marker('m1', 'asetettu'), f)).toBe('full')
  })

  it('V269: piilotettu reitti → hidden (kova piilotus, ⊥ himmennys)', () => {
    expect(markerVisibility(marker('m1', 'asetettu', ['r1']), { ...f, visibleRouteIds: ['r2'] })).toBe('hidden')
    expect(markerVisibility(marker('m1', 'asetettu', ['r1', 'r2']), { ...f, visibleRouteIds: ['r2'] })).toBe('full')
  })

  it('reitittömän merkin ⊥ katoa reittisuodattimesta', () => {
    expect(markerVisibility(marker('m1', 'asetettu', []), { ...f, visibleRouteIds: ['r2'] })).toBe('full')
  })

  it('statussuodatin → dim (kevyt/vahva) tai hidden (piilota)', () => {
    const onlyPlanned: MapFilter = { ...f, markerStatuses: new Set<MarkerStatus>(['suunniteltu']) }
    expect(markerVisibility(marker('m1', 'suunniteltu'), onlyPlanned)).toBe('full')
    expect(markerVisibility(marker('m2', 'asetettu'), onlyPlanned)).toBe('dim')
    expect(markerVisibility(marker('m2', 'asetettu'), { ...onlyPlanned, dimLevel: 'kevyt' })).toBe('dim')
    expect(markerVisibility(marker('m2', 'asetettu'), { ...onlyPlanned, dimLevel: 'piilota' })).toBe('hidden')
  })

  it('isolointi: muun pätkän merkki himmenee, isoloidun ⊥', () => {
    const iso = new Set(['m1'])
    expect(markerVisibility(marker('m1', 'asetettu'), f, { isolatedMarkerIds: iso })).toBe('full')
    expect(markerVisibility(marker('m2', 'asetettu'), f, { isolatedMarkerIds: iso })).toBe('dim')
  })

  it('kombinaatio: isolointi + status yhtä aikaa (kumpi tahansa riittää rajaamaan)', () => {
    const combo: MapFilter = { ...f, markerStatuses: new Set<MarkerStatus>(['suunniteltu']) }
    const iso = new Set(['m1'])
    expect(markerVisibility(marker('m1', 'suunniteltu'), combo, { isolatedMarkerIds: iso })).toBe('full')
    expect(markerVisibility(marker('m1', 'asetettu'), combo, { isolatedMarkerIds: iso })).toBe('dim')   // status karsii
    expect(markerVisibility(marker('m9', 'suunniteltu'), combo, { isolatedMarkerIds: iso })).toBe('dim') // isolointi karsii
  })

  it('kombinaatio: piilotettu reitti voittaa isoloinnin (kova ennen pehmeää)', () => {
    const combo: MapFilter = { ...f, visibleRouteIds: ['r2'], isolatedSegmentId: 's1' }
    expect(markerVisibility(marker('m1', 'asetettu', ['r1']), combo, { isolatedMarkerIds: new Set(['m1']) })).toBe('hidden')
  })
})

describe('T376/V271 — segmentVisibility', () => {
  const f = defaultMapFilter()

  it('oletuksella full', () => {
    expect(segmentVisibility(segment(), f, { state: 'kesken' })).toBe('full')
  })

  it('V269: piilotettu reitti → hidden; reititön (V139) ⊥ katoa', () => {
    expect(segmentVisibility(segment(), { ...f, visibleRouteIds: ['r2'] }, { state: 'kesken' })).toBe('hidden')
    const routeless = segment({ routeIds: undefined, primaryRouteId: undefined, startDist: undefined, endDist: undefined })
    expect(segmentVisibility(routeless, { ...f, visibleRouteIds: ['r2'] }, { state: 'kesken' })).toBe('full')
  })

  it('isolointi: muut himmenevät, "piilota"-portaalla katoavat', () => {
    const iso: MapFilter = { ...f, isolatedSegmentId: 's1' }
    expect(segmentVisibility(segment({ id: 's1' }), iso, { state: 'kesken' })).toBe('full')
    expect(segmentVisibility(segment({ id: 's2' }), iso, { state: 'kesken' })).toBe('dim')
    expect(segmentVisibility(segment({ id: 's2' }), { ...iso, dimLevel: 'piilota' }, { state: 'kesken' })).toBe('hidden')
  })

  it('tilasuodatin: vain kesken → valmis & ei_alkanut himmenevät', () => {
    const onlyKesken: MapFilter = { ...f, segmentStates: new Set(['kesken' as const]) }
    expect(segmentVisibility(segment(), onlyKesken, { state: 'kesken' })).toBe('full')
    expect(segmentVisibility(segment(), onlyKesken, { state: 'valmis' })).toBe('dim')
    expect(segmentVisibility(segment(), onlyKesken, { state: 'ei_alkanut' })).toBe('dim')
  })

  it('tila lasketaan merkeistä kun ctx.state puuttuu (⊥ omaa laskentaa kutsupaikalle)', () => {
    const seg = segment({ id: 's1', startDist: 0, endDist: 10000 })
    const onlyEiAlkanut: MapFilter = { ...f, segmentStates: new Set(['ei_alkanut' as const]) }
    // Tyhjä merkkijoukko → ei_alkanut → läpäisee suodattimen.
    expect(segmentVisibility(seg, onlyEiAlkanut, { markers: [], peers: [seg] })).toBe('full')
  })

  it('completed voittaa laskurin (V256) myös suodattimessa', () => {
    const onlyValmis: MapFilter = { ...f, segmentStates: new Set(['valmis' as const]) }
    const done = segment({ completed: true })
    expect(segmentVisibility(done, onlyValmis, { markers: [], peers: [done] })).toBe('full')
  })
})

describe('T376/V272 — viimeistä valintaa ⊥ voi poistaa', () => {
  it('poisto torjutaan kun jäljellä on yksi', () => {
    const one = new Set<MarkerStatus>(['suunniteltu'])
    expect(toggleFilterValue(one, 'suunniteltu')).toBe(one)      // sama viite = ⊥ muutosta
    expect(toggleFilterValue(one, 'suunniteltu').size).toBe(1)
  })

  it('poisto onnistuu kun jäljellä on useampi & lisäys palauttaa', () => {
    const two = new Set<MarkerStatus>(['suunniteltu', 'asetettu'])
    const afterRemove = toggleFilterValue(two, 'asetettu')
    expect([...afterRemove]).toEqual(['suunniteltu'])
    expect(two.size).toBe(2)                                      // ⊥ mutatoi alkuperäistä
    expect(toggleFilterValue(afterRemove, 'asetettu').size).toBe(2)
  })
})

describe('T376/V259 — isolatedMarkerIds nojaa jaettuun jäsenyyteen', () => {
  const mk = (id: string, lat: number): SignMarker =>
    ({ id, type: 'right', lat, lon: 27, distanceFromStart: 2000, routeIds: ['r1'],
       status: 'suunniteltu', images: [] }) as unknown as SignMarker

  it('isolointi ilman valintaa → undefined (⊥ suodatinta)', () => {
    expect(isolatedMarkerIds(defaultMapFilter(), [], [])).toBeUndefined()
  })

  it('tuntematon pätkä-id → undefined ⊥ kaadu', () => {
    const f = { ...defaultMapFilter(), isolatedSegmentId: 'ei-ole' }
    expect(isolatedMarkerIds(f, [segment()], [mk('m1', 65)])).toBeUndefined()
  })

  it('linkedMarkerIds-jäsenyys (V140) periytyy suodattimeen', () => {
    const seg = segment({ id: 's1', routeIds: undefined, primaryRouteId: undefined, startDist: undefined, endDist: undefined, linkedMarkerIds: ['m1'] })
    const f = { ...defaultMapFilter(), isolatedSegmentId: 's1' }
    const ids = isolatedMarkerIds(f, [seg], [mk('m1', 65), mk('m2', 66)])
    expect(ids).toBeDefined()
    expect(ids!.has('m1')).toBe(true)
    expect(ids!.has('m2')).toBe(false)
  })
})

describe('T376/V5 — persistointi', () => {
  // CLAUDE.md: localStorage-testit AINA vi.stubGlobal (Node v26 -konflikti).
  function stubStorage(initial: Record<string, string> = {}): Record<string, string> {
    const store: Record<string, string> = { ...initial }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
    })
    return store
  }

  it('tallennus → lataus säilyttää kaikki akselit', () => {
    stubStorage()
    const f: MapFilter = {
      visibleRouteIds: ['r1'], isolatedSegmentId: 's7',
      markerStatuses: new Set<MarkerStatus>(['suunniteltu', 'asetettu']),
      segmentStates: new Set(['kesken' as const]),
      dimLevel: 'piilota',
    }
    saveMapFilter(f)
    const loaded = loadMapFilter()
    expect(loaded.visibleRouteIds).toEqual(['r1'])
    expect(loaded.isolatedSegmentId).toBe('s7')
    expect([...loaded.markerStatuses].sort()).toEqual(['asetettu', 'suunniteltu'])
    expect([...loaded.segmentStates]).toEqual(['kesken'])
    expect(loaded.dimLevel).toBe('piilota')
  })

  it('tyhjä storage → oletukset', () => {
    stubStorage()
    expect(loadMapFilter()).toEqual(defaultMapFilter())
  })

  it('korruptoitu JSON → oletukset, ⊥ kaadu', () => {
    stubStorage({ 'karttamaster-map-filter': '{not json' })
    expect(() => loadMapFilter()).not.toThrow()
    expect(loadMapFilter().dimLevel).toBe('vahva')
  })

  it('tuntemattomat arvot pudotetaan; tyhjäksi jäänyt joukko palautuu täydeksi (V272)', () => {
    stubStorage({
      'karttamaster-map-filter': JSON.stringify({
        markerStatuses: ['ei-ole-status'], segmentStates: [], dimLevel: 'tuntematon', visibleRouteIds: [1, 'r2'],
      }),
    })
    const loaded = loadMapFilter()
    expect(loaded.markerStatuses.size).toBe(ALL_MARKER_STATUSES.length)
    expect(loaded.segmentStates.size).toBe(ALL_SEGMENT_STATES.length)
    expect(loaded.dimLevel).toBe('vahva')
    expect(loaded.visibleRouteIds).toEqual(['r2'])
  })
})
