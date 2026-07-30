import { describe, it, expect } from 'vitest'
import { addMarkersToSegment, removeMarkersFromSegment } from '../src/logic/segment-actions'
import { resolveSegmentMarkers } from '../src/logic/segment-membership'
import { buildRoutePoints } from '../src/logic/bearing'
import { deriveTrackFromBounds } from '../src/logic/segment-track'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T414/V305: merkkien liittäminen tehtävään on additiivinen & idempotentti, kulkee yhden apurin
// kautta & kattaa reitittömän JA reitillisen (automaattisesti poimivan) pätkän samalla polulla.

const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const at = (east: number, north: number): { lat: number; lon: number } => ({
  lat: LAT0 + north / M_LAT,
  lon: LON0 + east / M_LON,
})

function route(lengthM: number, stepM: number, north = 0) {
  const coords: { lat: number; lon: number }[] = []
  for (let d = 0; d <= lengthM; d += stepM) coords.push(at(d, north))
  return buildRoutePoints(coords)
}

function seg(over: Partial<Segment> & { id: string }): Segment {
  return { phase: 'asettaminen', equipment: [], ...over } as Segment
}

function marker(over: Partial<SignMarker> & { id: string }): SignMarker {
  return {
    type: 'nuoli',
    lat: LAT0,
    lon: LON0,
    distanceFromStart: 0,
    routeIds: ['r1'],
    status: 'suunniteltu',
    ...over,
  } as SignMarker
}

describe('T414/V305 — addMarkersToSegment', () => {
  it('(i) unioni: uudet id:t nykyisten perään', () => {
    const s = seg({ id: 's1', linkedMarkerIds: ['a'] })
    expect(addMarkersToSegment(s, ['b', 'c']).linkedMarkerIds).toEqual(['a', 'b', 'c'])
  })

  it('(i) tyhjä lähtötila: linkedMarkerIds syntyy', () => {
    expect(addMarkersToSegment(seg({ id: 's1' }), ['a']).linkedMarkerIds).toEqual(['a'])
  })

  it('(ii) idempotentti: sama id 2× ⊥ tuplaa & järjestys ⊥ muutu', () => {
    const s = seg({ id: 's1', linkedMarkerIds: ['a', 'b'] })
    const once = addMarkersToSegment(s, ['b', 'c'])
    const twice = addMarkersToSegment(once, ['b', 'c'])
    expect(once.linkedMarkerIds).toEqual(['a', 'b', 'c'])
    expect(twice.linkedMarkerIds).toEqual(['a', 'b', 'c'])
    expect(twice).toBe(once) // sama olio ∴ turha sync jää tekemättä
  })

  it('(v) tyhjä lista → SAMA olio (⊥ turhaa syncia)', () => {
    const s = seg({ id: 's1', linkedMarkerIds: ['a'] })
    expect(addMarkersToSegment(s, [])).toBe(s)
  })

  it('(vi) lisätty id poistuu excludedMarkerIds:istä (V305: ristiriita pois rakenteesta)', () => {
    const s = seg({ id: 's1', linkedMarkerIds: [], excludedMarkerIds: ['x', 'y'] })
    const next = addMarkersToSegment(s, ['x'])
    expect(next.linkedMarkerIds).toEqual(['x'])
    expect(next.excludedMarkerIds).toEqual(['y'])
  })

  it('viimeisen exclude-osuman jälkeen kenttä on undefined ⊥ tyhjä taulukko', () => {
    const s = seg({ id: 's1', excludedMarkerIds: ['x'] })
    expect(addMarkersToSegment(s, ['x']).excludedMarkerIds).toBeUndefined()
  })

  it('alkuperäistä pätkäoliota ⊥ mutatoida (kutsuja persistoi kopion)', () => {
    const s = seg({ id: 's1', linkedMarkerIds: ['a'] })
    addMarkersToSegment(s, ['b'])
    expect(s.linkedMarkerIds).toEqual(['a'])
  })
})

describe('T414/V305 — jäsenyys MITATTUNA resolveSegmentMarkersilla', () => {
  const points = route(4000, 100)

  it('(iii) lisäys ⊥ vie merkkiä toiselta pätkältä (V291, T401:n testin sisar)', () => {
    const omistaja = seg({
      id: 'omistaja',
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 2000,
      track: deriveTrackFromBounds(points, 0, 2000),
    })
    const reititon = seg({ id: 'reititon' })
    const m = marker({ id: 'm1', ...at(1000, 0), distanceFromStart: 1000, nearestRouteId: 'r1', nearestRouteDistM: 0 })

    const ennen = resolveSegmentMarkers([omistaja, reititon], [m])
    expect(ennen.get('omistaja')!.map(x => x.id)).toEqual(['m1'])

    const jalkeen = resolveSegmentMarkers([omistaja, addMarkersToSegment(reititon, ['m1'])], [m])
    expect(jalkeen.get('reititon')!.map(x => x.id)).toEqual(['m1'])
    // Ydin: omistaja EI menetä merkkiään — operaatio on additiivinen, ⊥ siirto.
    expect(jalkeen.get('omistaja')!.map(x => x.id)).toEqual(['m1'])
  })

  it('(iv) reitillinen pätkä: linkattu merkki tulee automaattipoimintojen LISÄKSI ⊥ tilalle', () => {
    const patka = seg({
      id: 'patka',
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 2000,
      track: deriveTrackFromBounds(points, 0, 2000),
    })
    // Geometrinen poiminta löytää `auto`n (pätkän jäljellä); `kauko` on 900 m sivussa ∴ vain
    // eksplisiittinen linkki voi tuoda sen mukaan.
    const auto = marker({ id: 'auto', ...at(500, 0), distanceFromStart: 500, nearestRouteId: 'r1', nearestRouteDistM: 0 })
    const kauko = marker({ id: 'kauko', ...at(500, 900), distanceFromStart: 500, nearestRouteId: 'r1', nearestRouteDistM: 900 })

    const ennen = resolveSegmentMarkers([patka], [auto, kauko])
    expect(ennen.get('patka')!.map(x => x.id)).toEqual(['auto'])

    const jalkeen = resolveSegmentMarkers([addMarkersToSegment(patka, ['kauko'])], [auto, kauko])
    expect(jalkeen.get('patka')!.map(x => x.id).sort()).toEqual(['auto', 'kauko'])
  })
})

describe('T414/V305 — removeMarkersFromSegment (käänteinen)', () => {
  const points = route(4000, 100)
  const patka = seg({
    id: 'patka',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: 0,
    endDist: 2000,
    track: deriveTrackFromBounds(points, 0, 2000),
  })

  it('poisto kirjoittaa excluden ∴ geometria ⊥ löydä merkkiä uudelleen', () => {
    const m = marker({ id: 'auto', ...at(500, 0), distanceFromStart: 500, nearestRouteId: 'r1', nearestRouteDistM: 0 })
    const jalkeen = resolveSegmentMarkers([removeMarkersFromSegment(patka, ['auto'])], [m])
    expect(jalkeen.get('patka')).toEqual([])
  })

  it('poisto pudottaa linkin ∴ sama id ⊥ jää molemmille listoille', () => {
    const s = addMarkersToSegment(patka, ['x'])
    const next = removeMarkersFromSegment(s, ['x'])
    expect(next.linkedMarkerIds).toBeUndefined()
    expect(next.excludedMarkerIds).toEqual(['x'])
  })

  it('idempotentti: jo poissuljettu → sama olio', () => {
    const s = seg({ id: 's1', excludedMarkerIds: ['x'] })
    expect(removeMarkersFromSegment(s, ['x'])).toBe(s)
  })
})
