import { describe, it, expect } from 'vitest'
import { cornersFromRect, rotatePoint, type LatLng } from '../src/logic/area-geometry'

const CENTER_LAT = 63.0
const CENTER_LNG = 28.0
const DEG_PER_M_LAT = 1 / 111320

function latToM(dLat: number): number {
  return dLat * 111320
}

function lngToM(dLng: number, lat: number): number {
  return dLng * 111320 * Math.cos((lat * Math.PI) / 180)
}

function distM(a: LatLng, b: LatLng): number {
  const dy = latToM(b.lat - a.lat)
  const dx = lngToM(b.lng - a.lng, a.lat)
  return Math.sqrt(dy * dy + dx * dx)
}

const CENTER: LatLng = { lat: CENTER_LAT, lng: CENTER_LNG }

describe('cornersFromRect — 0° rotaatio', () => {
  it('100×50m: pohjoinen pari ~50m pohjoiseen centeristä', () => {
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 0)
    // NW ja NE ovat indeksit 0 ja 1 — ne ovat hh=25m pohjoiseen
    const nLat = CENTER_LAT + 25 * DEG_PER_M_LAT
    expect(corners[0].lat).toBeCloseTo(nLat, 8)
    expect(corners[1].lat).toBeCloseTo(nLat, 8)
  })

  it('100×50m: eteläinen pari ~25m eteläiseen centeristä', () => {
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 0)
    // SE(2) ja SW(3) — hh=25m eteläiseen
    const sLat = CENTER_LAT - 25 * DEG_PER_M_LAT
    expect(corners[2].lat).toBeCloseTo(sLat, 8)
    expect(corners[3].lat).toBeCloseTo(sLat, 8)
  })

  it('palauttaa 4 nurkkaa', () => {
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 0)
    expect(corners).toHaveLength(4)
  })
})

describe('cornersFromRect — 90° rotaatio', () => {
  it('90° vaihtaa leveys/korkeus-suunnat', () => {
    // 100×50m 0°: NW(0)-NE(1)-SE(2)-SW(3)
    // 0°: N-S span (NW vs SW) = heightM = 50m, E-W span (NW vs NE) = widthM = 100m
    // 90°: rect kääntyy — N-S span kasvaa widthM:ksi (100m), E-W span pienenee heightM:ksi (50m)
    const c90 = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 90)

    // Kokonais N-S span: korkein lat - matalin lat kaikista neljästä nurkasta
    const lats = c90.map(c => c.lat)
    const nsSpan = latToM(Math.max(...lats) - Math.min(...lats))
    // Pitäisi olla ~widthM = 100m (hyväksytään ±5% approx)
    expect(nsSpan).toBeCloseTo(100, -1)

    // Kokonais E-W span kaikista neljästä nurkasta
    const lngs = c90.map(c => c.lng)
    const ewSpan = lngToM(Math.max(...lngs) - Math.min(...lngs), CENTER_LAT)
    // Pitäisi olla ~heightM = 50m
    expect(ewSpan).toBeCloseTo(50, -1)
  })
})

describe('cornersFromRect — nurkkien etäisyys centeristä', () => {
  it('kaikki 4 nurkkaa yhtä kaukana centeristä 0° rotaatiolla', () => {
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 0)
    const dists = corners.map(c => distM(CENTER, c))
    const d0 = dists[0]
    for (const d of dists) {
      expect(d).toBeCloseTo(d0, 0)
    }
  })

  it('etäisyys centeristä pysyy vakiona rotaatiosta riippumatta', () => {
    const r0 = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 0)
    const r45 = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 45)
    const r90 = cornersFromRect(CENTER_LAT, CENTER_LNG, 100, 50, 90)

    const d0 = r0.map(c => distM(CENTER, c))
    const d45 = r45.map(c => distM(CENTER, c))
    const d90 = r90.map(c => distM(CENTER, c))

    // Jokaisen rotaation jokainen nurkka ~sama etäisyys kuin 0°:ssa
    const expected = d0[0]
    for (const d of [...d45, ...d90]) {
      expect(d).toBeCloseTo(expected, 0)
    }
  })

  it('etäisyys = sqrt((widthM/2)² + (heightM/2)²)', () => {
    const w = 100, h = 50
    const expected = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2)
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, w, h, 0)
    for (const c of corners) {
      expect(distM(CENTER, c)).toBeCloseTo(expected, 0)
    }
  })
})

describe('rotatePoint', () => {
  it('0° ei muuta pistettä', () => {
    const p: LatLng = { lat: CENTER_LAT + 0.001, lng: CENTER_LNG + 0.001 }
    const r = rotatePoint(p.lat, p.lng, CENTER_LAT, CENTER_LNG, 0)
    expect(r.lat).toBeCloseTo(p.lat, 8)
    expect(r.lng).toBeCloseTo(p.lng, 8)
  })

  it('360° palaa alkuperäiseen', () => {
    const p: LatLng = { lat: CENTER_LAT + 0.002, lng: CENTER_LNG + 0.001 }
    const r = rotatePoint(p.lat, p.lng, CENTER_LAT, CENTER_LNG, 360)
    expect(r.lat).toBeCloseTo(p.lat, 6)
    expect(r.lng).toBeCloseTo(p.lng, 6)
  })

  it('180° peilaa pisteen centerin yli', () => {
    const offset = 0.001
    const p: LatLng = { lat: CENTER_LAT + offset, lng: CENTER_LNG }
    const r = rotatePoint(p.lat, p.lng, CENTER_LAT, CENTER_LNG, 180)
    // 180° pitäisi viedä pohjoiseen menevä piste eteläiseen
    expect(r.lat).toBeCloseTo(CENTER_LAT - offset, 5)
    expect(r.lng).toBeCloseTo(CENTER_LNG, 5)
  })

  it('etäisyys centeristä säilyy rotaatiossa', () => {
    const p: LatLng = { lat: CENTER_LAT + 0.002, lng: CENTER_LNG + 0.001 }
    const d0 = distM(CENTER, p)
    for (const angle of [30, 45, 90, 135, 270]) {
      const r = rotatePoint(p.lat, p.lng, CENTER_LAT, CENTER_LNG, angle)
      expect(distM(CENTER, r)).toBeCloseTo(d0, 0)
    }
  })
})
