import { describe, it, expect } from 'vitest'
import { segmentKm, orderMarkersInSegment, displayKm, RANGE_EPS_M } from '../src/logic/segment-order'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T328/V237/V238/B129 — pätkä omistaa km-akselin.
//
// Kiinnitysdata on PRODUKTIODATAA: `dev.db` + GPX ajettuna 2026-07-25. Pätkä 4 = smtb-55
// 20.68–25.65 km. Kuusi merkkiä on smtb-30+smtb-55 -jaetulla osuudella ja niiden
// `distanceFromStart` on mitattu smtb-30:ltä (0.00–0.57 km) vaikka smtb-55-akselilla ne ovat
// 25.14–25.69 km. Skalaarijärjestys nosti pätkän VIIMEISET merkit ensimmäisiksi (B126) ja
// skalaarinäyttö näytti niille 0.0 km (B129).

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 65, lon: 27,
    distanceFromStart: 0, routeIds: ['smtb-55'], status: 'suunniteltu',
    ...overrides,
  }
}

const PATKA4: Segment = {
  id: 'patka-4', routeIds: ['smtb-55'], primaryRouteId: 'smtb-55',
  startDist: 20675.7, endDist: 25653.2, equipment: [], phase: 'asettaminen',
}

// Prod-merkit (`bun run` dev.db + GPX 2026-07-25). `c55` = KAIKKI smtb-55-ehdokkaat, `c30` =
// smtb-30-ehdokkaat, `skalaari` = mitä `distance_from_start` kantaa kannassa. Huomaa kolme
// ensimmäistä: reitti ohittaa ne KAHDESTI (18.85 ja 20.69 km) ∴ vain jälkimmäinen on tällä
// pätkällä — "pienin ehdokas" -heuristiikka (T327) olisi järjestänyt ne pätkän ULKOPUOLELTA.
const PROD: Array<{ id: string; skalaari: number; c55: number[]; c30?: number[] }> = [
  { id: 'a', skalaari: 18850, c55: [18850, 20690] },
  { id: 'b', skalaari: 18880, c55: [18880, 20690] },
  { id: 'c', skalaari: 20690, c55: [20690, 18880] },
  { id: 'd', skalaari: 20860, c55: [20860, 20980] },
  { id: 'e', skalaari: 23060, c55: [23060] },
  { id: 'f', skalaari: 23340, c55: [23340] },
  { id: 'g', skalaari: 23740, c55: [23740] },
  { id: 'h', skalaari: 23840, c55: [23840] },
  { id: 'i', skalaari: 25140, c55: [25140], c30: [0] },
  { id: 'j', skalaari: 0, c55: [25180], c30: [0] },        // "oikea" — skalaari smtb-30:ltä
  { id: 'k', skalaari: 30, c55: [25210], c30: [30] },       // "vasen"
  { id: 'l', skalaari: 25560, c55: [25560], c30: [380] },   // "Ennakko 30 oikea"
  { id: 'm', skalaari: 570, c55: [25650], c30: [570, 470] },// "30km only irtokyltti"
  { id: 'n', skalaari: 510, c55: [25690], c30: [510] },     // "55 km vasen" — yli end_dist, ε kantaa
  { id: 'o', skalaari: 510, c55: [25690], c30: [510] },     // "30 km oikea"
]

const prodMarkers = PROD.map(p => makeMarker({
  id: p.id,
  distanceFromStart: p.skalaari,
  routeIds: p.c30 ? ['smtb-55', 'smtb-30'] : ['smtb-55'],
  distanceByRoute: p.c30 ? { 'smtb-55': p.c55, 'smtb-30': p.c30 } : { 'smtb-55': p.c55 },
}))

// Odotettu akseli-km per merkki = se ehdokas joka osuu [start−ε, end+ε]:iin.
const ODOTETTU_KM: Record<string, number> = {
  a: 20690, b: 20690, c: 20690, d: 20860, e: 23060, f: 23340, g: 23740, h: 23840,
  i: 25140, j: 25180, k: 25210, l: 25560, m: 25650, n: 25690, o: 25690,
}

describe('segmentKm (V237)', () => {
  it('lukee km:n pätkän akselilta, ei merkin skalaarista', () => {
    const jaettu = prodMarkers.find(m => m.id === 'j')!
    expect(segmentKm(jaettu, PATKA4)).toBe(25180)
    expect(jaettu.distanceFromStart).toBe(0) // skalaari on yhä väärä — sitä ei vain lueta
  })

  it('null kun merkki ei osu pätkän välille', () => {
    const kaukana = makeMarker({ id: 'x', distanceByRoute: { 'smtb-55': [40000] } })
    expect(segmentKm(kaukana, PATKA4)).toBeNull()
  })

  it('ε=50 m kantaa juuri yli end_dist osuvan merkin (prod: 25.69 km > 25.653)', () => {
    const reunalla = makeMarker({ id: 'r', distanceByRoute: { 'smtb-55': [25690] } })
    expect(PATKA4.endDist! + RANGE_EPS_M).toBeGreaterThan(25690)
    expect(segmentKm(reunalla, PATKA4)).toBe(25690)
  })

  it('lenkki (V214/B116): pätkän väli VALITSEE ehdokkaan, ei "pienin"', () => {
    // PROD-tapaus: reitti ohittaa merkin 18.85 km (pätkän ULKOPUOLELLA) ja 20.69 km (tällä
    // pätkällä). "Pienin ehdokas" olisi antanut 18.85 ⇒ väärä paikka järjestyksessä.
    const lenkki = prodMarkers.find(m => m.id === 'a')!
    expect(lenkki.distanceByRoute!['smtb-55']).toEqual([18850, 20690])
    expect(segmentKm(lenkki, PATKA4)).toBe(20690)
  })

  it('reititön pätkä (V139) → null, ei kaadu', () => {
    const reititon: Segment = { id: 's', equipment: [], phase: 'asettaminen' }
    expect(segmentKm(prodMarkers[0], reititon)).toBeNull()
  })

  it('legacy-fallback: distanceByRoute puuttuu → skalaari (V212)', () => {
    const legacy = makeMarker({ id: 'leg', distanceFromStart: 22000 })
    expect(segmentKm(legacy, PATKA4)).toBe(22000)
  })
})

describe('orderMarkersInSegment (V238)', () => {
  it('B129-kiinnitys: Pätkä 4 prod-datalla järjestys on akselin mukainen', () => {
    const { onRoute, offRoute } = orderMarkersInSegment([...prodMarkers].reverse(), PATKA4)
    expect(offRoute).toEqual([]) // ∀ 15 prod-merkkiä on pätkällä
    const kms = onRoute.map(m => segmentKm(m, PATKA4)!)
    expect(kms).toEqual([...kms].sort((x, y) => x - y))
    expect(kms[0]).toBe(20690)
    expect(kms[kms.length - 1]).toBe(25690)
    // Merkit joiden skalaari on smtb-30:ltä (0.00/0.03/0.51/0.57) ovat pätkän LOPUSSA, ⊥ alussa
    expect(onRoute.slice(-4).map(m => m.id).sort()).toEqual(['l', 'm', 'n', 'o'])
  })

  it('B129-kiinnitys: skalaarijärjestys nostaisi lopun merkit alkuun (todiste erosta)', () => {
    const skalaari = [...prodMarkers].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    // j/k/n/o (todellinen sijainti 25.18–25.69 km) nousisivat listan kärkeen — tämä oli oire.
    expect(skalaari.slice(0, 4).map(m => m.id).sort()).toEqual(['j', 'k', 'n', 'o'])
  })

  it('purku-phase → käänteinen järjestys (vastasuuntaan ajetaan)', () => {
    const purku: Segment = { ...PATKA4, phase: 'purku' }
    const { onRoute } = orderMarkersInSegment(prodMarkers, purku)
    expect(segmentKm(onRoute[0], purku)).toBe(25690)
    expect(segmentKm(onRoute[onRoute.length - 1], purku)).toBe(20690)
  })

  it('tarkastus-phase järjestää kuten asettaminen (myötäsuuntaan)', () => {
    const tarkastus: Segment = { ...PATKA4, phase: 'tarkastus' }
    const { onRoute } = orderMarkersInSegment(prodMarkers, tarkastus)
    expect(segmentKm(onRoute[0], tarkastus)).toBe(20690)
  })

  it('"ei reitillä" -merkit omaan ryhmäänsä, eivät sekoita järjestystä', () => {
    const orpo = makeMarker({ id: 'orpo', distanceByRoute: { 'smtb-55': [40000] } })
    const { onRoute, offRoute } = orderMarkersInSegment([orpo, ...prodMarkers], PATKA4)
    expect(offRoute.map(m => m.id)).toEqual(['orpo'])
    expect(onRoute.map(m => m.id)).not.toContain('orpo')
    expect(onRoute.length).toBe(prodMarkers.length)
  })

  it('reititön pätkä (V139) → kaikki offRoute, järjestys omalla skalaarilla', () => {
    // Keräyskasa-tehtävällä (T218) ei ole akselia ∴ skalaari on ainoa km joka on olemassa —
    // entinen järjestys säilyy siellä missä pätkä ei voi tarjota parempaa.
    const reititon: Segment = { id: 's', equipment: [], phase: 'asettaminen' }
    const { onRoute, offRoute } = orderMarkersInSegment(prodMarkers, reititon)
    expect(onRoute).toEqual([])
    expect(offRoute.map(m => m.distanceFromStart)).toEqual(
      [...prodMarkers].map(m => m.distanceFromStart).sort((a, b) => a - b),
    )
  })

  it('segment null → kaikki offRoute, ei kaadu', () => {
    const { onRoute, offRoute } = orderMarkersInSegment(prodMarkers, null)
    expect(onRoute).toEqual([])
    expect(offRoute.length).toBe(prodMarkers.length)
  })

  it('REGRESSIO: muuttumaton pätkä (kaikki merkit oikealla akselilla) säilyttää järjestyksen', () => {
    // 5/9 prod-pätkää oli jo oikein — korjaus ei saa muuttaa niitä (T327-kuvio).
    const puhtaat = PROD.filter(p => !p.c30 && p.c55.length === 1).map(p => makeMarker({
      id: p.id, distanceFromStart: p.skalaari, distanceByRoute: { 'smtb-55': p.c55 },
    }))
    const skalaarijarjestys = [...puhtaat].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    const { onRoute } = orderMarkersInSegment(puhtaat, PATKA4)
    expect(onRoute.map(m => m.id)).toEqual(skalaarijarjestys.map(m => m.id))
  })
})

describe('displayKm (B129)', () => {
  it('näyttää pätkän akselin km:n, ei skalaaria', () => {
    const jaettu = prodMarkers.find(m => m.id === 'm')!
    expect(displayKm(jaettu, PATKA4)).toBe(25650)
    expect((displayKm(jaettu, PATKA4) / 1000).toFixed(1)).not.toBe('0.6') // oire oli tämä
    expect((jaettu.distanceFromStart / 1000).toFixed(1)).toBe('0.6')     // skalaari valehteli
  })

  it('hero ▶ -selailu: lukema kasvaa monotonisesti koko pätkän läpi', () => {
    const { onRoute } = orderMarkersInSegment(prodMarkers, PATKA4)
    const kms = onRoute.map(m => displayKm(m, PATKA4))
    for (let i = 1; i < kms.length; i++) expect(kms[i]).toBeGreaterThanOrEqual(kms[i - 1])
    // B129-oire oli juuri tämä: 25.1 → 0.0 → 0.0 → 25.6 → 0.6
    expect(kms.some((km, i) => i > 0 && km < kms[i - 1])).toBe(false)
  })

  it('ei-reitillä-merkki putoaa omaan skalaariinsa (ei heitä, ei valehtele nollaa)', () => {
    const orpo = makeMarker({ id: 'orpo', distanceFromStart: 40000, distanceByRoute: { 'smtb-55': [40000] } })
    expect(displayKm(orpo, PATKA4)).toBe(40000)
  })
})
