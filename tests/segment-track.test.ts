import { describe, it, expect } from 'vitest'
import { buildRoutePoints, haversineDistance } from '../src/logic/bearing'
import {
  deriveTrackFromBounds,
  buildTrackFromAnchors,
  trackLengthM,
  distanceToTrackM,
  kmAlongTrackM,
  type SegmentTrack,
} from '../src/logic/segment-track'
import type { RoutePoint } from '../src/logic/types'

// Syötteen leveysasteella (65.6°N) metri→aste -muunnokset. Testit rakentavat geometrian
// METREISSÄ ∴ odotusarvot ovat luettavia & vastaavat mitattuja tuotantolukuja (V261).
const LAT0 = 65.6
const LON0 = 27.5
const M_PER_DEG_LAT = 111320
const M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)

/** Piste `east` metriä itään & `north` metriä pohjoiseen origosta. */
function at(east: number, north: number): { lat: number; lon: number } {
  return { lat: LAT0 + north / M_PER_DEG_LAT, lon: LON0 + east / M_PER_DEG_LON }
}

/** Vanha semantiikka vertailua varten: etäisyys lähimpään KÄRKIPISTEESEEN (bearing.ts-tyyli). */
function vertexDistanceM(track: SegmentTrack, lat: number, lon: number): number {
  return Math.min(...track.map(p => haversineDistance(p, { lat, lon })))
}

/** Suora itään kulkeva reitti, piste `stepM` välein. */
function straightRoute(lengthM: number, stepM: number): RoutePoint[] {
  const coords: { lat: number; lon: number }[] = []
  for (let d = 0; d <= lengthM; d += stepM) coords.push(at(d, 0))
  return buildRoutePoints(coords)
}

// `at()` muuntaa metrit asteiksi likiarvolla & `buildRoutePoints` laskee todellisen
// haversine-matkan ∴ pisteiden `distanceFromStart` ajautuu ~0.1 % nimellisestä. Testit
// lukevat rajat & odotusarvot REITILTÄ ITSELTÄÄN, ⊥ nimellisistä metreistä — muuten testi
// mittaa apurini pyöristystä, ⊥ moduulin sopimusta.
const METER = 2 // sallittu heitto metreinä siellä missä odotusarvo on nimellinen

function expectMeters(actual: number | null, expected: number): void {
  expect(actual).not.toBeNull()
  expect(Math.abs((actual as number) - expected)).toBeLessThan(METER)
}

describe('V261 — kohtisuora projektio, ei kärkipiste-etäisyys', () => {
  it('distanceToTrackM mittaa janaan, ei kärkipisteeseen', () => {
    // Jana 200 m, merkki 20 m sivussa janan KESKELTÄ ∴ kärkipisteet ovat 100 m päässä
    // pitkittäissuunnassa. Kohtisuora = 20 m, kärkipiste-etäisyys ≈ 102 m.
    const track = deriveTrackFromBounds(buildRoutePoints([at(0, 0), at(200, 0)]), 0, 200)
    const marker = at(100, 20)

    expect(distanceToTrackM(track, marker.lat, marker.lon)).toBeCloseTo(20, 0)
    // Sama piste vanhalla semantiikalla — todiste että testi kaatuu kärkipiste-toteutuksella.
    expect(vertexDistanceM(track, marker.lat, marker.lon)).toBeGreaterThan(100)
  })

  it('harva GPX: kärkipiste-erhe ylittää 40 m siellä missä kohtisuora ei', () => {
    // Mitattu p95-pisteväli 73.8 m (smtb-55). Merkki 30 m sivussa kahden pisteen VÄLISTÄ:
    // kohtisuora 30 m, kärkipiste √(36.9² + 30²) ≈ 47.6 m. Kynnyksetön lähin-voittaa-vertailu
    // (V259) valitsisi kärkipisteillä väärän pätkän kahden rinnakkaisen jäljen välillä.
    const track = deriveTrackFromBounds(buildRoutePoints([at(0, 0), at(73.8, 0)]), 0, 73.8)
    const marker = at(36.9, 30)

    expect(distanceToTrackM(track, marker.lat, marker.lon)).toBeCloseTo(30, 0)
    expect(vertexDistanceM(track, marker.lat, marker.lon)).toBeGreaterThan(40)
  })

  it('projektio ei karkaa janan ulkopuolelle — jäljen pään takana mitataan päähän', () => {
    const track = deriveTrackFromBounds(straightRoute(500, 50), 0, 500)
    // 100 m jäljen LOPUN takana, 0 m sivussa → lähin kohta on viimeinen piste.
    const beyond = at(600, 0)

    expectMeters(distanceToTrackM(track, beyond.lat, beyond.lon), 100)
    expectMeters(kmAlongTrackM(track, beyond.lat, beyond.lon), trackLengthM(track))
  })
})

describe('V258 — deriveTrackFromBounds on sama siivu jonka kartta piirtää', () => {
  const route = straightRoute(1000, 100)

  it('vastaa segment-overlay:n sliceRoutePoints-suodatinta pisteestä pisteeseen', () => {
    // `sliceRoutePoints`: p.distanceFromStart >= startDist && <= endDist (segment-overlay.ts:290)
    const expected = route.filter(p => p.distanceFromStart >= 200 && p.distanceFromStart <= 600)
    const track = deriveTrackFromBounds(route, 200, 600)

    expect(track).toHaveLength(expected.length)
    expect(track.map(p => [p.lat, p.lon])).toEqual(expected.map(p => [p.lat, p.lon]))
  })

  it('jäljen akseli alkaa nollasta ja pituus on jäljen oma', () => {
    // Rajat reitiltä itseltään (pisteet 2 ja 6) ∴ odotusarvo ⊥ riipu apurin pyöristyksestä.
    const from = route[2].distanceFromStart
    const to = route[6].distanceFromStart
    const track = deriveTrackFromBounds(route, from, to)

    expect(track[0].d).toBe(0)
    expect(track).toHaveLength(5)
    expectMeters(trackLengthM(track), to - from)
  })

  it('rajojen ulkopuolinen väli tuottaa tyhjän jäljen, ei kaadu', () => {
    expect(deriveTrackFromBounds(route, 5000, 6000)).toEqual([])
    expect(trackLengthM([])).toBe(0)
    expect(distanceToTrackM([], LAT0, LON0)).toBe(Infinity)
    expect(kmAlongTrackM([], LAT0, LON0)).toBeNull()
  })
})

describe('V258/B144 — buildTrackFromAnchors kulkee eteenpäin, lenkki ei sekoa', () => {
  // Edestakainen reitti: 0→1000 m itään, sitten takaisin 1000→0 rinnakkaista uraa 60 m
  // pohjoisempana (kuten oikea lenkki: meno & paluu samassa korridorissa, ⊥ samalla viivalla).
  // Sama MAASTON kohta osuu reitille KAHDESTI — B143:n "sama merkki saa km 18.85 JA 20.69"
  // pienoiskoossa: 100 m korridori (V25/SHARED_THRESHOLD_M) kattaa molemmat urat.
  const outAndBack = buildRoutePoints([
    ...Array.from({ length: 11 }, (_, i) => at(i * 100, 0)),
    ...Array.from({ length: 10 }, (_, i) => at(900 - i * 100, 60)),
  ])

  it('ankkurit valitsevat MENO-osuuden, ei paluuta', () => {
    // Ankkurit: idx 2 (200 m, meno) → idx 4 (400 m, meno) → idx 6 (600 m, meno)
    const track = buildTrackFromAnchors(outAndBack, [2, 4, 6])

    expectMeters(
      trackLengthM(track),
      outAndBack[6].distanceFromStart - outAndBack[2].distanceFromStart,
    )
    // Jälki päättyy 600 m kohtaan menosuunnassa — ⊥ jatka paluu-uralle.
    expect(track).toHaveLength(5)
    expect(track.every(p => p.lat === outAndBack[0].lat)).toBe(true)
  })

  it('sama maaston kohta kahdella uralla → eri jälki, eri etäisyys', () => {
    const meno = buildTrackFromAnchors(outAndBack, [1, 5]) // 100–500 m menosuunta
    const paluu = buildTrackFromAnchors(outAndBack, [15, 19]) // paluu-ura 60 m pohjoisempana

    // Merkki 20 m menouran sivussa (∴ 40 m paluu-urasta): kuuluu MENOON. Kynnyksetön
    // lähin-voittaa (V259) ratkaisee tämän — km-vertailu ⊥ pysty, molemmat urat ovat "reitillä".
    const marker = at(300, 20)
    expectMeters(distanceToTrackM(meno, marker.lat, marker.lon), 20)
    expectMeters(distanceToTrackM(paluu, marker.lat, marker.lon), 40)
    expect(distanceToTrackM(meno, marker.lat, marker.lon)).toBeLessThan(
      distanceToTrackM(paluu, marker.lat, marker.lon),
    )
  })

  it('väliankkurit ovat jäljessä mukana yhtenäisenä siivuna', () => {
    const withMid = buildTrackFromAnchors(outAndBack, [2, 4, 6])
    const withoutMid = buildTrackFromAnchors(outAndBack, [2, 6])

    // V258: jälki on reitin yhtenäinen siivu ∴ väliankkuri ⊥ muuta tulosta — se ratkaisee vain
    // MINKÄ indeksin käyttäjä tarkoitti (B144). Sama siivu molemmilla.
    expect(withMid).toEqual(withoutMid)
  })

  it('ei-monotoninen ankkuri heittää, ei käännä hiljaa', () => {
    expect(() => buildTrackFromAnchors(outAndBack, [6, 2])).toThrow(/advance along route/)
    expect(() => buildTrackFromAnchors(outAndBack, [4, 4])).toThrow(/advance along route/)
  })

  it('liian vähän ankkureita tai rajan yli menevä indeksi heittää', () => {
    expect(() => buildTrackFromAnchors(outAndBack, [3])).toThrow(/>= 2 anchors/)
    expect(() => buildTrackFromAnchors(outAndBack, [0, 999])).toThrow(/out of range/)
  })
})

describe('V259 — kmAlongTrackM on matka jäljen alusta', () => {
  const route = straightRoute(1000, 50)
  // Rajat reitin omista pisteistä (idx 4 = ~200 m, viimeinen = ~1000 m).
  const track = deriveTrackFromBounds(route, route[4].distanceFromStart, route[20].distanceFromStart)

  it('palauttaa 0 jäljen alussa ja pituuden lopussa', () => {
    expectMeters(kmAlongTrackM(track, route[4].lat, route[4].lon), 0)
    expectMeters(kmAlongTrackM(track, route[20].lat, route[20].lon), trackLengthM(track))
  })

  it('interpoloi janan sisällä — ei napsahda kärkipisteeseen', () => {
    // Puolivälissä pisteitä 8 & 9, 10 m sivussa → lukema on niiden `d`:iden keskiarvo,
    // ⊥ kumpikaan kärkipiste (napsahtava toteutus antaisi toisen niistä).
    const a = track[4] // route[8]
    const b = track[5] // route[9]
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 }
    const marker = { lat: mid.lat + 10 / M_PER_DEG_LAT, lon: mid.lon }

    expectMeters(kmAlongTrackM(track, marker.lat, marker.lon), (a.d + b.d) / 2)
  })

  it('lukema on pätkän akselilla, ei reitin — sama maasto eri pätkillä eri km', () => {
    const early = deriveTrackFromBounds(route, route[0].distanceFromStart, route[10].distanceFromStart)
    const late = deriveTrackFromBounds(route, route[8].distanceFromStart, route[20].distanceFromStart)
    const marker = { lat: route[9].lat + 5 / M_PER_DEG_LAT, lon: route[9].lon }

    // Sama fyysinen kohta: aikaisemmalla pätkällä ~450 m, myöhemmällä ~50 m jäljen alusta.
    expectMeters(kmAlongTrackM(early, marker.lat, marker.lon), route[9].distanceFromStart)
    expectMeters(
      kmAlongTrackM(late, marker.lat, marker.lon),
      route[9].distanceFromStart - route[8].distanceFromStart,
    )
  })
})
