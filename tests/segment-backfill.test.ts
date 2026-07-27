import { describe, it, expect } from 'vitest'
import { buildRoutePoints } from '../src/logic/bearing'
import { backfillSegmentTracks, boundsPatch } from '../src/logic/segment-backfill'
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
      // T363: ristikkäiset rajat torjutaan VARTIJALLA ennen `deriveTrackFromBounds`ia (joka
      // heittää) ∴ rikkinäinen legacy-rivi jää V260-km-haaraan eikä kaada koko backfilliä.
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

describe('T363/V258 — rajojen muokkaus johtaa jäljen uudelleen', () => {
  const r1 = route('r1')
  const seg = { routeIds: ['r1'], primaryRouteId: 'r1' }

  it('palauttaa rajat JA jäljen samasta johtofunktiosta', () => {
    const patch = boundsPatch(seg, [r1], r1.routePoints[2].distanceFromStart, r1.routePoints[7].distanceFromStart)

    expect(patch.startDist).toBe(r1.routePoints[2].distanceFromStart)
    expect(patch.endDist).toBe(r1.routePoints[7].distanceFromStart)
    expect(patch.track).toHaveLength(6)
    expect(patch.track![0].d).toBe(0)
  })

  it('jälki vastaa uusia rajoja — ei jää jälkeen vanhoista', () => {
    const wide = boundsPatch(seg, [r1], 0, r1.routePoints[9].distanceFromStart)
    const narrow = boundsPatch(seg, [r1], 0, r1.routePoints[3].distanceFromStart)

    expect(trackLengthM(narrow.track!)).toBeLessThan(trackLengthM(wide.track!))
    expect(trackLengthM(narrow.track!)).toBeCloseTo(r1.routePoints[3].distanceFromStart, 0)
  })

  it('ristikkäiset rajat → ei jälkeä, ei heittoa (kutsuja on jo validoinut UI:ssa)', () => {
    const patch = boundsPatch(seg, [r1], 700, 200)

    expect(patch.track).toBeUndefined()
    expect(patch.startDist).toBe(700)
  })

  it('tuntematon reitti → rajat ilman jälkeä (pätkä jää V260-km-haaraan)', () => {
    const patch = boundsPatch({ routeIds: ['ei-ole'], primaryRouteId: 'ei-ole' }, [r1], 0, 500)

    expect(patch.track).toBeUndefined()
  })
})

describe('T363/T358 — deriveTrackFromBounds heittää ristikkäisistä rajoista', () => {
  const r1 = route('r1')

  it('sisarfunktiot käsittelevät saman virheluokan samoin', () => {
    // `buildTrackFromAnchors` heitti jo ei-monotonisesta ankkurista; hiljainen tyhjä jälki
    // olisi ollut pahempi: se näyttäisi migroidulta muttei omistaisi mitään merkkiä (V259).
    expect(() => deriveTrackFromBounds(r1.routePoints, 700, 200)).toThrow(/must be </)
    expect(() => deriveTrackFromBounds(r1.routePoints, 500, 500)).toThrow(/must be </)
  })

  it('backfill ohittaa rikkinäisen rivin eikä kaadu', () => {
    const store = storeWith([
      { id: 'ristiin', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 700, endDist: 200 },
      { id: 'ok', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 500 },
    ])

    expect(backfillSegmentTracks(store, [r1]).map(s => s.id)).toEqual(['ok'])
  })
})
