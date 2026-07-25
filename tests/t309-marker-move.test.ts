import { describe, it, expect } from 'vitest'
import {
  resolveMoveAssignment,
  inferKmAxisRouteId,
  snapshotMarkerPosition,
  applyMarkerPosition,
  isServerRejection,
} from '../src/logic/marker-distance'
import { resolveTaskMarkers } from '../src/logic/task-markers'
import type { SignMarker, RoutePoint } from '../src/logic/types'

// B121:n koeasetelma: r1 ja r2 kulkevat SAMAA polkua eri km-lukemilla (jaettu osuus, 3 SMTB-
// reittiä ≤100 m). Sama fyysinen kohta on r1:llä 5.0 km ja r2:lla 45.0 km. r3 on kaukana.
const PATH: Array<{ lat: number; lon: number }> = [
  { lat: 65.0, lon: 25.0 },
  { lat: 65.05, lon: 25.05 },
  { lat: 65.1, lon: 25.1 },
]
const r1: RoutePoint[] = PATH.map((p, i) => ({ ...p, distanceFromStart: i * 5000 }))
const r2: RoutePoint[] = PATH.map((p, i) => ({ ...p, distanceFromStart: 40000 + i * 5000 }))
const r3: RoutePoint[] = [
  { lat: 60.0, lon: 20.0, distanceFromStart: 0 },
  { lat: 60.1, lon: 20.1, distanceFromStart: 8000 },
]
const ROUTES = [
  { id: 'r1', routePoints: r1 },
  { id: 'r2', routePoints: r2 },
  { id: 'r3', routePoints: r3 },
]

// Talkoolaisen pätkä on mitattu r2:ta vasten (primaryRouteId) — jaettu osuus näkyy routeIds:issä.
const SEGMENT = {
  routeIds: ['r1', 'r2'],
  primaryRouteId: 'r2',
  startDist: 44000,
  endDist: 51000,
}

/** Merkki pätkän sisällä, km-akseli r2 (distanceFromStart = distanceByRoute.r2[0]). */
function markerOnSharedPath(over: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1',
    type: 'nuoli',
    lat: 65.1,
    lon: 25.1,
    distanceFromStart: 50000,
    distanceByRoute: { r1: [10000], r2: [50000] },
    routeIds: ['r1', 'r2'],
    status: 'suunniteltu',
    ...over,
  }
}

describe('T309/V221 — siirron km mitataan pätkän PRIMARY-reitistä', () => {
  it('pätkän primary-reitti on km-akseli, ei globaalisti lähin reitti', () => {
    const asg = resolveMoveAssignment(65.05, 25.05, ROUTES, { preferRouteId: 'r2' })
    // Vanha sääntö (lähin yli KAIKKIEN reittien) olisi antanut r1:n lukeman 5000.
    expect(asg.kmAxisRouteId).toBe('r2')
    expect(asg.distanceFromStart).toBe(45000)
    expect(asg.distanceByRoute).toEqual({ r1: [5000], r2: [45000] })
    expect(asg.routeIds).toEqual(['r1', 'r2'])
  })

  it('siirto jaetulla osuudella EI pudota merkkiä pätkästä (resolveTaskMarkers)', () => {
    const m = markerOnSharedPath()
    const asg = resolveMoveAssignment(65.05, 25.05, ROUTES, { preferRouteId: SEGMENT.primaryRouteId })
    applyMarkerPosition(m, asg)

    expect(resolveTaskMarkers(SEGMENT, [m]).map((x) => x.id)).toEqual(['m1'])
    // Kerrokset samaa mieltä: myös skalaari-fallback (serverin distFromStart-fallback,
    // marker-audit.ts distsOnSegmentAxis) osuu pätkän väliin → ei 403-erimielisyyttä.
    expect(m.distanceFromStart).toBeGreaterThanOrEqual(SEGMENT.startDist)
    expect(m.distanceFromStart).toBeLessThanOrEqual(SEGMENT.endDist)
  })

  it('ilman pätkäkontekstia km-akseli pysyy merkin ENTISESSÄ reitissä', () => {
    const m = markerOnSharedPath()
    expect(inferKmAxisRouteId(m)).toBe('r2')
    const asg = resolveMoveAssignment(65.05, 25.05, ROUTES, {
      fallbackAxisRouteId: inferKmAxisRouteId(m),
    })
    expect(asg.distanceFromStart).toBe(45000)
  })

  it('entinen akseli ei enää reitin varrella → lähin reitti (orvoksi ei jäädä)', () => {
    const m = markerOnSharedPath({
      distanceFromStart: 0,
      distanceByRoute: { r3: [0] },
      routeIds: ['r3'],
    })
    const asg = resolveMoveAssignment(65.1, 25.1, ROUTES, {
      fallbackAxisRouteId: inferKmAxisRouteId(m),
    })
    expect(['r1', 'r2']).toContain(asg.kmAxisRouteId)
    expect(asg.routeIds).toEqual(['r1', 'r2'])
  })

  it('kaikkien reittien ulkopuolella → tyhjä distanceByRoute, routeIds fallback lähimpään', () => {
    const asg = resolveMoveAssignment(64.0, 24.0, ROUTES, { preferRouteId: 'r2' })
    expect(asg.distanceByRoute).toEqual({})
    expect(asg.kmAxisRouteId).toBeUndefined()
    expect(asg.routeIds.length).toBe(1)
    expect(asg.distFromNearestRouteM).toBeGreaterThan(500)
  })
})

describe('T309/V220 — rollback palauttaa alkuperäiset kentät', () => {
  it('snapshot + restore → kaikki sijaintikentät ennallaan & merkki takaisin pätkään', () => {
    const m = markerOnSharedPath()
    const before = snapshotMarkerPosition(m)

    // siirto oikeasti rangen ulkopuolelle (r2 km 40000 < startDist 44000)
    const asg = resolveMoveAssignment(65.0, 25.0, ROUTES, { preferRouteId: SEGMENT.primaryRouteId })
    applyMarkerPosition(m, asg)
    expect(resolveTaskMarkers(SEGMENT, [m])).toEqual([])

    // serveri hylkäsi (403, V150) → rollback
    applyMarkerPosition(m, before)
    expect(m.lat).toBe(65.1)
    expect(m.lon).toBe(25.1)
    expect(m.distanceFromStart).toBe(50000)
    expect(m.distanceByRoute).toEqual({ r1: [10000], r2: [50000] })
    expect(m.routeIds).toEqual(['r1', 'r2'])
    expect(resolveTaskMarkers(SEGMENT, [m]).map((x) => x.id)).toEqual(['m1'])
  })

  it('snapshot ei jaa viittausta distanceByRouteen (mutaatio ei saastuta rollbackia)', () => {
    const m = markerOnSharedPath()
    const before = snapshotMarkerPosition(m)
    m.distanceByRoute!.r2 = [99999]
    expect(before.distanceByRoute).toEqual({ r1: [10000], r2: [50000] })
  })
})

describe('T309/V220 — vain PYSYVÄ hylkäys oikeuttaa rollbackin', () => {
  it('403/400/404 = hylkäys', () => {
    expect(isServerRejection(403)).toBe(true)
    expect(isServerRejection(400)).toBe(true)
    expect(isServerRejection(404)).toBe(true)
  })

  it('offline (null) / 5xx / 401 / 429 = laillinen pending-tila, EI rollbackia', () => {
    expect(isServerRejection(null)).toBe(false)
    expect(isServerRejection(500)).toBe(false)
    expect(isServerRejection(503)).toBe(false)
    expect(isServerRejection(401)).toBe(false)
    expect(isServerRejection(408)).toBe(false)
    expect(isServerRejection(425)).toBe(false)
    expect(isServerRejection(429)).toBe(false)
  })

  it('2xx ei ole hylkäys', () => {
    expect(isServerRejection(200)).toBe(false)
    expect(isServerRejection(204)).toBe(false)
  })
})
