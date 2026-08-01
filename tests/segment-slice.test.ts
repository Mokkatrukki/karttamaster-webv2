/**
 * T464/V353 — pätkän piirrettävä geometria & rajan rako.
 *
 * Rako on V353:n toinen kanava: väri pettää värisokealle & himmennetyssä kontekstissa ∴ rajan
 * ! näkyä myös geometriana. Rajatapaukset (lyhyt pätkä, harva GPX) ovat juuri niitä joita
 * Playwright ⊥ näe — tuotantoreitillä ⊥ ole sellaista syötettä.
 */
import { describe, it, expect } from 'vitest'
import { sliceRoutePoints, insetRoutePoints, SEGMENT_END_GAP_M } from '../src/logic/segment-slice'
import type { RoutePoint } from '../src/logic/types'

/** Tiheä reitti: piste joka 10 m. */
const dense = (max: number, step = 10): RoutePoint[] =>
  Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => ({
    lat: 65.6 + i * 1e-4, lon: 27.6, distanceFromStart: i * step,
  }))

describe('sliceRoutePoints (V258/V260)', () => {
  const pts = dense(1000)

  it('molemmat rajat mukaan lukien — jaettu raja kuuluu kumpaankin pätkään', () => {
    const s = sliceRoutePoints(pts, 100, 200)
    expect(s.length).toBe(11)
    expect(s[0]).toEqual([pts[10].lat, pts[10].lon])
    expect(s[s.length - 1]).toEqual([pts[20].lat, pts[20].lon])
  })

  it('välin ulkopuolinen väli → tyhjä (⊥ heitä)', () => {
    expect(sliceRoutePoints(pts, 5000, 6000)).toEqual([])
  })
})

describe('insetRoutePoints (V353)', () => {
  it('lyhentää molemmista päistä ∴ vierekkäiset pätkät ⊥ kosketa toisiaan', () => {
    const pts = dense(2000)
    const a = insetRoutePoints(pts, 0, 1000)
    const b = insetRoutePoints(pts, 1000, 2000)

    // A päättyy ENNEN jaettua rajaa & B alkaa VASTA sen jälkeen ⇒ väliin jää rako.
    const aEnd = a[a.length - 1]
    const bStart = b[0]
    expect(aEnd).not.toEqual(bStart)

    // Rako on molemminpuolinen ∴ ≥ 1 kokonainen pistevali kummallakin puolella rajaa.
    const full = sliceRoutePoints(pts, 0, 1000)
    expect(a.length).toBeLessThan(full.length)
  })

  it('rako on molemmissa päissä, ⊥ vain toisessa', () => {
    const pts = dense(2000)
    const full = sliceRoutePoints(pts, 500, 1500)
    const inset = insetRoutePoints(pts, 500, 1500)
    expect(inset[0]).not.toEqual(full[0])
    expect(inset[inset.length - 1]).not.toEqual(full[full.length - 1])
  })

  it('lyhyt pätkä (≤ 4 × rako) piirtyy ILMAN rakoa — rako söisi siitä merkittävän osan', () => {
    const pts = dense(200, 1)
    const len = SEGMENT_END_GAP_M * 4
    const inset = insetRoutePoints(pts, 0, len)
    expect(inset).toEqual(sliceRoutePoints(pts, 0, len))
  })

  it('harva GPX: kavennettu siivu < 2 pistettä → peruuta täyteen siivuun', () => {
    // Kaksi pistettä 1000 m välein: kavennus [12, 988] ei osu kumpaankaan ⇒ tyhjä.
    const sparse: RoutePoint[] = [
      { lat: 65.6, lon: 27.6, distanceFromStart: 0 },
      { lat: 65.7, lon: 27.6, distanceFromStart: 1000 },
    ]
    const inset = insetRoutePoints(sparse, 0, 1000)
    // Näkyvä väärä raja on parempi kuin näkymätön pätkä.
    expect(inset.length).toBe(2)
    expect(inset).toEqual(sliceRoutePoints(sparse, 0, 1000))
  })

  it('kavennus ⊥ koskaan pudota pätkää piirtokelvottomaksi (<2 pistettä)', () => {
    const pts = dense(3000)
    for (const [s, e] of [[0, 30], [0, 49], [0, 50], [100, 160], [0, 3000]] as [number, number][]) {
      expect(insetRoutePoints(pts, s, e).length).toBeGreaterThanOrEqual(2)
    }
  })
})
