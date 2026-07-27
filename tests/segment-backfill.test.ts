import { describe, it, expect } from 'vitest'
import { buildRoutePoints } from '../src/logic/bearing'
import { backfillSegmentTracks } from '../src/logic/segment-backfill'
import { createSegmentStore, createSegment, cloneSegmentToNextPhase } from '../src/logic/segments'
import { deriveTrackFromBounds, trackLengthM } from '../src/logic/segment-track'
import type { Segment, SegmentStore } from '../src/logic/segments'

const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const at = (east: number, north = 0) => ({ lat: LAT0 + north / M_LAT, lon: LON0 + east / M_LON })

function route(id: string, lengthM = 1000, stepM = 100) {
  const coords: { lat: number; lon: number }[] = []
  for (let d = 0; d <= lengthM; d += stepM) coords.push(at(d))
  return { id, routePoints: buildRoutePoints(coords) }
}

function storeWith(segs: Partial<Segment>[]): SegmentStore {
  const store = createSegmentStore()
  for (const [i, s] of segs.entries()) {
    store.set(s.id ?? `s${i}`, { id: s.id ?? `s${i}`, phase: 'asettaminen', equipment: [], ...s } as Segment)
  }
  return store
}

describe('T361/V260 — legacy-pätkä saa jäljen rajoistaan', () => {
  const r1 = route('r1')

  it('johtaa jäljen ja palauttaa muutetut pätkät', () => {
    const store = storeWith([
      { id: 'a', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 500 },
    ])

    const changed = backfillSegmentTracks(store, [r1])

    expect(changed.map(s => s.id)).toEqual(['a'])
    expect(store.get('a')!.track!.length).toBeGreaterThan(1)
    expect(store.get('a')!.track![0].d).toBe(0)
  })

  it('johdettu jälki on SAMA siivu jonka kartta piirtää — maasto ei siirry', () => {
    const store = storeWith([
      { id: 'a', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 200, endDist: 700 },
    ])
    backfillSegmentTracks(store, [r1])

    // `segment-overlay.ts:sliceRoutePoints` piirtää täsmälleen tämän joukon.
    const expected = deriveTrackFromBounds(r1.routePoints, 200, 700)
    expect(store.get('a')!.track!.map(p => [p.lat, p.lon])).toEqual(expected.map(p => [p.lat, p.lon]))
  })

  it('ei ylikirjoita olemassa olevaa jälkeä (klik-klik / kentällä säädetty)', () => {
    const oma = deriveTrackFromBounds(r1.routePoints, 0, 300)
    const store = storeWith([
      { id: 'a', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 900, track: oma },
    ])

    const changed = backfillSegmentTracks(store, [r1])

    expect(changed).toEqual([])
    expect(trackLengthM(store.get('a')!.track!)).toBeCloseTo(trackLengthM(oma), 5)
  })

  it('ohittaa reitittömän tehtävän (V139) — ei akselia josta johtaa', () => {
    const store = storeWith([{ id: 'alue', linkedMarkerIds: ['m1'] }])

    expect(backfillSegmentTracks(store, [r1])).toEqual([])
    expect(store.get('alue')!.track).toBeUndefined()
  })

  it('ohittaa pätkän jonka reittiä ei löydy — arvaus olisi pahempi kuin puuttuva jälki', () => {
    const store = storeWith([
      { id: 'a', routeIds: ['puuttuva-gpx'], primaryRouteId: 'puuttuva-gpx', startDist: 0, endDist: 500 },
    ])

    expect(backfillSegmentTracks(store, [r1])).toEqual([])
    expect(store.get('a')!.track).toBeUndefined()
  })

  it('ohittaa rajat jotka eivät osu reitille — tyhjä jälki jäisi valheeksi', () => {
    const store = storeWith([
      { id: 'ulkona', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 90000, endDist: 95000 },
      // T358:n sopimusepäjatkuvuus: ristikkäiset rajat → tyhjä siivu. Jälki jää pois ∴
      // pätkä pysyy V260-legacy-haarassa eikä näytä migroidulta tyhjänä.
      { id: 'ristiin', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 700, endDist: 200 },
    ])

    expect(backfillSegmentTracks(store, [r1])).toEqual([])
    expect(store.get('ulkona')!.track).toBeUndefined()
    expect(store.get('ristiin')!.track).toBeUndefined()
  })

  it('legacy-pätkä ilman primaryRouteId:tä käyttää routeIds[0]:aa (V211)', () => {
    const store = storeWith([{ id: 'a', routeIds: ['r1'], startDist: 0, endDist: 500 }])

    expect(backfillSegmentTracks(store, [r1]).map(s => s.id)).toEqual(['a'])
  })

  it('on idempotentti — toinen ajo ei muuta mitään', () => {
    const store = storeWith([
      { id: 'a', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 500 },
    ])

    expect(backfillSegmentTracks(store, [r1])).toHaveLength(1)
    expect(backfillSegmentTracks(store, [r1])).toEqual([])
  })
})

describe('T361/V258 — vaihekloonaus perii jäljen (ck:review H-7)', () => {
  const r1 = route('r1')

  it('klooni saa saman maaston jäljen', () => {
    const store = createSegmentStore()
    const orig = createSegment(store, {
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 500,
      equipment: [],
      phase: 'asettaminen',
      track: deriveTrackFromBounds(r1.routePoints, 0, 500),
    })

    const clone = cloneSegmentToNextPhase(store, orig)

    expect(clone).not.toBeNull()
    expect(clone!.phase).toBe('tarkastus')
    expect(clone!.track).toHaveLength(orig.track!.length)
    expect(trackLengthM(clone!.track!)).toBeCloseTo(trackLengthM(orig.track!), 5)
  })

  it('kloonin jälki on KOPIO — rajojen muokkaus ei mutatoi alkuperäistä', () => {
    const store = createSegmentStore()
    const orig = createSegment(store, {
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 500,
      equipment: [],
      phase: 'asettaminen',
      track: deriveTrackFromBounds(r1.routePoints, 0, 500),
    })
    const clone = cloneSegmentToNextPhase(store, orig)!

    clone.track![0].lat = 0

    expect(orig.track![0].lat).not.toBe(0)
  })
})
