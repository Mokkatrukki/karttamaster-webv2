import { describe, it, expect } from 'vitest'
import {
  computeDistanceByRoute,
  distanceForRoute,
  backfillDistanceByRoute,
} from '../src/logic/marker-distance'
import { resolveTaskMarkers } from '../src/logic/task-markers'
import type { SignMarker, RoutePoint } from '../src/logic/types'

// r1 ja r2 kulkevat SAMAA polkua eri km-lukemilla — sama fyysinen kohta on r1:llä 5.0 km ja
// r2:lla 45.0 km. Tämä on B115:n koeasetelma (3 SMTB-reittiä jaetulla osuudella).
const PATH: Array<{ lat: number; lon: number }> = [
  { lat: 65.0, lon: 25.0 },
  { lat: 65.05, lon: 25.05 },
  { lat: 65.1, lon: 25.1 },
]
const r1: RoutePoint[] = PATH.map((p, i) => ({ ...p, distanceFromStart: i * 5000 }))
const r2: RoutePoint[] = PATH.map((p, i) => ({ ...p, distanceFromStart: 40000 + i * 5000 }))
// kaukana kaikesta — ei jaettu osuus
const r3: RoutePoint[] = [
  { lat: 60.0, lon: 20.0, distanceFromStart: 0 },
  { lat: 60.1, lon: 20.1, distanceFromStart: 8000 },
]

const ROUTES = [
  { id: 'r1', routePoints: r1 },
  { id: 'r2', routePoints: r2 },
  { id: 'r3', routePoints: r3 },
]

function marker(over: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1', type: 'nuoli', lat: 65.1, lon: 25.1,
    distanceFromStart: 10000, routeIds: ['r1', 'r2'], status: 'suunniteltu',
    ...over,
  }
}

describe('T300/V212 — computeDistanceByRoute', () => {
  it('jaetulla osuudella merkki saa km:n MOLEMMILTA reiteiltä, eri lukemat', () => {
    const d = computeDistanceByRoute(65.1, 25.1, ROUTES)
    expect(d.r1).toEqual([10000])
    expect(d.r2).toEqual([50000])
    expect(d.r3).toBeUndefined()
  })

  it('kaukana kaikista reiteistä → tyhjä (ei arvata mitään)', () => {
    expect(computeDistanceByRoute(10, 10, ROUTES)).toEqual({})
  })
})

describe('T300/V212 — distanceForRoute', () => {
  it('palauttaa pyydetyn reitin km:n', () => {
    const m = marker({ distanceByRoute: { r1: [10000], r2: [50000] } })
    expect(distanceForRoute(m, 'r1')).toBe(10000)
    expect(distanceForRoute(m, 'r2')).toBe(50000)
  })

  it('legacy-merkki ilman karttaa → distanceFromStart (entinen käytös)', () => {
    const m = marker({ distanceFromStart: 777 })
    expect(distanceForRoute(m, 'r1')).toBe(777)
    expect(distanceForRoute(m, undefined)).toBe(777)
  })

  it('tuntematon reitti → fallback, ei undefined', () => {
    const m = marker({ distanceByRoute: { r1: [10000] }, distanceFromStart: 777 })
    expect(distanceForRoute(m, 'r9')).toBe(777)
  })
})

describe('T300/V212 — backfill', () => {
  it('täyttää puuttuvat, ei koske jo täytettyihin', () => {
    const a = marker({ id: 'a' })
    const b = marker({ id: 'b', distanceByRoute: { r1: [1] } })
    expect(backfillDistanceByRoute([a, b], ROUTES)).toBe(1)
    expect(a.distanceByRoute).toEqual({ r1: [10000], r2: [50000] })
    expect(b.distanceByRoute).toEqual({ r1: [1] })
  })

  it('orpo merkki (ei reittiä lähellä) jää koskematta', () => {
    const m = marker({ id: 'orpo', lat: 10, lon: 10 })
    expect(backfillDistanceByRoute([m], ROUTES)).toBe(0)
    expect(m.distanceByRoute).toBeUndefined()
  })
})

// B115:n ydin — sama merkki, kaksi pätkää eri reiteillä, sama km-väli.
describe('T300/B115 — pätkäsuodatus käyttää oikean reitin km:ää', () => {
  const m = marker({ distanceByRoute: { r1: [10000], r2: [50000] } })

  it('r1-pätkä [9000,11000] poimii merkin', () => {
    const got = resolveTaskMarkers(
      { routeIds: ['r1'], primaryRouteId: 'r1', startDist: 9000, endDist: 11000 }, [m])
    expect(got).toHaveLength(1)
  })

  it('r2-pätkä samalla km-välillä EI poimi — merkki on r2:lla 50 km kohdalla', () => {
    const got = resolveTaskMarkers(
      { routeIds: ['r2'], primaryRouteId: 'r2', startDist: 9000, endDist: 11000 }, [m])
    expect(got).toHaveLength(0)
  })

  it('r2-pätkä oikealla km-välillä [49000,51000] poimii', () => {
    const got = resolveTaskMarkers(
      { routeIds: ['r2'], primaryRouteId: 'r2', startDist: 49000, endDist: 51000 }, [m])
    expect(got).toHaveLength(1)
  })

  it('legacy-merkki ilman karttaa käyttäytyy kuten ennen (ei regressiota)', () => {
    const legacy = marker({ distanceFromStart: 10000 })
    expect(resolveTaskMarkers(
      { routeIds: ['r1'], primaryRouteId: 'r1', startDist: 9000, endDist: 11000 }, [legacy])).toHaveLength(1)
  })

  it('legacy-pätkä ilman primaryRouteId → routeIds[0] on akseli', () => {
    const got = resolveTaskMarkers({ routeIds: ['r2'], startDist: 49000, endDist: 51000 }, [m])
    expect(got).toHaveLength(1)
  })

  it('linked/typeFilter-unioni toimii yhä km:stä riippumatta (V140)', () => {
    expect(resolveTaskMarkers(
      { routeIds: ['r2'], primaryRouteId: 'r2', startDist: 0, endDist: 1, linkedMarkerIds: ['m1'] },
      [m])).toHaveLength(1)
  })
})
