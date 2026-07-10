import type { SignMarker } from './types'

// V3/V143 (B-lista2): pätkän ENSIMMÄINEN asettamaton merkki — pienin distanceFromStart jolla
// status==='suunniteltu'. Tämä on "Aseta seuraava" -ohjauksen valinta talkoolaiselle: se etenee
// pätkän merkit järjestyksessä alusta loppuun, EI lähimpään kursorin/GPS-sijainnin merkkiin.
// Anna `markers` valmiiksi pätkälle rajattuna (getMarkersForSegment) — funktio ei tunne pätkää.
export function firstUnsetMarker(markers: SignMarker[]): SignMarker | null {
  let best: SignMarker | null = null
  for (const m of markers) {
    if (m.status !== 'suunniteltu') continue
    if (best === null || m.distanceFromStart < best.distanceFromStart) best = m
  }
  return best
}

// T231/V159: pätkän asettamattomat merkit km-järjestyksessä (distanceFromStart asc). Sama
// 'suunniteltu'-predikaatti kuin firstUnsetMarker. Hero-◀▶-selailun (stepUnset) lähde.
// Anna `markers` valmiiksi pätkälle rajattuna (getMarkersForSegment) — funktio ei tunne pätkää.
export function unsetMarkersOrdered(markers: SignMarker[]): SignMarker[] {
  return markers
    .filter((m) => m.status === 'suunniteltu')
    .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
}

// T231/V159: hero-◀▶ — seuraava/edellinen asettamaton merkki `currentId`:stä. Clamp päihin
// (EI wrap-around): ensimmäisestä taakse → ensimmäinen; viimeisestä eteen → viimeinen.
// Tuntematon tai jo-asetettu `currentId` (katosi listalta) → firstUnsetMarker (reconcile V159).
// dir: 1 = seuraava, -1 = edellinen.
export function stepUnset(
  markers: SignMarker[],
  currentId: string,
  dir: 1 | -1,
): SignMarker | null {
  const ordered = unsetMarkersOrdered(markers)
  if (ordered.length === 0) return null
  const idx = ordered.findIndex((m) => m.id === currentId)
  if (idx === -1) return ordered[0] // currentId ei asettamattomien joukossa → palaa ensimmäiseen
  const next = Math.min(ordered.length - 1, Math.max(0, idx + dir)) // clamp, ei wrap
  return ordered[next]
}

export function nearestUnsetMarker(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): SignMarker | null {
  const candidates = markers.filter(
    (m) => m.status === 'suunniteltu' && m.routeIds.includes(routeId),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, m) =>
    Math.abs(m.distanceFromStart - currentDist) < Math.abs(best.distanceFromStart - currentDist)
      ? m
      : best,
  )
}

// T39: drive-mode "hyppää seuraavaan merkkiin". Reittiä pitkin ajavan (järjestäjä/talkoolainen)
// seuraava merkki EDESSÄPÄIN aktiivisella reitillä — pienin distanceFromStart joka on AIDOSTI
// suurempi kuin currentDist (strict > → toistopainallus etenee, ei jää paikalleen samaan merkkiin).
// Kaikki statukset mukana (drive tarkastaa myös jo asetetut) — EI GPS-riippuvainen, käyttää vain
// merkin distanceFromStart-arvoa. Palauttaa null jos reitillä ei ole merkkiä currentDist:n edellä.
export function nextMarkerAhead(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): SignMarker | null {
  let best: SignMarker | null = null
  for (const m of markers) {
    if (!m.routeIds.includes(routeId)) continue
    if (m.distanceFromStart <= currentDist) continue
    if (best === null || m.distanceFromStart < best.distanceFromStart) best = m
  }
  return best
}

export function distanceToNext(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): number | null {
  const nearest = nearestUnsetMarker(markers, currentDist, routeId)
  if (!nearest) return null
  return Math.abs(nearest.distanceFromStart - currentDist)
}
