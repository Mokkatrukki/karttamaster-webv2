import { describe, it, expect } from 'vitest'
import { nearestUnsetMarker, distanceToNext, firstUnsetMarker, unsetMarkersOrdered, stepUnset, nextMarkerAhead } from '../src/logic/navigation'
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
