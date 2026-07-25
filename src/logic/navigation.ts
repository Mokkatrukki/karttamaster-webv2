import type { SignMarker } from './types'
import { distancesForRoute } from './marker-distance'

// T319/V229: kulkusuunnan järjestysavain. Merkin `distanceFromStart` on YKSI skalaari joka on
// mitattu SIJOITUSHETKEN lähimmältä reitiltä (types.ts:18) ∴ eri merkeillä voi olla eri akseli
// → sort() sekoittaa ne. Prod 2026-07-25 (B126): Pätkä 4:n kolme merkkiä oli mitattu smtb-30:ltä
// (4.6 km) vaikka sijaitsevat 55 km -reitin kohdassa 25.2 km → km 0.00/0.03/0.57 nosti pätkän
// VIIMEISET merkit ensimmäisiksi. Anna siis `routeId` = pätkän primary (segmentPrimaryRouteId)
// tai drive-moodin aktiivinen reitti. undefined → fallback `distanceFromStart` (legacy, V212).
// Lenkillä sama reitti antaa useamman km-ehdokkaan (V214/B116) — järjestykseen otetaan pienin.
function orderKm(m: SignMarker, routeId: string | undefined): number {
  const cands = distancesForRoute(m, routeId)
  let best = cands[0]
  for (const d of cands) if (d < best) best = d
  return best
}

// V3/V143 (B-lista2): pätkän ENSIMMÄINEN asettamaton merkki — pienin km jolla
// status==='suunniteltu'. Tämä on "Aseta seuraava" -ohjauksen valinta talkoolaiselle: se etenee
// pätkän merkit järjestyksessä alusta loppuun, EI lähimpään kursorin/GPS-sijainnin merkkiin.
// Anna `markers` valmiiksi pätkälle rajattuna (getMarkersForSegment) — funktio ei tunne pätkää.
// `routeId` (V229) = km-akseli; ilman sitä käytös on entinen (skalaari).
export function firstUnsetMarker(markers: SignMarker[], routeId?: string): SignMarker | null {
  let best: SignMarker | null = null
  for (const m of markers) {
    if (m.status !== 'suunniteltu') continue
    if (best === null || orderKm(m, routeId) < orderKm(best, routeId)) best = m
  }
  return best
}

// T231/V159: pätkän asettamattomat merkit km-järjestyksessä (asc). Sama 'suunniteltu'-predikaatti
// kuin firstUnsetMarker. Hero-◀▶-selailun (stepUnset) lähde. Anna `markers` valmiiksi pätkälle
// rajattuna (getMarkersForSegment) — funktio ei tunne pätkää. `routeId` = km-akseli (V229).
export function unsetMarkersOrdered(markers: SignMarker[], routeId?: string): SignMarker[] {
  return markers
    .filter((m) => m.status === 'suunniteltu')
    .sort((a, b) => orderKm(a, routeId) - orderKm(b, routeId))
}

// T231/V159: hero-◀▶ — seuraava/edellinen asettamaton merkki `currentId`:stä. Clamp päihin
// (EI wrap-around): ensimmäisestä taakse → ensimmäinen; viimeisestä eteen → viimeinen.
// Tuntematon tai jo-asetettu `currentId` (katosi listalta) → firstUnsetMarker (reconcile V159).
// dir: 1 = seuraava, -1 = edellinen. `routeId` = km-akseli (V229).
export function stepUnset(
  markers: SignMarker[],
  currentId: string,
  dir: 1 | -1,
  routeId?: string,
): SignMarker | null {
  const ordered = unsetMarkersOrdered(markers, routeId)
  if (ordered.length === 0) return null
  const idx = ordered.findIndex((m) => m.id === currentId)
  if (idx === -1) return ordered[0] // currentId ei asettamattomien joukossa → palaa ensimmäiseen
  const next = Math.min(ordered.length - 1, Math.max(0, idx + dir)) // clamp, ei wrap
  return ordered[next]
}

// Lähin asettamaton merkki kursorin km-kohtaan. `routeId` rajaa jäsenyyden (routeIds) JA antaa
// km-akselin (V229) — aiemmin se ohjasi vain jäsenyyttä, mikä jätti vertailun väärälle akselille.
export function nearestUnsetMarker(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): SignMarker | null {
  let best: SignMarker | null = null
  let bestDiff = Infinity
  for (const m of markers) {
    if (m.status !== 'suunniteltu') continue
    if (!m.routeIds.includes(routeId)) continue
    // Lenkillä merkillä on useampi km-ehdokas samalla reitillä (V214) → lähin ratkaisee.
    for (const d of distancesForRoute(m, routeId)) {
      const diff = Math.abs(d - currentDist)
      if (diff < bestDiff) { bestDiff = diff; best = m }
    }
  }
  return best
}

// T39: drive-mode "hyppää seuraavaan merkkiin". Reittiä pitkin ajavan (järjestäjä/talkoolainen)
// seuraava merkki EDESSÄPÄIN aktiivisella reitillä — pienin km joka on AIDOSTI suurempi kuin
// currentDist (strict > → toistopainallus etenee, ei jää paikalleen samaan merkkiin). Kaikki
// statukset mukana (drive tarkastaa myös jo asetetut) — EI GPS-riippuvainen. Km luetaan
// AKTIIVISEN reitin akselilta (V229), ei merkin skalaarista. Palauttaa null jos edessä ei ole
// merkkiä. Pari: `distanceAhead` antaa saman merkin km:n samalta akselilta.
export function nextMarkerAhead(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): SignMarker | null {
  let best: SignMarker | null = null
  let bestKm = Infinity
  for (const m of markers) {
    if (!m.routeIds.includes(routeId)) continue
    for (const d of distancesForRoute(m, routeId)) {
      if (d <= currentDist) continue
      if (d < bestKm) { bestKm = d; best = m }
    }
  }
  return best
}

// T319/V229: merkin km AKTIIVISEN reitin akselilla, edessäpäin currentDist:stä. Drive-kursorin
// (`jumpToDistance`) syöte — se ! lukea `marker.distanceFromStart`ia, koska se voi olla mitattu
// toiselta reitiltä ∴ kursori hyppäisi väärään kohtaan reittiä. null = ei merkkiä edessä.
export function distanceAhead(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): number | null {
  let bestKm: number | null = null
  for (const m of markers) {
    if (!m.routeIds.includes(routeId)) continue
    for (const d of distancesForRoute(m, routeId)) {
      if (d <= currentDist) continue
      if (bestKm === null || d < bestKm) bestKm = d
    }
  }
  return bestKm
}

export function distanceToNext(
  markers: SignMarker[],
  currentDist: number,
  routeId: string,
): number | null {
  const nearest = nearestUnsetMarker(markers, currentDist, routeId)
  if (!nearest) return null
  // Sama akseli kuin valinnassa (V229) — lähin ehdokas, ei skalaari.
  let best = Infinity
  for (const d of distancesForRoute(nearest, routeId)) {
    const diff = Math.abs(d - currentDist)
    if (diff < best) best = diff
  }
  return best
}
