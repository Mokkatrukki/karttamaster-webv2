import { describe, it, expect } from 'vitest'
import { cornersFromRect, latLngToLocal, rotateLocal } from '../src/logic/area-geometry'

const CENTER_LAT = 65.0
const CENTER_LNG = 28.0
const ARM_OFFSET_M = 20

function meterDist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 111320
  const dx = (a.lng - b.lng) * 111320 * Math.cos(CENTER_LAT * Math.PI / 180)
  return Math.sqrt(dx * dx + dy * dy)
}

// Pure math equivalent of rotationArmTip (no Leaflet)
function armTipLocal(rotation: number): { uM: number; vM: number } {
  return rotateLocal(0, ARM_OFFSET_M, rotation)
}

// Pure math equivalent of onCornerDrag (no Leaflet)
function dragCorner(
  rect: { centerLat: number; centerLng: number; widthM: number; heightM: number; rotation: number },
  draggedIndex: number,
  newDragged: { lat: number; lng: number },
) {
  const corners = cornersFromRect(rect.centerLat, rect.centerLng, rect.widthM, rect.heightM, rect.rotation)
  const oppIndex = (draggedIndex + 2) % 4
  const opp = corners[oppIndex]

  const centerLat = (newDragged.lat + opp.lat) / 2
  const centerLng = (newDragged.lng + opp.lng) / 2

  const local = latLngToLocal(newDragged.lat, newDragged.lng, centerLat, centerLng)
  const frame = rotateLocal(local.uM, local.vM, -rect.rotation)

  return {
    centerLat,
    centerLng,
    widthM: Math.max(2 * Math.abs(frame.uM), 1),
    heightM: Math.max(2 * Math.abs(frame.vM), 1),
    rotation: rect.rotation,
  }
}

describe('T117 — V70: rotationArmTip CW convention', () => {
  it('rotation=0° → arm North (vM=+20, uM≈0)', () => {
    const { uM, vM } = armTipLocal(0)
    expect(uM).toBeCloseTo(0, 6)
    expect(vM).toBeCloseTo(ARM_OFFSET_M, 6)
  })

  it('rotation=90° → arm East (uM=+20, vM≈0)', () => {
    const { uM, vM } = armTipLocal(90)
    expect(uM).toBeCloseTo(ARM_OFFSET_M, 5)
    expect(vM).toBeCloseTo(0, 5)
  })

  it('rotation=180° → arm South (vM=-20, uM≈0)', () => {
    const { uM, vM } = armTipLocal(180)
    expect(uM).toBeCloseTo(0, 3)
    expect(vM).toBeCloseTo(-ARM_OFFSET_M, 3)
  })

  it('rotation=270° → arm West (uM=-20, vM≈0)', () => {
    const { uM, vM } = armTipLocal(270)
    expect(uM).toBeCloseTo(-ARM_OFFSET_M, 3)
    expect(vM).toBeCloseTo(0, 3)
  })

  it('arm distance from center stays constant at any rotation', () => {
    for (const rot of [0, 30, 45, 90, 135, 180, 225, 270]) {
      const { uM, vM } = armTipLocal(rot)
      const dist = Math.sqrt(uM * uM + vM * vM)
      expect(dist).toBeCloseTo(ARM_OFFSET_M, 5)
    }
  })
})

describe('T117 — V71: corner drag locks opposite corner ±1m', () => {
  const base = { centerLat: CENTER_LAT, centerLng: CENTER_LNG, widthM: 100, heightM: 60, rotation: 0 }

  it('rotation=0°: drag corner 0 (NW), corner 2 (SE) stays fixed', () => {
    const corners = cornersFromRect(base.centerLat, base.centerLng, base.widthM, base.heightM, base.rotation)
    const oppBefore = corners[2]
    const newDrag = { lat: corners[0].lat + 0.0003, lng: corners[0].lng - 0.0002 }
    const newRect = dragCorner(base, 0, newDrag)
    const newCorners = cornersFromRect(newRect.centerLat, newRect.centerLng, newRect.widthM, newRect.heightM, newRect.rotation)
    expect(meterDist(newCorners[2], oppBefore)).toBeLessThan(1)
  })

  it('rotation=0°: drag corner 1 (NE), corner 3 (SW) stays fixed', () => {
    const corners = cornersFromRect(base.centerLat, base.centerLng, base.widthM, base.heightM, base.rotation)
    const oppBefore = corners[3]
    const newDrag = { lat: corners[1].lat + 0.0002, lng: corners[1].lng + 0.0003 }
    const newRect = dragCorner(base, 1, newDrag)
    const newCorners = cornersFromRect(newRect.centerLat, newRect.centerLng, newRect.widthM, newRect.heightM, newRect.rotation)
    expect(meterDist(newCorners[3], oppBefore)).toBeLessThan(1)
  })

  it('rotation=90°: drag corner 0, corner 2 stays fixed', () => {
    const rect90 = { ...base, rotation: 90 }
    const corners = cornersFromRect(rect90.centerLat, rect90.centerLng, rect90.widthM, rect90.heightM, rect90.rotation)
    const oppBefore = corners[2]
    const newDrag = { lat: corners[0].lat + 0.0003, lng: corners[0].lng }
    const newRect = dragCorner(rect90, 0, newDrag)
    const newCorners = cornersFromRect(newRect.centerLat, newRect.centerLng, newRect.widthM, newRect.heightM, newRect.rotation)
    expect(meterDist(newCorners[2], oppBefore)).toBeLessThan(1)
  })

  it('rotation=45°: drag corner 0, corner 2 stays fixed', () => {
    const rect45 = { ...base, rotation: 45 }
    const corners = cornersFromRect(rect45.centerLat, rect45.centerLng, rect45.widthM, rect45.heightM, rect45.rotation)
    const oppBefore = corners[2]
    const newDrag = { lat: corners[0].lat + 0.0002, lng: corners[0].lng + 0.0002 }
    const newRect = dragCorner(rect45, 0, newDrag)
    const newCorners = cornersFromRect(newRect.centerLat, newRect.centerLng, newRect.widthM, newRect.heightM, newRect.rotation)
    expect(meterDist(newCorners[2], oppBefore)).toBeLessThan(1)
  })
})

describe('T117 — rotateLocal (V70, V71 apufunktio)', () => {
  it('rotation=0 → identity', () => {
    const r = rotateLocal(3, 4, 0)
    expect(r.uM).toBeCloseTo(3, 8)
    expect(r.vM).toBeCloseTo(4, 8)
  })

  it('North (0,1) rotated 90° CW → East (1,0)', () => {
    const r = rotateLocal(0, 1, 90)
    expect(r.uM).toBeCloseTo(1, 5)
    expect(r.vM).toBeCloseTo(0, 5)
  })

  it('East (1,0) rotated 90° CW → South (0,-1)', () => {
    const r = rotateLocal(1, 0, 90)
    expect(r.uM).toBeCloseTo(0, 5)
    expect(r.vM).toBeCloseTo(-1, 5)
  })

  it('rotateLocal(v, -deg) undoes rotateLocal(v, deg)', () => {
    const { uM, vM } = rotateLocal(3, 4, 37)
    const back = rotateLocal(uM, vM, -37)
    expect(back.uM).toBeCloseTo(3, 5)
    expect(back.vM).toBeCloseTo(4, 5)
  })
})
