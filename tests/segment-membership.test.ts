import { describe, it, expect } from 'vitest'
import { buildRoutePoints } from '../src/logic/bearing'
import { deriveTrackFromBounds } from '../src/logic/segment-track'
import { resolveSegmentMarkers, markersForSegment } from '../src/logic/segment-membership'
import { segmentKm } from '../src/logic/segment-order'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// Syötteen leveysaste — metrit asteiksi, jotta fixture on luettavissa metreinä.
const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const at = (east: number, north: number): { lat: number; lon: number } => ({
  lat: LAT0 + north / M_LAT,
  lon: LON0 + east / M_LON,
})

/** Suora itään kulkeva reitti pisteineen. `north` erottaa rinnakkaiset reitit toisistaan. */
function route(lengthM: number, stepM: number, north = 0) {
  const coords: { lat: number; lon: number }[] = []
  for (let d = 0; d <= lengthM; d += stepM) coords.push(at(d, north))
  return buildRoutePoints(coords)
}

function seg(over: Partial<Segment> & { id: string }): Segment {
  return {
    phase: 'asettaminen',
    equipment: [],
    ...over,
  } as Segment
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

describe('V259/B143 — merkillä on täsmälleen yksi omistaja', () => {
  // B143-luokka 1: LENKKI. Reitti menee itään ja palaa 60 m pohjoisempana ∴ sama maaston kohta
  // saa kaksi km-lukemaa. Pätkä A = menon alkupää, pätkä B = menon loppupää + paluu.
  const loop = buildRoutePoints([
    ...Array.from({ length: 11 }, (_, i) => at(i * 100, 0)),
    ...Array.from({ length: 11 }, (_, i) => at(1000 - i * 100, 60)),
  ])
  const segA = seg({
    id: 'A',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: loop[0].distanceFromStart,
    endDist: loop[5].distanceFromStart,
    track: deriveTrackFromBounds(loop, loop[0].distanceFromStart, loop[5].distanceFromStart),
  })
  const segB = seg({
    id: 'B',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: loop[16].distanceFromStart,
    endDist: loop[21].distanceFromStart,
    track: deriveTrackFromBounds(loop, loop[16].distanceFromStart, loop[21].distanceFromStart),
  })

  it('lenkin sama maastonkohta: menon merkki kuuluu VAIN meno-pätkään', () => {
    // 300 m kohdalla, 10 m menouran sivussa → 10 m segA:sta, ~50 m segB:n paluu-urasta.
    const m = marker({ id: 'm1', ...at(300, 10), routeIds: ['r1'] })
    const owners = resolveSegmentMarkers([segA, segB], [m])

    expect(owners.get('A')!.map(x => x.id)).toEqual(['m1'])
    expect(owners.get('B')!.map(x => x.id)).toEqual([])
  })

  it('paluu-uran merkki kuuluu VAIN paluupätkään vaikka km-lukema osuisi molempiin', () => {
    const m = marker({ id: 'm2', ...at(300, 50), routeIds: ['r1'] })
    const owners = resolveSegmentMarkers([segA, segB], [m])

    expect(owners.get('B')!.map(x => x.id)).toEqual(['m2'])
    expect(owners.get('A')!.map(x => x.id)).toEqual([])
  })

  it('yksikään merkki ei päädy kahdelle pätkälle — B143:n hyväksymiskriteeri', () => {
    const markers = [
      marker({ id: 'a', ...at(200, 5), routeIds: ['r1'] }),
      marker({ id: 'b', ...at(300, 10), routeIds: ['r1'] }),
      marker({ id: 'c', ...at(300, 50), routeIds: ['r1'] }),
      marker({ id: 'd', ...at(800, 55), routeIds: ['r1'] }),
    ]
    const owners = resolveSegmentMarkers([segA, segB], markers)

    const counts = new Map<string, number>()
    for (const list of owners.values()) {
      for (const m of list) counts.set(m.id, (counts.get(m.id) ?? 0) + 1)
    }
    expect([...counts.values()].every(n => n === 1)).toBe(true)
  })
})

describe('V259/B143 — eri reittien jaettu korridori', () => {
  // B143-luokka 2: "Soininsuo" oli smtb-30:llä km 4.59 JA smtb-55:llä km 52.10 ∴ kahden eri
  // reitin pätkä omisti sen molemmat. Tässä r1 & r2 kulkevat 30 m päässä toisistaan.
  const r1 = route(1000, 100, 0)
  const r2 = route(1000, 100, 30)
  const s1 = seg({
    id: 's1',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: 0,
    endDist: 1000,
    track: deriveTrackFromBounds(r1, 0, 99999),
  })
  const s2 = seg({
    id: 's2',
    routeIds: ['r2'],
    primaryRouteId: 'r2',
    startDist: 0,
    endDist: 1000,
    track: deriveTrackFromBounds(r2, 0, 99999),
  })

  it('molempien reittien merkki menee lähemmälle jäljelle, ei molemmille', () => {
    // 10 m r1:stä, 20 m r2:sta — kuuluu molempien reittien korridoriin (V25).
    const m = marker({ id: 'jaettu', ...at(500, 10), routeIds: ['r1', 'r2'] })
    const owners = resolveSegmentMarkers([s1, s2], [m])

    expect(owners.get('s1')!.map(x => x.id)).toEqual(['jaettu'])
    expect(owners.get('s2')!.map(x => x.id)).toEqual([])
  })

  it('toisen reitin merkki ei tartu vieraan reitin pätkään (V25 scope)', () => {
    const m = marker({ id: 'vain-r2', ...at(500, 30), routeIds: ['r2'] })
    const owners = resolveSegmentMarkers([s1, s2], [m])

    expect(owners.get('s2')!.map(x => x.id)).toEqual(['vain-r2'])
    expect(owners.get('s1')!.map(x => x.id)).toEqual([])
  })
})

describe('V259 — kynnyksettömyys ja sen tietoinen hinta', () => {
  const r1 = route(1000, 100)
  const early = seg({
    id: 'early',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: 0,
    endDist: 300,
    track: deriveTrackFromBounds(r1, 0, 300),
  })
  const late = seg({
    id: 'late',
    routeIds: ['r1'],
    primaryRouteId: 'r1',
    startDist: 700,
    endDist: 1000,
    track: deriveTrackFromBounds(r1, 700, 1000),
  })

  it('kaukanakin oleva merkki saa omistajan — orpous on rakenteellisesti mahdotonta', () => {
    // 80 m sivussa: kynnyksellinen sääntö (40 m) pudottaisi tämän jokaiselta pätkältä.
    const m = marker({ id: 'kaukana', ...at(100, 80), routeIds: ['r1'] })
    const owners = resolveSegmentMarkers([early, late], [m])

    expect(owners.get('early')!.map(x => x.id)).toEqual(['kaukana'])
  })

  it('pätkien VÄLIIN jäävä merkki adoptoituu lähimpään (V259 tietoinen seuraus)', () => {
    // 500 m kohdalla — kummankaan pätkän km-välillä ei ole tätä, mutta early on lähempänä.
    const m = marker({ id: 'aukossa', ...at(450, 0), routeIds: ['r1'] })
    const owners = resolveSegmentMarkers([early, late], [m])

    expect(owners.get('early')!.map(x => x.id)).toEqual(['aukossa'])
    expect(owners.get('late')!.map(x => x.id)).toEqual([])
  })

  it('merkki joka ei ole minkään pätkän reitillä pysyy orpona', () => {
    const m = marker({ id: 'orpo', ...at(500, 0), routeIds: ['muu-reitti'] })
    const owners = resolveSegmentMarkers([early, late], [m])

    expect(owners.get('early')!).toEqual([])
    expect(owners.get('late')!).toEqual([])
  })

  it('tasapeli ratkeaa pätkän id:llä — sama syöte, sama tulos', () => {
    const a = seg({ id: 'aaa', routeIds: ['r1'], startDist: 0, endDist: 1000, track: deriveTrackFromBounds(r1, 0, 99999) })
    const b = seg({ id: 'bbb', routeIds: ['r1'], startDist: 0, endDist: 1000, track: deriveTrackFromBounds(r1, 0, 99999) })
    const m = marker({ id: 'tasan', ...at(500, 10), routeIds: ['r1'] })

    expect(resolveSegmentMarkers([a, b], [m]).get('aaa')!.map(x => x.id)).toEqual(['tasan'])
    expect(resolveSegmentMarkers([b, a], [m]).get('aaa')!.map(x => x.id)).toEqual(['tasan'])
  })
})

describe('V259 — eksplisiittinen tahto voittaa geometrian', () => {
  const r1 = route(1000, 100)
  const near = deriveTrackFromBounds(r1, 0, 500)
  const far = deriveTrackFromBounds(r1, 500, 1000)

  it('excludedMarkerIds poistaa merkin vaikka jälki olisi lähin — seuraavaksi lähin saa sen', () => {
    const a = seg({ id: 'a', routeIds: ['r1'], startDist: 0, endDist: 500, track: near, excludedMarkerIds: ['x'] })
    const b = seg({ id: 'b', routeIds: ['r1'], startDist: 500, endDist: 1000, track: far })
    const m = marker({ id: 'x', ...at(100, 5), routeIds: ['r1'] })

    const owners = resolveSegmentMarkers([a, b], [m])
    expect(owners.get('a')!).toEqual([])
    expect(owners.get('b')!.map(y => y.id)).toEqual(['x'])
  })

  it('linkedMarkerIds liittää merkin vaikka toinen jälki olisi lähempänä', () => {
    const a = seg({ id: 'a', routeIds: ['r1'], startDist: 0, endDist: 500, track: near })
    const b = seg({ id: 'b', routeIds: ['r1'], startDist: 500, endDist: 1000, track: far, linkedMarkerIds: ['x'] })
    const m = marker({ id: 'x', ...at(100, 5), routeIds: ['r1'] })

    const owners = resolveSegmentMarkers([a, b], [m])
    expect(owners.get('b')!.map(y => y.id)).toEqual(['x'])
    // Geometria ⊥ jaa merkkiä toiseen pätkään sen jälkeen kun tahto on lausuttu.
    expect(owners.get('a')!).toEqual([])
  })

  it('markerTypeFilter-osuma käyttäytyy kuten liitos (V143)', () => {
    const a = seg({ id: 'a', routeIds: ['r1'], startDist: 0, endDist: 500, track: near })
    const b = seg({ id: 'b', routeIds: ['r1'], startDist: 500, endDist: 1000, track: far, markerTypeFilter: 'huolto' })
    const m = marker({ id: 'x', ...at(100, 5), routeIds: ['r1'], templateId: 'huolto' })

    expect(resolveSegmentMarkers([a, b], [m]).get('b')!.map(y => y.id)).toEqual(['x'])
  })
})

describe('V91/V260 — vaiherajaus ja jäljetön välitila', () => {
  const r1 = route(1000, 100)
  const track = deriveTrackFromBounds(r1, 0, 1000)

  it('eri vaiheiden pätkät saavat omistaa saman merkin (V91)', () => {
    const asetus = seg({ id: 'as', phase: 'asettaminen', routeIds: ['r1'], startDist: 0, endDist: 1000, track })
    const purku = seg({ id: 'pu', phase: 'purku', routeIds: ['r1'], startDist: 0, endDist: 1000, track })
    const m = marker({ id: 'm', ...at(500, 5), routeIds: ['r1'] })

    const owners = resolveSegmentMarkers([asetus, purku], [m])
    expect(owners.get('as')!.map(x => x.id)).toEqual(['m'])
    expect(owners.get('pu')!.map(x => x.id)).toEqual(['m'])
  })

  it('jäljetön pätkä käyttäytyy täsmälleen kuten ennen (V260-välitila)', () => {
    const legacy = seg({
      id: 'legacy',
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 600,
    })
    const inRange = marker({ id: 'in', ...at(300, 5), routeIds: ['r1'], distanceFromStart: 300 })
    const outOfRange = marker({ id: 'out', ...at(900, 5), routeIds: ['r1'], distanceFromStart: 900 })

    const owners = resolveSegmentMarkers([legacy], [inRange, outOfRange])
    expect(owners.get('legacy')!.map(x => x.id)).toEqual(['in'])
  })

  it('reititön tehtävä (V139) pysyy linked/typeFilter-pohjaisena', () => {
    const alue = seg({ id: 'alue', linkedMarkerIds: ['keräys'] })
    const m1 = marker({ id: 'keräys', ...at(500, 5), routeIds: ['r1'] })
    const m2 = marker({ id: 'muu', ...at(500, 5), routeIds: ['r1'] })

    const owners = resolveSegmentMarkers([alue], [m1, m2])
    expect(owners.get('alue')!.map(x => x.id)).toEqual(['keräys'])
  })
})

describe('V259 — markersForSegment ja km-akseli seuraavat samaa jäsenyyttä', () => {
  const r1 = route(1000, 100)
  const a = seg({ id: 'a', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 0, endDist: 500, track: deriveTrackFromBounds(r1, 0, 500) })
  const b = seg({ id: 'b', routeIds: ['r1'], primaryRouteId: 'r1', startDist: 500, endDist: 1000, track: deriveTrackFromBounds(r1, 500, 1000) })

  it('markersForSegment ilman peersejä antaa pätkän oman osuman', () => {
    const m = marker({ id: 'm', ...at(100, 5), routeIds: ['r1'] })
    expect(markersForSegment(a, [m]).map(x => x.id)).toEqual(['m'])
  })

  it('markersForSegment peersien kanssa kunnioittaa eksklusiivisuutta', () => {
    const m = marker({ id: 'm', ...at(900, 5), routeIds: ['r1'] })
    expect(markersForSegment(a, [m], [a, b]).map(x => x.id)).toEqual([])
    expect(markersForSegment(b, [m], [a, b]).map(x => x.id)).toEqual(['m'])
  })

  it('segmentKm lukee jäljen akselia kun jälki on (V259 km-lupaus)', () => {
    // Rajat & odotusarvo REITILTÄ ITSELTÄÄN — `at()`:n metri→aste-likiarvo ajautuu ~0.1 %
    // haversine-matkasta ∴ nimellinen "500 m" ⊥ ole reitin piste (sama oppi kuin T358:ssa).
    const later = seg({
      id: 'later',
      routeIds: ['r1'],
      primaryRouteId: 'r1',
      startDist: r1[5].distanceFromStart,
      endDist: r1[10].distanceFromStart,
      track: deriveTrackFromBounds(r1, r1[5].distanceFromStart, r1[10].distanceFromStart),
    })
    const m = marker({
      id: 'm',
      lat: r1[7].lat,
      lon: r1[7].lon,
      routeIds: ['r1'],
      distanceFromStart: r1[7].distanceFromStart,
    })

    // Merkin km pätkän akselilla = matka pätkän alusta, ⊥ reitin alusta.
    const km = segmentKm(m, later)
    expect(km).not.toBeNull()
    expect(Math.abs((km as number) - (r1[7].distanceFromStart - r1[5].distanceFromStart))).toBeLessThan(2)
    // Todiste että akseli VAIHTUI: reitin oma lukema on satoja metrejä suurempi.
    expect(km as number).toBeLessThan(m.distanceFromStart - 100)
  })
})
