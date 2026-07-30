import type { SignMarker } from './types'
import { distancesForRoute } from './marker-distance'
import { orderMarkersInSegment, type SegmentOrder } from './segment-order'
import { haversineDistance } from './bearing'

// T328/V237: pätkäkontekstin akseli EI enää kulje `routeId`-parametrina vaan tulee pätkästä.
// Hero/lista tuntevat pätkän jo ∴ akselia ei voi unohtaa (B126/B129 syntyivät unohduksesta).
export type OrderingSegment = Parameters<typeof orderMarkersInSegment>[1]

// V3/V143 (B-lista2): pätkän ENSIMMÄINEN asettamaton merkki kulkusuunnassa. Tämä on "Aseta
// seuraava" -ohjauksen valinta talkoolaiselle: se etenee pätkän merkit järjestyksessä, EI
// lähimpään kursorin/GPS-sijainnin merkkiin. Anna `markers` valmiiksi pätkälle rajattuna
// (getMarkersForSegment). T328/V237: akseli tulee `segment`istä; V238: purku-phasessa
// "ensimmäinen" on pätkän LOPUSTA, koska purku ajetaan vastasuuntaan.
export function firstUnsetMarker(
  markers: SignMarker[],
  segment: OrderingSegment,
): SignMarker | null {
  return unsetMarkersOrdered(markers, segment)[0] ?? null
}

// T231/V159: pätkän asettamattomat merkit kulkusuunnassa. Sama 'suunniteltu'-predikaatti kuin
// firstUnsetMarker. Hero-◀▶-selailun (stepUnset) lähde. T328/V238: "ei reitillä" -merkit
// (segmentKm null) tulevat LOPPUUN — hero ei saa avata niitä ensimmäisenä, mutta ne eivät myöskään
// katoa selailusta (lista renderöi ne omana ryhmänään).
export function unsetMarkersOrdered(
  markers: SignMarker[],
  segment: OrderingSegment,
): SignMarker[] {
  const unset = markers.filter((m) => m.status === 'suunniteltu')
  const { onRoute, offRoute }: SegmentOrder = orderMarkersInSegment(unset, segment)
  return [...onRoute, ...offRoute]
}

// T413/V304: onko tehtävä REITITÖN (V139)? Reitilliseksi kelpaa vain pätkä jolla on kaikki kolme
// kenttää — puolikas reitti (rajat ilman routeIdsia) ⊥ anna `segmentKm`ille akselia ∴ se on
// järjestyksen kannalta reititön. `null`-pätkä (orpojen lista) lasketaan reitittömäksi.
export function isRoutelessSegment(segment: OrderingSegment): boolean {
  if (!segment) return true
  return (
    !segment.routeIds ||
    segment.routeIds.length === 0 ||
    segment.startDist === undefined ||
    segment.endDist === undefined
  )
}

// T413/V304: lähin asettamaton merkki GPS-sijaintiin METREISSÄ. Sisar `nearestUnsetMarker`ille,
// joka mittaa km-akselilla (V235) — reitittömällä tehtävällä sitä akselia ⊥ ole olemassa ∴
// vertailu on maantieteellinen. Tasapeli ratkeaa merkin id:llä (determinismi ⊥ lista-indeksi,
// V96-kuvio): sama syöte antaa saman merkin joka renderillä.
export function nearestUnsetByGps(
  markers: SignMarker[],
  pos: { lat: number; lon: number },
): SignMarker | null {
  let best: SignMarker | null = null
  let bestM = Infinity
  for (const m of markers) {
    if (m.status !== 'suunniteltu') continue
    const d = haversineDistance(pos, m)
    if (d < bestM || (d === bestM && best !== null && m.id < best.id)) { bestM = d; best = m }
  }
  return best
}

// T413/V304: "seuraava merkki" -OLETUSVALINTA — YKSI päätöspaikka. Reititön tehtävä + GPS-fix →
// lähin metrisesti (muuten järjestys tulisi `distanceFromStart`ista, joka on reitittömälle
// joukolle mielivaltainen akseli → talkoolainen pomppii). Muissa tapauksissa nykykäytös
// bitti bitiltä: reitillinen pätkä pitää km-järjestyksensä (V237/V238) & fixin puute palautuu
// `firstUnsetMarker`iin. HUOM: tätä kutsutaan VAIN kun validia valintaa ⊥ ole (hero reconcile) —
// GPS ⊥ saa vaihtaa jo valittua merkkiä alta (V304 hysteresis).
export function defaultUnsetSelection(
  markers: SignMarker[],
  segment: OrderingSegment,
  pos: { lat: number; lon: number } | null,
): SignMarker | null {
  if (pos && isRoutelessSegment(segment)) return nearestUnsetByGps(markers, pos)
  return firstUnsetMarker(markers, segment)
}

// T231/V159: hero-◀▶ — seuraava/edellinen asettamaton merkki `currentId`:stä. Clamp päihin
// (EI wrap-around): ensimmäisestä taakse → ensimmäinen; viimeisestä eteen → viimeinen.
// Tuntematon tai jo-asetettu `currentId` (katosi listalta) → firstUnsetMarker (reconcile V159).
// dir: 1 = seuraava, -1 = edellinen. T328/V237: km-akseli tulee `segment`istä.
export function stepUnset(
  markers: SignMarker[],
  currentId: string,
  dir: 1 | -1,
  segment: OrderingSegment,
): SignMarker | null {
  const ordered = unsetMarkersOrdered(markers, segment)
  if (ordered.length === 0) return null
  const idx = ordered.findIndex((m) => m.id === currentId)
  if (idx === -1) return ordered[0] // currentId ei asettamattomien joukossa → palaa ensimmäiseen
  const next = Math.min(ordered.length - 1, Math.max(0, idx + dir)) // clamp, ei wrap
  return ordered[next]
}

// Lähin asettamaton merkki kursorin km-kohtaan. `routeId` rajaa jäsenyyden (routeIds) JA antaa
// km-akselin (V235) — aiemmin se ohjasi vain jäsenyyttä, mikä jätti vertailun väärälle akselille.
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
// AKTIIVISEN reitin akselilta (V235), ei merkin skalaarista. Palauttaa null jos edessä ei ole
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

// T327/V235: merkin km AKTIIVISEN reitin akselilla, edessäpäin currentDist:stä. Drive-kursorin
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
  // Sama akseli kuin valinnassa (V235) — lähin ehdokas, ei skalaari.
  let best = Infinity
  for (const d of distancesForRoute(nearest, routeId)) {
    const diff = Math.abs(d - currentDist)
    if (diff < best) best = diff
  }
  return best
}
