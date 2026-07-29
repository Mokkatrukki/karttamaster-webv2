// T392/V284: pätkä ⊥ omista merkkiä joka on selvästi lähempänä TOISTA reittiä.
import { describe, it, expect } from 'vitest'
import { resolveSegmentMarkers, ROUTE_TOLERANCE_M } from '../src/logic/segment-membership'
import { nearestRouteByPath } from '../src/logic/multi-route'
import { distanceToPathM } from '../src/logic/segment-track'
import { backfillNearestRoute } from '../src/logic/marker-route-backfill'
import { buildRoutePoints } from '../src/logic/bearing'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const at = (east: number, north: number) => ({ lat: LAT0 + north / M_LAT, lon: LON0 + east / M_LON })

/** Suora itään kulkeva reitti; `north` erottaa rinnakkaiset reitit toisistaan. */
function route(id: string, lengthM: number, north: number) {
  const coords = []
  for (let d = 0; d <= lengthM; d += 50) coords.push(at(d, north))
  return { id, routePoints: buildRoutePoints(coords) }
}

function seg(id: string, routeIds: string[], routePoints: ReturnType<typeof route>['routePoints']): Segment {
  return {
    id, routeIds, primaryRouteId: routeIds[0], startDist: 0, endDist: 1000,
    phase: 'asettaminen', equipment: [],
    track: routePoints.map(p => ({ lat: p.lat, lon: p.lon, d: p.distanceFromStart })),
  } as Segment
}

function marker(id: string, east: number, north: number, routeIds: string[], extra: Partial<SignMarker> = {}): SignMarker {
  return { id, ...at(east, north), type: 'nuoli', status: 'suunniteltu', routeIds, ...extra } as SignMarker
}

// A = pohjoinen reitti (north 0), B = eteläinen (north −80 m). Molemmat ≤100 m korridorissa
// samasta merkistä ∴ V25-ehdokkuus ⊥ erota niitä — juuri se aukko jonka V284 sulkee.
const A = route('rA', 1000, 0)
const B = route('rB', 1000, -80)

describe('T392/V284 — lähin reitti rajaa jäsenyyden', () => {
  it('merkki reitin B varrella ⊥ päädy A:n pätkälle', () => {
    const segA = seg('a', ['rA'], A.routePoints)
    // 10 m B:stä (⊥ 70 m A:sta) & kuuluu molempien korridoriin.
    const m = marker('x', 500, -70, ['rA', 'rB'])
    const nearest = nearestRouteByPath(m.lat, m.lon, [A, B])!
    expect(nearest.routeId).toBe('rB')
    m.nearestRouteId = nearest.routeId
    m.nearestRouteDistM = nearest.distM

    expect(resolveSegmentMarkers([segA], [m]).get('a')).toEqual([])
  })

  it('sama merkki päätyy B:n pätkälle kun sellainen on', () => {
    const segB = seg('b', ['rB'], B.routePoints)
    const m = marker('x', 500, -70, ['rA', 'rB'])
    const nearest = nearestRouteByPath(m.lat, m.lon, [A, B])!
    m.nearestRouteId = nearest.routeId
    m.nearestRouteDistM = nearest.distM

    expect(resolveSegmentMarkers([segB], [m]).get('b')!.map(x => x.id)).toEqual(['x'])
  })

  it('jaetulla osuudella (reitit <25 m) merkki EI putoa — toleranssi suojaa', () => {
    const C = route('rC', 1000, -15)     // 15 m A:sta ∴ toleranssin sisällä
    const segA = seg('a', ['rA'], A.routePoints)
    const m = marker('x', 500, -12, ['rA', 'rC'])
    const nearest = nearestRouteByPath(m.lat, m.lon, [A, C])!
    expect(nearest.routeId).toBe('rC')
    m.nearestRouteId = nearest.routeId
    m.nearestRouteDistM = nearest.distM

    expect(resolveSegmentMarkers([segA], [m]).get('a')!.map(x => x.id)).toEqual(['x'])
  })

  it('kenttä puuttuu (backfill kesken) → entinen käytös', () => {
    const segA = seg('a', ['rA'], A.routePoints)
    const m = marker('x', 500, -70, ['rA', 'rB'])   // ⊥ nearestRouteDistM
    expect(resolveSegmentMarkers([segA], [m]).get('a')!.map(x => x.id)).toEqual(['x'])
  })

  it('eksplisiittinen linkitys ohittaa myös reittisäännön (V259)', () => {
    const segA = { ...seg('a', ['rA'], A.routePoints), linkedMarkerIds: ['x'] } as Segment
    const m = marker('x', 500, -70, ['rA', 'rB'], { nearestRouteId: 'rB', nearestRouteDistM: 10 })
    expect(resolveSegmentMarkers([segA], [m]).get('a')!.map(y => y.id)).toEqual(['x'])
  })

  it('toleranssi on 25 m & mitattu KOHTISUORASTI (sama mittari molemmin puolin)', () => {
    expect(ROUTE_TOLERANCE_M).toBe(25)
    // Kärkipiste-etäisyys erehtyy harvassa jonossa; kohtisuora ⊥. Piste 500 m kohdalla
    // pisteiden 0 ja 1000 välissä: kärkipiste-etäisyys olisi ~500 m, kohtisuora ~0.
    const harva = buildRoutePoints([at(0, 0), at(1000, 0)])
    expect(distanceToPathM(harva, at(500, 0).lat, at(500, 0).lon)).toBeLessThan(1)
  })
})

describe('T392 — backfill', () => {
  it('täyttää puuttuvat kentät & jättää olemassa olevat rauhaan', () => {
    const uusi = marker('uusi', 500, -70, ['rA', 'rB'])
    const vanha = marker('vanha', 500, -70, ['rA', 'rB'], { nearestRouteId: 'rA', nearestRouteDistM: 5 })
    const changed = backfillNearestRoute([uusi, vanha], [A, B])

    expect(changed.map(m => m.id)).toEqual(['uusi'])
    expect(uusi.nearestRouteId).toBe('rB')
    expect(uusi.nearestRouteDistM).toBeCloseTo(10, 0)
    // Luonnissa laskettu arvo on tuoreempi ∴ backfill ⊥ ylikirjoita sitä.
    expect(vanha.nearestRouteDistM).toBe(5)
  })

  it('ilman reittejä ⊥ merkitä mitään (Infinity pudottaisi merkin joka pätkästä)', () => {
    const m = marker('x', 500, -70, ['rA'])
    expect(backfillNearestRoute([m], [])).toEqual([])
    expect(m.nearestRouteDistM).toBeUndefined()
  })
})
