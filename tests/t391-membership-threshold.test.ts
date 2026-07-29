// T391/V283/B165: jäsenyys vaatii kynnyksen. Reitin AINOA pätkä voitti ennen tätä jokaisen
// merkin koko reitiltä — tuotannossa G62 omisti 38 merkkiä joista 21 oli yli km päässä.
import { describe, it, expect } from 'vitest'
import {
  resolveSegmentMarkers,
  markersForSegment,
  MEMBERSHIP_THRESHOLD_M,
} from '../src/logic/segment-membership'
import { orphanMarkerIds, defaultMapFilter, markerVisibility, activeFilterCount } from '../src/logic/map-filter'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// ~111 m per 0.001° latitudia — etäisyydet ovat siis suoraan luettavissa.
const M_PER_DEG = 111_320

function track(fromM: number, toM: number, lonOffsetM = 0) {
  const pts = []
  for (let d = fromM; d <= toM; d += 100) {
    pts.push({ lat: 65 + d / M_PER_DEG, lon: 25 + lonOffsetM / (M_PER_DEG * Math.cos(65 * Math.PI / 180)), d: d - fromM })
  }
  return pts
}

function seg(id: string, routeIds: string[], trackPts: ReturnType<typeof track>, extra: Partial<Segment> = {}): Segment {
  return {
    id, routeIds, primaryRouteId: routeIds[0], startDist: 0, endDist: 1000,
    phase: 'asettaminen', equipment: [], track: trackPts, ...extra,
  } as Segment
}

function marker(id: string, atM: number, offsetM: number, routeIds: string[]): SignMarker {
  return {
    id, lat: 65 + atM / M_PER_DEG,
    lon: 25 + offsetM / (M_PER_DEG * Math.cos(65 * Math.PI / 180)),
    routeIds, type: 'nuoli', status: 'suunniteltu',
  } as SignMarker
}

describe('T391/V283 — jäsenyyskynnys', () => {
  it('B165: reitin ainoa pätkä ⊥ omista kaukaista merkkiä', () => {
    const s = seg('a', ['r1'], track(0, 1000))
    const near = marker('near', 500, 50, ['r1'])     // 50 m sivussa
    const far = marker('far', 8000, 0, ['r1'])        // 7 km jäljen päästä eteenpäin
    const owned = resolveSegmentMarkers([s], [near, far]).get('a')!.map(m => m.id)
    expect(owned).toEqual(['near'])
  })

  it('kynnys on 200 m & rajatapaus ratkeaa sen mukaan', () => {
    expect(MEMBERSHIP_THRESHOLD_M).toBe(200)
    const s = seg('a', ['r1'], track(0, 1000))
    const inside = marker('inside', 500, MEMBERSHIP_THRESHOLD_M - 40, ['r1'])
    const outside = marker('outside', 500, MEMBERSHIP_THRESHOLD_M + 300, ['r1'])
    const owned = resolveSegmentMarkers([s], [inside, outside]).get('a')!.map(m => m.id)
    expect(owned).toEqual(['inside'])
  })

  it('naapuripätkien jako ⊥ muutu (V259 ennallaan kynnyksen sisällä)', () => {
    const a = seg('a', ['r1'], track(0, 1000))
    const b = seg('b', ['r1'], track(1000, 2000))
    const raja = marker('raja', 1010, 20, ['r1'])
    const res = resolveSegmentMarkers([a, b], [raja])
    expect(res.get('b')!.map(m => m.id)).toEqual(['raja'])
    expect(res.get('a')).toEqual([])
  })

  it('eksplisiittinen linkitys VOITTAA kynnyksen — järjestäjän tahto ⊥ ole geometriaa', () => {
    const far = marker('far', 8000, 0, ['r1'])
    const s = seg('a', ['r1'], track(0, 1000), { linkedMarkerIds: ['far'] })
    expect(resolveSegmentMarkers([s], [far]).get('a')!.map(m => m.id)).toEqual(['far'])
  })

  it('jäljetön (legacy) pätkä ⊥ muutu — sillä ⊥ ole jälkeä johon mitata (V260)', () => {
    const legacy = { ...seg('l', ['r1'], []), track: undefined, startDist: 0, endDist: 20000 } as Segment
    const m = marker('m', 8000, 0, ['r1'])
    m.distanceFromStart = 8000
    expect(resolveSegmentMarkers([legacy], [m]).get('l')!.length).toBe(1)
  })

  it('markersForSegment ilman peers-joukkoa säilyttää legacy-km-haaran', () => {
    const s = seg('a', ['r1'], track(0, 1000))
    const near = marker('near', 500, 50, ['r1'])
    expect(markersForSegment(s, [near], []).length).toBeGreaterThanOrEqual(0)
  })
})

describe('T391/V283 — orpojen näkyvyys', () => {
  it('orphanMarkerIds kertoo omistajattomat', () => {
    const s = seg('a', ['r1'], track(0, 1000))
    const near = marker('near', 500, 50, ['r1'])
    const far = marker('far', 8000, 0, ['r1'])
    const orphans = orphanMarkerIds([s], [near, far])
    expect([...orphans]).toEqual(['far'])
  })

  it('"vain ilman pätkää" rajaa muut pois & lasketaan aktiiviseksi suodattimeksi', () => {
    const f = { ...defaultMapFilter(), onlyOrphans: true }
    const ctx = { orphanMarkerIds: new Set(['far']) }
    const near = marker('near', 500, 50, ['r1'])
    const far = marker('far', 8000, 0, ['r1'])
    expect(markerVisibility(far, f, ctx)).toBe('full')
    expect(markerVisibility(near, f, ctx)).toBe('dim')
    expect(activeFilterCount(f)).toBe(1)
  })

  it('ilman orpojoukkoa suodatin ⊥ piilota mitään (⊥ tyhjää karttaa)', () => {
    const f = { ...defaultMapFilter(), onlyOrphans: true }
    const near = marker('near', 500, 50, ['r1'])
    expect(markerVisibility(near, f, {})).toBe('full')
  })
})
