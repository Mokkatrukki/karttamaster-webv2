export interface LatLng {
  lat: number
  lng: number
}

const DEG_PER_M_LAT = 1 / 111320

function degPerMLng(lat: number): number {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180))
}

function offsetLatLng(
  centerLat: number,
  centerLng: number,
  dNorthM: number,
  dEastM: number
): LatLng {
  return {
    lat: centerLat + dNorthM * DEG_PER_M_LAT,
    lng: centerLng + dEastM * degPerMLng(centerLat),
  }
}

export function rotatePoint(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  angleDeg: number
): LatLng {
  const rad = (angleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  // Work in meters for rotation, then convert back
  const scaleNS = 1 / DEG_PER_M_LAT
  const scaleEW = 1 / degPerMLng(centerLat)
  const dy = (lat - centerLat) * scaleNS
  const dx = (lng - centerLng) * scaleEW
  const rotDy = dy * cosA - dx * sinA
  const rotDx = dy * sinA + dx * cosA
  return {
    lat: centerLat + rotDy * DEG_PER_M_LAT,
    lng: centerLng + rotDx * degPerMLng(centerLat),
  }
}

export function latLngToLocal(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
): { uM: number; vM: number } {
  const scaleNS = 1 / DEG_PER_M_LAT
  const scaleEW = 1 / degPerMLng(centerLat)
  return {
    uM: (lng - centerLng) * scaleEW,
    vM: (lat - centerLat) * scaleNS,
  }
}

export function localToLatLng(
  uM: number,
  vM: number,
  centerLat: number,
  centerLng: number,
): LatLng {
  return offsetLatLng(centerLat, centerLng, vM, uM)
}

export function cornersToRect(
  cornerA: LatLng,
  cornerB: LatLng,
): { centerLat: number; centerLng: number; widthM: number; heightM: number } {
  const centerLat = (cornerA.lat + cornerB.lat) / 2
  const centerLng = (cornerA.lng + cornerB.lng) / 2
  const scaleNS = 1 / DEG_PER_M_LAT
  const scaleEW = 1 / degPerMLng(centerLat)
  const widthM = Math.abs(cornerB.lng - cornerA.lng) * scaleEW
  const heightM = Math.abs(cornerB.lat - cornerA.lat) * scaleNS
  return {
    centerLat,
    centerLng,
    widthM: Math.max(widthM, 1),
    heightM: Math.max(heightM, 1),
  }
}

export function cornersFromRect(
  centerLat: number,
  centerLng: number,
  widthM: number,
  heightM: number,
  rotationDeg: number
): [LatLng, LatLng, LatLng, LatLng] {
  const hw = widthM / 2
  const hh = heightM / 2
  // Unrotated corners: NW, NE, SE, SW (north = +lat, east = +lng)
  const raw: [LatLng, LatLng, LatLng, LatLng] = [
    offsetLatLng(centerLat, centerLng, hh, -hw),
    offsetLatLng(centerLat, centerLng, hh, hw),
    offsetLatLng(centerLat, centerLng, -hh, hw),
    offsetLatLng(centerLat, centerLng, -hh, -hw),
  ]
  if (rotationDeg === 0) return raw
  return raw.map(p => rotatePoint(p.lat, p.lng, centerLat, centerLng, rotationDeg)) as [
    LatLng,
    LatLng,
    LatLng,
    LatLng,
  ]
}
