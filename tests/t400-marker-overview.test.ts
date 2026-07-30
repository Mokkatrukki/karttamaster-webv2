import { describe, it, expect } from 'vitest'
import { groupMarkersForOverview, subgroupTitle } from '../src/logic/marker-overview'
import { defaultMapFilter, buildMarkerFilterContext } from '../src/logic/map-filter'
import type { MapFilter } from '../src/logic/map-filter'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

// T400/V290: ryhmittelijä KOOSTAA (jäsenyys V259, järjestys V237/V238, näkyvyys V271).
// Testit vahtivat nimenomaan sitä ettei se keksi omaa sääntöä.

// Jälki = suora viiva pohjoiseen; km kasvaa lat-suunnassa.
function track(lat0: number, lat1: number, lon = 27.0): Array<{ lat: number; lon: number; d: number }> {
  // `d` = kumulatiivinen matka metreinä (TrackPoint vaatii sen). ~111 km / lat-aste.
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
    endDist: 10000,
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

const filter = (over: Partial<MapFilter> = {}): MapFilter => ({ ...defaultMapFilter(), ...over })

describe('groupMarkersForOverview (T400/V290)', () => {
  it('(i) asettamattomat ensin & ryhmiteltynä pätkittäin', () => {
    const s1 = seg('A')
    const s2 = seg('B', { track: track(66.0, 66.1), startDist: 0, endDist: 10000 })
    const markers = [
      marker('m1', { status: 'asetettu' }),
      marker('m2'),
      marker('m3', { lat: 66.05, status: 'suunniteltu' }),
    ]
    const groups = groupMarkersForOverview({ markers, segments: [s1, s2], filter: filter() })

    expect(groups[0].key).toBe('asettamatta')
    expect(groups[0].count).toBe(2)
    expect(groups.map(g => g.key)).toEqual(['asettamatta', 'asetetut'])
    // Asettamatta-ryhmässä kaksi pätkää, kummallakin omansa.
    const names = groups[0].subgroups.map(subgroupTitle)
    expect(names).toEqual(['A', 'B'])
  })

  it('(ii) orpo merkki saa oman "Ei pätkää" -alaryhmän ⊥ katoa', () => {
    // Kaukana kaikista jäljistä → ⊥ omistajaa (V283-kynnys).
    const orphan = marker('orpo', { lat: 60.0, lon: 20.0, routeIds: [] })
    const groups = groupMarkersForOverview({
      markers: [marker('m1'), orphan],
      segments: [seg('A')],
      filter: filter(),
    })
    const asettamatta = groups.find(g => g.key === 'asettamatta')!
    const orphanSub = asettamatta.subgroups.find(s => s.segment === null)
    expect(orphanSub).toBeDefined()
    expect(orphanSub!.markers.map(m => m.id)).toEqual(['orpo'])
    expect(subgroupTitle(orphanSub!)).toBe('Ei pätkää')
    // Omistajaton ryhmä on VIIMEISENÄ — se on jäännös, ei pätkä.
    expect(asettamatta.subgroups[asettamatta.subgroups.length - 1]).toBe(orphanSub)
  })

  it('(iii) suodatettu merkki menee "Suodattimen ulkopuolella" -ryhmään ⊥ pudota pois', () => {
    const markers = [marker('m1'), marker('m2', { status: 'kerätty' })]
    const f = filter({ markerStatuses: new Set<MarkerStatus>(['suunniteltu']) })
    const groups = groupMarkersForOverview({ markers, segments: [seg('A')], filter: f })

    const last = groups[groups.length - 1]
    expect(last.key).toBe('suodatettu')
    expect(last.title).toBe('Suodattimen ulkopuolella')
    expect(last.subgroups.flatMap(s => s.markers.map(m => m.id))).toEqual(['m2'])
    // m2 ⊥ esiinny 'asetetut'-ryhmässä
    expect(groups.find(g => g.key === 'asetetut')).toBeUndefined()
  })

  it('(iv) väärän vaiheen pätkä ⊥ tuo omaa ryhmäänsä (V91-rajaus kutsujalla)', () => {
    const asettaminen = seg('A')
    const purku = seg('P', { phase: 'purku' })
    // Kutsuja antaa VAIN aktiivisen vaiheen pätkät (V290).
    const groups = groupMarkersForOverview({
      markers: [marker('m1')],
      segments: [asettaminen],
      filter: filter(),
    })
    expect(groups[0].subgroups.map(subgroupTitle)).toEqual(['A'])
    expect(JSON.stringify(groups)).not.toContain(purku.id)
  })

  it('(v) tyhjä syöte ⊥ heitä', () => {
    expect(groupMarkersForOverview({ markers: [], segments: [], filter: filter() })).toEqual([])
    expect(groupMarkersForOverview({ markers: [], segments: [seg('A')], filter: filter() })).toEqual([])
  })

  it('(vi) sama merkki esiintyy TASAN kerran koko rakenteessa', () => {
    // Kaksi pätkää samalla reitillä & päällekkäisillä jäljillä → eksklusiivisuus (V259)
    // ratkaisee omistajan; lista ⊥ saa duplikoida.
    const s1 = seg('A', { track: track(65.0, 65.06) })
    const s2 = seg('B', { track: track(65.04, 65.1) })
    const markers = [marker('m1', { lat: 65.05 }), marker('m2', { lat: 65.02 }), marker('m3', { lat: 65.09 })]
    const groups = groupMarkersForOverview({ markers, segments: [s1, s2], filter: filter() })

    const ids = groups.flatMap(g => g.subgroups.flatMap(s => s.markers.map(m => m.id)))
    expect(ids.length).toBe(new Set(ids).size)
    expect(new Set(ids)).toEqual(new Set(['m1', 'm2', 'm3']))
  })

  it('ryhmän count = alaryhmien merkkimäärä', () => {
    const groups = groupMarkersForOverview({
      markers: [marker('m1'), marker('m2'), marker('m3', { status: 'ei_tarpeen' })],
      segments: [seg('A')],
      filter: filter(),
    })
    for (const g of groups) {
      expect(g.count).toBe(g.subgroups.reduce((n, s) => n + s.markers.length, 0))
    }
    expect(groups.map(g => g.key)).toEqual(['asettamatta', 'ei_tarpeen'])
  })

  it('järjestys tulee segment-orderista: purku kääntää suunnan (V238)', () => {
    const s = seg('A', { phase: 'purku' })
    const markers = [
      marker('lahi', { lat: 65.01, distanceFromStart: 1000 }),
      marker('kauko', { lat: 65.09, distanceFromStart: 9000 }),
    ]
    const groups = groupMarkersForOverview({ markers, segments: [s], filter: filter() })
    const order = groups[0].subgroups[0].markers.map(m => m.id)
    expect(order).toEqual(['kauko', 'lahi'])
  })
})

describe('buildMarkerFilterContext (V297)', () => {
  it('orpojoukko lasketaan VAIN kun onlyOrphans on päällä', () => {
    const segments = [seg('A')]
    const markers = [marker('m1')]
    expect(buildMarkerFilterContext(filter(), segments, markers).orphanMarkerIds).toBeUndefined()
    const withOrphans = buildMarkerFilterContext(filter({ onlyOrphans: true }), segments, markers)
    expect(withOrphans.orphanMarkerIds).toBeInstanceOf(Set)
  })

  it('isolointi tuottaa pätkän merkkijoukon (V259), ⊥ isolointia → undefined', () => {
    const s = seg('A')
    const markers = [marker('m1'), marker('kaukana', { lat: 60.0, lon: 20.0, routeIds: [] })]
    expect(buildMarkerFilterContext(filter(), [s], markers).isolatedMarkerIds).toBeUndefined()
    const iso = buildMarkerFilterContext(filter({ isolatedSegmentId: 'A' }), [s], markers)
    expect(iso.isolatedMarkerIds).toEqual(new Set(['m1']))
  })
})
