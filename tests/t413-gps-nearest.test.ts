import { describe, it, expect } from 'vitest'
import {
  nearestUnsetByGps,
  defaultUnsetSelection,
  isRoutelessSegment,
  firstUnsetMarker,
} from '../src/logic/navigation'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T413/V304: reitittömän tehtävän "seuraava merkki" ratkeaa metrisellä etäisyydellä GPS-fixiin,
// ⊥ `distanceFromStart`-skalaarilla (joka on reitittömälle joukolle mielivaltainen akseli).

const LAT0 = 65.6
const LON0 = 27.5
const M_LAT = 111320
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
/** metrit asteiksi — fixture luettavissa metreinä. */
const at = (east: number, north: number): { lat: number; lon: number } => ({
  lat: LAT0 + north / M_LAT,
  lon: LON0 + east / M_LON,
})

function marker(over: Partial<SignMarker> & { id: string }): SignMarker {
  return {
    type: 'nuoli',
    lat: LAT0,
    lon: LON0,
    distanceFromStart: 0,
    routeIds: ['smtb-60'],
    status: 'suunniteltu',
    ...over,
  } as SignMarker
}

function seg(over: Partial<Segment> = {}): Segment {
  return { id: 's1', phase: 'asettaminen', equipment: [], ...over } as Segment
}

/** Reititön tehtävä (V139): ⊥ routeIds ⊥ rajoja — merkit tulevat `linkedMarkerIds`istä. */
const routeless = seg({ linkedMarkerIds: ['a', 'b', 'c'] })
/** Reitillinen pätkä: kaikki kolme kenttää annettu ∴ `segmentKm` saa akselin. */
const routed = seg({ routeIds: ['smtb-60'], primaryRouteId: 'smtb-60', startDist: 0, endDist: 5000 })

describe('T413/V304 — isRoutelessSegment', () => {
  it('reitillinen pätkä (routeIds + rajat) ⊥ ole reititön', () => {
    expect(isRoutelessSegment(routed)).toBe(false)
  })

  it('reititön tehtävä on reititön', () => {
    expect(isRoutelessSegment(routeless)).toBe(true)
  })

  it('puolikas reitti (rajat ilman routeIdsia) lasketaan reitittömäksi — akselia ⊥ ole', () => {
    expect(isRoutelessSegment(seg({ startDist: 0, endDist: 100 }))).toBe(true)
  })

  it('null-pätkä (orpojen lista) on reititön', () => {
    expect(isRoutelessSegment(null)).toBe(true)
  })
})

describe('T413/V304 — nearestUnsetByGps', () => {
  // Skalaari on TARKOITUKSELLA käänteinen etäisyyteen: lähin merkki on se jolla on SUURIN
  // `distanceFromStart` ∴ testi kaatuu jos valinta lipsuu takaisin skalaarijärjestykseen.
  const kauko = marker({ id: 'a', ...at(3000, 0), distanceFromStart: 10 })
  const keski = marker({ id: 'b', ...at(1000, 0), distanceFromStart: 500 })
  const lahin = marker({ id: 'c', ...at(50, 0), distanceFromStart: 9000 })
  const markers = [kauko, keski, lahin]

  it('(i) lähin metrinen voittaa vaikka distanceFromStart olisi suurin', () => {
    expect(nearestUnsetByGps(markers, at(0, 0))?.id).toBe('c')
  })

  it('GPS-sijainnin siirto vaihtaa voittajan', () => {
    expect(nearestUnsetByGps(markers, at(3100, 0))?.id).toBe('a')
  })

  it('(iv) terminaalistatus ⊥ valikoidu koskaan', () => {
    const asetettu = [
      marker({ id: 'c', ...at(50, 0), status: 'asetettu' }),
      marker({ id: 'x', ...at(2000, 0), status: 'ei_tarpeen' }),
      marker({ id: 'y', ...at(4000, 0), status: 'kerätty' }),
      keski,
    ]
    expect(nearestUnsetByGps(asetettu, at(0, 0))?.id).toBe('b')
  })

  it('(v) tasapeli → pienempi id ratkaisee determinististi (⊥ lista-indeksi)', () => {
    const sama = at(500, 0)
    const eka = nearestUnsetByGps([marker({ id: 'z', ...sama }), marker({ id: 'a', ...sama })], at(0, 0))
    const toka = nearestUnsetByGps([marker({ id: 'a', ...sama }), marker({ id: 'z', ...sama })], at(0, 0))
    expect(eka?.id).toBe('a')
    expect(toka?.id).toBe('a')
  })

  it('(vi) tyhjä joukko → null, ⊥ heitto', () => {
    expect(nearestUnsetByGps([], at(0, 0))).toBeNull()
    expect(nearestUnsetByGps([marker({ id: 'a', status: 'asetettu' })], at(0, 0))).toBeNull()
  })
})

describe('T413/V304 — defaultUnsetSelection', () => {
  const kauko = marker({ id: 'a', ...at(3000, 0), distanceFromStart: 10 })
  const lahin = marker({ id: 'c', ...at(50, 0), distanceFromStart: 9000 })
  const markers = [kauko, lahin]

  it('reititön + fix → lähin metrisesti', () => {
    expect(defaultUnsetSelection(markers, routeless, at(0, 0))?.id).toBe('c')
  })

  it('(ii) reititön ilman fixiä → firstUnsetMarker (nykykäytös bitti bitiltä)', () => {
    expect(defaultUnsetSelection(markers, routeless, null)?.id).toBe(
      firstUnsetMarker(markers, routeless)?.id,
    )
  })

  it('(iii) reitillinen + fix → km-järjestys VOITTAA (⊥ regressio V237/V238)', () => {
    // Molemmat merkit ovat pätkän km-välillä ∴ järjestys tulee akselilta: a (10 m) ennen c (9000 m
    // → välin ulkopuolella "ei reitillä" -ryhmässä). GPS ⊥ saa kääntää tätä.
    const valinta = defaultUnsetSelection(markers, routed, at(0, 0))
    expect(valinta?.id).toBe(firstUnsetMarker(markers, routed)?.id)
    expect(valinta?.id).toBe('a')
  })

  it('purkuvaiheen reitillinen pätkä säilyttää käänteisen suuntansa (V238)', () => {
    const purku = seg({ ...routed, phase: 'purku' })
    const a = marker({ id: 'a', ...at(100, 0), distanceFromStart: 100 })
    const b = marker({ id: 'b', ...at(4000, 0), distanceFromStart: 4000 })
    expect(defaultUnsetSelection([a, b], purku, at(0, 0))?.id).toBe('b')
  })

  it('tyhjä merkkijoukko → null kaikilla poluilla', () => {
    expect(defaultUnsetSelection([], routeless, at(0, 0))).toBeNull()
    expect(defaultUnsetSelection([], routeless, null)).toBeNull()
    expect(defaultUnsetSelection([], routed, at(0, 0))).toBeNull()
  })
})
