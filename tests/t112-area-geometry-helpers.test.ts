import { describe, it, expect } from 'vitest'
import {
  cornersFromRect,
  cornersToRect,
  latLngToLocal,
  localToLatLng,
} from '../src/logic/area-geometry'

const CENTER_LAT = 65.0  // Syöte-alue, ~65°N
const CENTER_LNG = 28.0

describe('T112 — cornersToRect (V66)', () => {
  it('roundtrip cornersFromRect → corners[NW,SE] → cornersToRect ±1m', () => {
    const widthM = 120
    const heightM = 80
    const corners = cornersFromRect(CENTER_LAT, CENTER_LNG, widthM, heightM, 0)
    // NW = corners[0], SE = corners[2] — opposite corners
    const rect = cornersToRect(corners[0], corners[2])
    expect(rect.centerLat).toBeCloseTo(CENTER_LAT, 5)
    expect(rect.centerLng).toBeCloseTo(CENTER_LNG, 5)
    // widthM/heightM roundtrip within 1m
    expect(Math.abs(rect.widthM - widthM)).toBeLessThan(1)
    expect(Math.abs(rect.heightM - heightM)).toBeLessThan(1)
  })

  it('centerLat/centerLng = midpoint of two corners', () => {
    const a = { lat: 65.001, lng: 28.001 }
    const b = { lat: 65.003, lng: 28.005 }
    const rect = cornersToRect(a, b)
    expect(rect.centerLat).toBeCloseTo(65.002, 6)
    expect(rect.centerLng).toBeCloseTo(28.003, 6)
  })

  it('widthM proportional to lng delta', () => {
    const a = { lat: CENTER_LAT, lng: 28.000 }
    const b = { lat: CENTER_LAT, lng: 28.010 }
    const rect = cornersToRect(a, b)
    // 0.01° lng at 65°N ≈ 111320 * cos(65°) * 0.01 ≈ 470m
    expect(rect.widthM).toBeGreaterThan(400)
    expect(rect.widthM).toBeLessThan(550)
    expect(rect.heightM).toBe(1)  // clamped to min 1m
  })

  it('heightM proportional to lat delta', () => {
    const a = { lat: 65.000, lng: CENTER_LNG }
    const b = { lat: 65.010, lng: CENTER_LNG }
    const rect = cornersToRect(a, b)
    // 0.01° lat ≈ 111320 * 0.01 ≈ 1113m
    expect(rect.heightM).toBeGreaterThan(1100)
    expect(rect.heightM).toBeLessThan(1130)
    expect(rect.widthM).toBe(1)  // clamped
  })

  it('handles reversed corner order (drag any direction)', () => {
    const a = { lat: 65.003, lng: 28.005 }
    const b = { lat: 65.001, lng: 28.001 }
    const rect = cornersToRect(a, b)
    expect(rect.widthM).toBeGreaterThan(0)
    expect(rect.heightM).toBeGreaterThan(0)
    expect(rect.centerLat).toBeCloseTo(65.002, 6)
  })
})

describe('T112 — latLngToLocal + localToLatLng roundtrip (V66)', () => {
  it('local → latLng roundtrip ±0.01m', () => {
    const uM = 50
    const vM = -30
    const pt = localToLatLng(uM, vM, CENTER_LAT, CENTER_LNG)
    const back = latLngToLocal(pt.lat, pt.lng, CENTER_LAT, CENTER_LNG)
    expect(Math.abs(back.uM - uM)).toBeLessThan(0.01)
    expect(Math.abs(back.vM - vM)).toBeLessThan(0.01)
  })

  it('latLng → local roundtrip ±0.01m', () => {
    const lat = 65.001
    const lng = 28.005
    const local = latLngToLocal(lat, lng, CENTER_LAT, CENTER_LNG)
    const back = localToLatLng(local.uM, local.vM, CENTER_LAT, CENTER_LNG)
    expect(back.lat).toBeCloseTo(lat, 6)
    expect(back.lng).toBeCloseTo(lng, 6)
  })

  it('center point → uM=0, vM=0', () => {
    const local = latLngToLocal(CENTER_LAT, CENTER_LNG, CENTER_LAT, CENTER_LNG)
    expect(local.uM).toBeCloseTo(0, 8)
    expect(local.vM).toBeCloseTo(0, 8)
  })

  it('north offset → positive vM', () => {
    const local = latLngToLocal(CENTER_LAT + 0.001, CENTER_LNG, CENTER_LAT, CENTER_LNG)
    expect(local.vM).toBeGreaterThan(0)
    expect(local.uM).toBeCloseTo(0, 5)
  })

  it('east offset → positive uM', () => {
    const local = latLngToLocal(CENTER_LAT, CENTER_LNG + 0.001, CENTER_LAT, CENTER_LNG)
    expect(local.uM).toBeGreaterThan(0)
    expect(local.vM).toBeCloseTo(0, 5)
  })

  it('aspect ratio: same degree delta, uM < vM at 65°N (lng compressed)', () => {
    const delta = 0.01
    const localLng = latLngToLocal(CENTER_LAT, CENTER_LNG + delta, CENTER_LAT, CENTER_LNG)
    const localLat = latLngToLocal(CENTER_LAT + delta, CENTER_LNG, CENTER_LAT, CENTER_LNG)
    // At 65°N, cos(65°) ≈ 0.42, so east meters << north meters for same degree
    expect(localLng.uM).toBeLessThan(localLat.vM)
  })
})
