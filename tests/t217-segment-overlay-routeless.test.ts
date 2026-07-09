import { describe, it, expect } from 'vitest'
import { computeGapRanges } from '../src/map/segment-overlay'
import type { Segment } from '../src/logic/segments'
import type { RoutePoint } from '../src/logic/types'

// V139/T217: reitittömät tehtävät (aluetehtävät) EIVÄT osallistu reitin gap-laskentaan eivätkä
// saa kaataa overlayta. computeGapRanges on overlayn puhdas ydin — testataan routeless-turvallisuus.

function routePoints(totalDist: number, step = 100): RoutePoint[] {
  const pts: RoutePoint[] = []
  for (let d = 0; d <= totalDist; d += step) {
    pts.push({ lat: 65 + d / 100000, lon: 27, distanceFromStart: d })
  }
  return pts
}

function routedSeg(id: string, routeIds: string[], startDist: number, endDist: number): Segment {
  return { id, routeIds, startDist, endDist, equipment: [], phase: 'asettaminen' }
}

function routelessSeg(id: string): Segment {
  return { id, equipment: [], phase: 'asettaminen' }
}

describe('T217/V139: computeGapRanges routeless-turvallisuus', () => {
  const rp = routePoints(5000)

  it('reitillinen pätkä [1000,3000] tuottaa gapit [0,1000] ja [3000,5000]', () => {
    const gaps = computeGapRanges([routedSeg('s1', ['r1'], 1000, 3000)], 'r1', rp)
    expect(gaps).toEqual([[0, 1000], [3000, 5000]])
  })

  it('reititön tehtävä ei osallistu gappeihin — koko reitti yhä kattamaton', () => {
    const gaps = computeGapRanges([routelessSeg('area1')], 'r1', rp)
    expect(gaps).toEqual([[0, 5000]])
  })

  it('reititön tehtävä routed-pätkien joukossa ei vääristä eikä kaada gappeja', () => {
    const segs = [
      routedSeg('s1', ['r1'], 1000, 3000),
      routelessSeg('area1'),          // ei route-kenttiä
      routedSeg('s2', ['r1'], 3000, 4000),
    ]
    expect(() => computeGapRanges(segs, 'r1', rp)).not.toThrow()
    const gaps = computeGapRanges(segs, 'r1', rp)
    // routeless jätetään pois → katetut alueet vain s1+s2 → gapit [0,1000] ja [4000,5000]
    expect(gaps).toEqual([[0, 1000], [4000, 5000]])
  })

  it('vain reitittömiä tehtäviä → koko reitti kattamaton (ei kaadu)', () => {
    const gaps = computeGapRanges([routelessSeg('a1'), routelessSeg('a2')], 'r1', rp)
    expect(gaps).toEqual([[0, 5000]])
  })
})
