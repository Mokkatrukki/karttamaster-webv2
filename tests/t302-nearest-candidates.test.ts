import { describe, it, expect } from 'vitest'
import { nearestPointCandidates, nearestPointIndex } from '../src/logic/bearing'
import { computeDistanceByRoute } from '../src/logic/marker-distance'
import { resolveTaskMarkers } from '../src/logic/task-markers'
import type { RoutePoint, SignMarker } from '../src/logic/types'

// T302/V214/B116: edestakainen osuus — reitti menee pisteeseen X, kääntyy ja palaa samaa
// polkua. Piste X on reitillä KAHDESTI: km 2000 (meno) ja km 6000 (paluu). Globaali argmin
// valitsee niistä toisen metrin erolla = arpa.
const OUT_AND_BACK: RoutePoint[] = [
  { lat: 65.00, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.01, lon: 25.0, distanceFromStart: 1000 },
  { lat: 65.02, lon: 25.0, distanceFromStart: 2000 }, // kääntöpiste-alue
  { lat: 65.03, lon: 25.0, distanceFromStart: 3000 },
  { lat: 65.04, lon: 25.0, distanceFromStart: 4000 }, // kärki
  { lat: 65.03, lon: 25.0, distanceFromStart: 5000 },
  { lat: 65.02, lon: 25.0, distanceFromStart: 6000 }, // sama kohta kuin km 2000
  { lat: 65.01, lon: 25.0, distanceFromStart: 7000 },
  { lat: 65.00, lon: 25.0, distanceFromStart: 8000 },
]

const STRAIGHT: RoutePoint[] = [
  { lat: 60.0, lon: 20.0, distanceFromStart: 0 },
  { lat: 60.1, lon: 20.0, distanceFromStart: 5000 },
  { lat: 60.2, lon: 20.0, distanceFromStart: 10000 },
]

describe('T302/V214 — nearestPointCandidates', () => {
  it('edestakaisella osuudella löytyy KAKSI ehdokasta, ei yksi arvottu', () => {
    const c = nearestPointCandidates(OUT_AND_BACK, 65.02, 25.0, 100)
    expect(c.map(x => x.distanceFromStart).sort((a, b) => a - b)).toEqual([2000, 6000])
  })

  it('suoralla reitillä yksi ehdokas', () => {
    expect(nearestPointCandidates(STRAIGHT, 60.1, 20.0, 100)).toHaveLength(1)
  })

  it('threshold rajaa pois kaukaiset', () => {
    expect(nearestPointCandidates(STRAIGHT, 61.0, 20.0, 100)).toHaveLength(0)
  })

  it('nearestPointIndex pysyy entisenä (wrapper ei riko kutsujia)', () => {
    expect(nearestPointIndex(STRAIGHT, 60.1, 20.0)).toBe(1)
    expect(nearestPointIndex(STRAIGHT, 61.0, 20.0)).toBe(2)
  })

  it('tyhjä reitti → tyhjä lista, ei kaadu', () => {
    expect(nearestPointCandidates([], 65, 25, 100)).toEqual([])
  })
})

describe('T302/B116 — lenkin molemmat km-kohdat säilyvät', () => {
  const ROUTES = [{ id: 'lenkki', routePoints: OUT_AND_BACK }]

  it('computeDistanceByRoute palauttaa molemmat', () => {
    const d = computeDistanceByRoute(65.02, 25.0, ROUTES)
    expect([...d.lenkki].sort((a, b) => a - b)).toEqual([2000, 6000])
  })

  it('pätkä menopuolella [1500,2500] poimii merkin', () => {
    const m = {
      id: 'm', type: 'nuoli', lat: 65.02, lon: 25.0, status: 'suunniteltu',
      routeIds: ['lenkki'], distanceFromStart: 6000,
      distanceByRoute: { lenkki: [2000, 6000] },
    } as SignMarker
    expect(resolveTaskMarkers(
      { routeIds: ['lenkki'], primaryRouteId: 'lenkki', startDist: 1500, endDist: 2500 }, [m],
    )).toHaveLength(1)
  })

  it('pätkä paluupuolella [5500,6500] poimii saman merkin', () => {
    const m = {
      id: 'm', type: 'nuoli', lat: 65.02, lon: 25.0, status: 'suunniteltu',
      routeIds: ['lenkki'], distanceFromStart: 2000,
      distanceByRoute: { lenkki: [2000, 6000] },
    } as SignMarker
    expect(resolveTaskMarkers(
      { routeIds: ['lenkki'], primaryRouteId: 'lenkki', startDist: 5500, endDist: 6500 }, [m],
    )).toHaveLength(1)
  })

  it('pätkä kärjessä [3500,4500] EI poimi — merkki ei ole siellä', () => {
    const m = {
      id: 'm', type: 'nuoli', lat: 65.02, lon: 25.0, status: 'suunniteltu',
      routeIds: ['lenkki'], distanceFromStart: 2000,
      distanceByRoute: { lenkki: [2000, 6000] },
    } as SignMarker
    expect(resolveTaskMarkers(
      { routeIds: ['lenkki'], primaryRouteId: 'lenkki', startDist: 3500, endDist: 4500 }, [m],
    )).toHaveLength(0)
  })
})
