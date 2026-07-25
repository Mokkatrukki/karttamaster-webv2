import { describe, it, expect } from 'vitest'
import { nearestUnsetMarker, distanceToNext, firstUnsetMarker, unsetMarkersOrdered, stepUnset, nextMarkerAhead, distanceAhead } from '../src/logic/navigation'
import type { SignMarker } from '../src/logic/types'

function makeMarker(overrides: Partial<SignMarker>): SignMarker {
  return {
    id: 'test-id',
    type: 'right',
    lat: 0, lon: 0,
    distanceFromStart: 0,
    routeIds: ['r1'],
    status: 'suunniteltu',
    ...overrides,
  }
}

const m1 = makeMarker({ id: 'm1', distanceFromStart: 100, routeIds: ['r1'] })
const m2 = makeMarker({ id: 'm2', distanceFromStart: 300, routeIds: ['r1'] })
const m3 = makeMarker({ id: 'm3', distanceFromStart: 500, routeIds: ['r1'], status: 'asetettu' })
const m4 = makeMarker({ id: 'm4', distanceFromStart: 200, routeIds: ['r2'] })

describe('nearestUnsetMarker', () => {
  it('palauttaa lähimmän suunniteltu-merkin', () => {
    const result = nearestUnsetMarker([m1, m2, m3], 250, 'r1')
    expect(result?.id).toBe('m2')
  })

  it('ohittaa asetettu/ei-suunniteltu statukset', () => {
    const result = nearestUnsetMarker([m3], 500, 'r1')
    expect(result).toBeNull()
  })

  it('ohittaa väärän reitin merkit', () => {
    const result = nearestUnsetMarker([m4], 200, 'r1')
    expect(result).toBeNull()
  })

  it('palauttaa null kun lista tyhjä', () => {
    expect(nearestUnsetMarker([], 0, 'r1')).toBeNull()
  })

  it('toimii kun currentDist on ennen ensimmäistä merkkiä', () => {
    const result = nearestUnsetMarker([m1, m2], 0, 'r1')
    expect(result?.id).toBe('m1')
  })

  it('toimii kun currentDist on jälkeen viimeisen merkin', () => {
    const result = nearestUnsetMarker([m1, m2], 1000, 'r1')
    expect(result?.id).toBe('m2')
  })

  it('yksi merkki — palauttaa se aina (V9)', () => {
    expect(nearestUnsetMarker([m1], 999, 'r1')?.id).toBe('m1')
  })

  it('tasa-arvo — palauttaa ensimmäisen kandidaatin', () => {
    const a = makeMarker({ id: 'a', distanceFromStart: 100, routeIds: ['r1'] })
    const b = makeMarker({ id: 'b', distanceFromStart: 100, routeIds: ['r1'] })
    const result = nearestUnsetMarker([a, b], 100, 'r1')
    expect(['a', 'b']).toContain(result?.id)
  })
})

// B-lista2/V3: pätkän ensimmäinen asettamaton merkki — pienin distanceFromStart, EI lähin kursoriin.
describe('firstUnsetMarker', () => {
  it('palauttaa pienimmän distanceFromStart -suunniteltu-merkin (ei lähintä kursoriin)', () => {
    // m1=100, m2=300 — kummatkin suunniteltu; ensimmäinen = m1 riippumatta järjestyksestä
    expect(firstUnsetMarker([m2, m1])?.id).toBe('m1')
  })

  it('ohittaa ei-suunniteltu-merkit', () => {
    // m3 (500, asetettu) ohitetaan; m2 (300, suunniteltu) valitaan
    expect(firstUnsetMarker([m3, m2])?.id).toBe('m2')
  })

  it('palauttaa null kun ei suunniteltu-merkkejä', () => {
    expect(firstUnsetMarker([m3])).toBeNull()
    expect(firstUnsetMarker([])).toBeNull()
  })

  it('valitsee aina saman ensimmäisen syötejärjestyksestä riippumatta', () => {
    const early = makeMarker({ id: 'early', distanceFromStart: 50 })
    const late = makeMarker({ id: 'late', distanceFromStart: 900 })
    expect(firstUnsetMarker([late, early])?.id).toBe('early')
    expect(firstUnsetMarker([early, late])?.id).toBe('early')
  })
})

// T231/V159: hero-◀▶-selailu asettamattomien merkkien välillä.
describe('unsetMarkersOrdered', () => {
  it('palauttaa vain suunniteltu-merkit km-järjestyksessä (asc)', () => {
    const ids = unsetMarkersOrdered([m2, m1, m3]).map(m => m.id) // m3=asetettu tippuu
    expect(ids).toEqual(['m1', 'm2'])
  })

  it('tyhjä lista → tyhjä', () => {
    expect(unsetMarkersOrdered([])).toEqual([])
  })

  it('kaikki asetettu → tyhjä', () => {
    expect(unsetMarkersOrdered([m3])).toEqual([])
  })

  it('ei mutatoi syötteen järjestystä', () => {
    const input = [m2, m1]
    unsetMarkersOrdered(input)
    expect(input.map(m => m.id)).toEqual(['m2', 'm1'])
  })
})

describe('stepUnset', () => {
  // ordered = [m1(100), m2(300)]
  it('dir=1 seuraava asettamaton', () => {
    expect(stepUnset([m1, m2, m3], 'm1', 1)?.id).toBe('m2')
  })

  it('dir=-1 edellinen asettamaton', () => {
    expect(stepUnset([m1, m2, m3], 'm2', -1)?.id).toBe('m1')
  })

  it('clamp: viimeisestä eteen → viimeinen (ei wrap)', () => {
    expect(stepUnset([m1, m2], 'm2', 1)?.id).toBe('m2')
  })

  it('clamp: ensimmäisestä taakse → ensimmäinen (ei wrap)', () => {
    expect(stepUnset([m1, m2], 'm1', -1)?.id).toBe('m1')
  })

  it('tuntematon id → firstUnsetMarker (ensimmäinen asettamaton)', () => {
    expect(stepUnset([m2, m1], 'ei-ole', 1)?.id).toBe('m1')
  })

  it('jo-asetettu id (katosi listalta) → firstUnsetMarker (reconcile V159)', () => {
    expect(stepUnset([m1, m2, m3], 'm3', 1)?.id).toBe('m1')
  })

  it('tyhjä lista → null', () => {
    expect(stepUnset([], 'm1', 1)).toBeNull()
  })

  it('kaikki asetettu → null', () => {
    expect(stepUnset([m3], 'm3', 1)).toBeNull()
  })
})

// T39: drive-mode "hyppää seuraavaan merkkiin" — seuraava merkki edessäpäin aktiivisella reitillä.
describe('nextMarkerAhead', () => {
  it('palauttaa seuraavan merkin edessäpäin (pienin distanceFromStart > currentDist)', () => {
    // m1=100, m2=300; currentDist=150 → m2
    expect(nextMarkerAhead([m1, m2], 150, 'r1')?.id).toBe('m2')
  })

  it('ennen ensimmäistä merkkiä → ensimmäinen', () => {
    expect(nextMarkerAhead([m2, m1], 0, 'r1')?.id).toBe('m1')
  })

  it('strict >: seisoo tarkalleen merkin kohdalla → seuraava, ei sama (etenee)', () => {
    // currentDist=100 (m1:n kohta) → ei m1 vaan m2
    expect(nextMarkerAhead([m1, m2], 100, 'r1')?.id).toBe('m2')
  })

  it('ottaa mukaan kaikki statukset (myös asetettu)', () => {
    // m3=500 asetettu; currentDist=350 → m3 (drive tarkastaa myös asetetut)
    expect(nextMarkerAhead([m1, m2, m3], 350, 'r1')?.id).toBe('m3')
  })

  it('ohittaa väärän reitin merkit', () => {
    // m4=200 kuuluu r2:lle → ei valita r1:llä
    expect(nextMarkerAhead([m4], 0, 'r1')).toBeNull()
  })

  it('viimeisen merkin jälkeen → null (kursori jää paikalleen)', () => {
    expect(nextMarkerAhead([m1, m2], 1000, 'r1')).toBeNull()
  })

  it('tyhjä lista → null', () => {
    expect(nextMarkerAhead([], 0, 'r1')).toBeNull()
  })

  it('multi-route: merkki jaetulla reitillä valitaan aktiivisen reitin id:llä', () => {
    const shared = makeMarker({ id: 'shared', distanceFromStart: 250, routeIds: ['r1', 'r2'] })
    expect(nextMarkerAhead([shared], 0, 'r1')?.id).toBe('shared')
    expect(nextMarkerAhead([shared], 0, 'r2')?.id).toBe('shared')
  })
})

// T327/V235/B126: järjestysavain = ANNETUN reitin km (distanceByRoute), ei merkin skalaari.
// Prod-todiste 2026-07-25: Pätkä 4 (smtb-55, 20.68–25.65 km) — kolme merkkiä oli mitattu
// smtb-30:ltä (4.6 km pitkä) → skalaari 0.00/0.03/0.57 km vaikka todellinen sijainti pätkän
// LOPUSSA 25.18/25.21/25.65 km. Nykyjärjestys nosti pätkän viimeiset merkit ensimmäisiksi.
describe('V235 km-akseli (B126)', () => {
  // "oikea" @ smtb-55 km 21.0 — akseli oikein
  const alku = makeMarker({
    id: 'alku', distanceFromStart: 21000, routeIds: ['smtb-55'],
    distanceByRoute: { 'smtb-55': [21000] },
  })
  // "30km only irtokyltti" @ smtb-55 km 25.65, mutta skalaari mitattu smtb-30:ltä (570 m)
  const loppu = makeMarker({
    id: 'loppu', distanceFromStart: 570, routeIds: ['smtb-55', 'smtb-30'],
    distanceByRoute: { 'smtb-55': [25650], 'smtb-30': [570] },
  })

  it('väärältä reitiltä mitattu merkki menee LOPPUUN, ei alkuun', () => {
    expect(unsetMarkersOrdered([loppu, alku], 'smtb-55').map(m => m.id)).toEqual(['alku', 'loppu'])
  })

  it('firstUnsetMarker valitsee pätkän alun, ei pienimmän skalaarin', () => {
    expect(firstUnsetMarker([loppu, alku], 'smtb-55')?.id).toBe('alku')
    // Ilman akselia entinen (rikkinäinen) käytös — todistaa että ero tulee nimenomaan akselista
    expect(firstUnsetMarker([loppu, alku])?.id).toBe('loppu')
  })

  it('stepUnset selaa samassa järjestyksessä kuin lista', () => {
    expect(stepUnset([loppu, alku], 'alku', 1, 'smtb-55')?.id).toBe('loppu')
    expect(stepUnset([loppu, alku], 'loppu', -1, 'smtb-55')?.id).toBe('alku')
  })

  it('nextMarkerAhead lukee km:n aktiiviselta reitiltä', () => {
    // 22 km kohdalla edessä on vain loppu (25.65) — ei alku (21.0)
    expect(nextMarkerAhead([alku, loppu], 22000, 'smtb-55')?.id).toBe('loppu')
    // Skalaarilla loppu näyttäisi olevan 570 m ∴ takana → vanha koodi palautti null
    expect(nextMarkerAhead([alku, loppu], 22000, 'smtb-55')).not.toBeNull()
  })

  it('distanceAhead antaa kursorille reitin km:n, ei skalaaria', () => {
    expect(distanceAhead([alku, loppu], 22000, 'smtb-55')).toBe(25650)
    expect(distanceAhead([alku, loppu], 30000, 'smtb-55')).toBeNull()
  })

  it('eri akseli → eri järjestys (sama data, smtb-30 näkökulmasta)', () => {
    const m30 = makeMarker({
      id: 'm30', distanceFromStart: 2000, routeIds: ['smtb-30'],
      distanceByRoute: { 'smtb-30': [2000] },
    })
    expect(unsetMarkersOrdered([m30, loppu], 'smtb-30').map(m => m.id)).toEqual(['loppu', 'm30'])
  })

  it('legacy-fallback: distanceByRoute puuttuu → skalaari, käytös ennallaan (V212)', () => {
    // m1=100, m2=300 ilman distanceByRoutea — akseli annettu mutta dataa ei ole
    expect(unsetMarkersOrdered([m2, m1], 'r1').map(m => m.id)).toEqual(['m1', 'm2'])
    expect(firstUnsetMarker([m2, m1], 'r1')?.id).toBe('m1')
  })

  it('lenkki: usea km-ehdokas samalla reitillä → pienin järjestää (V214)', () => {
    const lenkki = makeMarker({
      id: 'lenkki', distanceFromStart: 40000, routeIds: ['smtb-55'],
      distanceByRoute: { 'smtb-55': [40000, 12000] },
    })
    // 12 km -ehdokas on pienin ∴ lenkki ennen alkua (21 km)
    expect(unsetMarkersOrdered([alku, lenkki], 'smtb-55').map(m => m.id)).toEqual(['lenkki', 'alku'])
    // ...ja edessäpäin 15 km:ssä osuu 40 km -ehdokkaaseen
    expect(distanceAhead([lenkki], 15000, 'smtb-55')).toBe(40000)
  })

  it('nearestUnsetMarker mittaa etäisyyden akselilta', () => {
    expect(nearestUnsetMarker([alku, loppu], 25000, 'smtb-55')?.id).toBe('loppu')
    expect(distanceToNext([alku, loppu], 25000, 'smtb-55')).toBe(650)
  })
})

describe('distanceToNext', () => {
  it('palauttaa etäisyyden metreinä lähimpään suunniteltu-merkkiin', () => {
    expect(distanceToNext([m1, m2], 0, 'r1')).toBe(100)
  })

  it('palauttaa null jos ei suunniteltu-merkkejä reitillä', () => {
    expect(distanceToNext([m3], 0, 'r1')).toBeNull()
  })

  it('etäisyys on absoluuttinen — toimii myös taaksepäin', () => {
    expect(distanceToNext([m1], 200, 'r1')).toBe(100)
  })

  it('nolla-etäisyys kun currentDist === merkin distanceFromStart', () => {
    expect(distanceToNext([m1], 100, 'r1')).toBe(0)
  })

  it('palauttaa null kun markers tyhjä', () => {
    expect(distanceToNext([], 0, 'r1')).toBeNull()
  })
})
