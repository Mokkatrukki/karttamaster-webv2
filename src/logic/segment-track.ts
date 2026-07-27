import type { RoutePoint } from './types'
import { haversineDistance } from './bearing'

// T358/V258/V261: PÄTKÄ OMISTAA OMAN GEOMETRIANSA.
//
// Miksi tämä tiedosto on olemassa: pätkä oli (reitti, kmAlku, kmLoppu) — kaksi lukua yhdellä
// akselilla. km→paikka ⊥ ole injektio (reitti käy samassa kohdassa kahdesti, 3 SMTB-reittiä
// kulkee ≤100 m toisistaan) ∴ kaksi lukua ⊥ yksilöi maastoa: sama merkki sai smtb-55:llä km
// 18.85 JA 20.69 & putosi kahdelle pätkälle (B143), & luontiklikin km oli arvaus väärältä
// kierrokselta (B144). Jälki on se tieto joka puuttui: pisteet, ⊥ lukupari.
//
// V258: jälki on aina reitin YHTENÄINEN SIIVU ⊥ vapaa polku. `distanceFromStart` on
// kumulatiivinen ∴ monotoninen indeksissä ∴ (reitti, startIdx, endIdx) määrää jäljen täysin.
// Välipisteet (T362) ⊥ lisää ilmaisuvoimaa — ne ratkaisevat MINKÄ indeksin käyttäjä tarkoitti.
// ⊥ yleistä tätä vapaaksi poluksi: pisteiden tallennuksen syy on serveri (⊥ lataa GPX:iä).

/** Piste pätkän omalla akselilla. `d` = matka JÄLJEN alusta (⊥ reitin alusta). */
export interface TrackPoint {
  lat: number
  lon: number
  d: number
}

export type SegmentTrack = TrackPoint[]

/** Jäljen pituus = viimeisen pisteen `d` (V258: ⊥ `endDist − startDist`). */
export function trackLengthM(track: SegmentTrack): number {
  return track.length > 0 ? track[track.length - 1].d : 0
}

// Pisteet uudelleen 0-pohjaisiksi: pätkän km on 0…pituus (V259) ∴ talkoolainen ⊥ tarvitse
// tietää mistä reitin alku on. Kutsujat antavat aina reitin siivun, ⊥ mielivaltaista jonoa.
function rebase(points: RoutePoint[]): SegmentTrack {
  if (points.length === 0) return []
  const base = points[0].distanceFromStart
  return points.map(p => ({ lat: p.lat, lon: p.lon, d: p.distanceFromStart - base }))
}

/**
 * V258/V260: legacy-pätkän & rajamuokkauksen (T78/V43) johtofunktio — jälki nykyisistä
 * km-rajoista. Siivu on TÄSMÄLLEEN sama kuin `segment-overlay.ts:sliceRoutePoints` piirtää
 * (`>= startDist && <= endDist`) ∴ migraatio ⊥ siirrä karttaa pikselilläkään (T361).
 */
export function deriveTrackFromBounds(
  routePoints: RoutePoint[],
  startDist: number,
  endDist: number,
): SegmentTrack {
  return rebase(
    routePoints.filter(p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist),
  )
}

/**
 * V258/B144: klik-klik-luonnin johtofunktio. Ankkurit ovat reitin PISTEINDEKSEJÄ & jälki
 * kerätään kulkemalla ETEENPÄIN — ⊥ km-lukemien min/max, joka valitsi väärän kierroksen kun
 * reitti ohitti saman kohdan kahdesti.
 *
 * Ei-monotoninen ankkuri HEITTÄÄ: kutsuja on tulkinnut käyttäjän klikin väärin & hiljainen
 * käännös (min/max) tuottaisi juuri sen jäljen jota käyttäjä ⊥ osoittanut. Väliankkurit ovat
 * tuloksessa mukana implisiittisesti — ne ovat reitin pisteitä ensimmäisen & viimeisen välissä.
 */
export function buildTrackFromAnchors(routePoints: RoutePoint[], anchorIdx: number[]): SegmentTrack {
  if (anchorIdx.length < 2) {
    throw new Error(`V258: track needs >= 2 anchors (got ${anchorIdx.length})`)
  }
  for (let i = 0; i < anchorIdx.length; i++) {
    const idx = anchorIdx[i]
    if (!Number.isInteger(idx) || idx < 0 || idx >= routePoints.length) {
      throw new Error(`V258: anchor ${i} out of range (${idx}, route has ${routePoints.length})`)
    }
    if (i > 0 && idx <= anchorIdx[i - 1]) {
      throw new Error(
        `V258: anchors must advance along route — anchor ${i} (${idx}) <= anchor ${i - 1} (${anchorIdx[i - 1]})`,
      )
    }
  }
  return rebase(routePoints.slice(anchorIdx[0], anchorIdx[anchorIdx.length - 1] + 1))
}

// V261: KOHTISUORA etäisyys janalle, ⊥ etäisyys lähimpään kärkipisteeseen.
//
// Mitattu tuotantodatasta: suurin ero kärkipiste−kohtisuora 41.9 m, & pisteväli ⊥ ole tasainen
// (smtb-55 mediaani 23.6 m mutta p95 73.8 m; sgf-125 max 767 m) ∴ kärkipiste-etäisyys erehtyy
// kymmeniä metrejä juuri siellä missä GPX on harva & V259:n lähin-voittaa valitsisi VÄÄRÄN
// pätkän kahden rinnakkaisen jäljen välillä. `bearing.ts:nearestPointIndex` mittaa kärkiin —
// se JÄÄ reitti-/km-käyttöön, ⊥ muuteta sitä täällä.
//
// Taso: paikallinen taso-projektio (equirectangular) referenssileveysasteella. Metrin murto-osan
// virhe sadan metrin matkalla ⊥ merkitse, kun kysymys on "kumpi jälki on lähempänä".
interface PlanePoint {
  x: number
  y: number
}

const DEG = Math.PI / 180
const EARTH_R = 6371000

function project(lat: number, lon: number, refLat: number): PlanePoint {
  return { x: lon * DEG * EARTH_R * Math.cos(refLat * DEG), y: lat * DEG * EARTH_R }
}

/** Kohtisuora etäisyys janalle + `t` (0…1) = projektiopisteen osuus janasta. */
function segmentProjection(
  p: PlanePoint,
  a: PlanePoint,
  b: PlanePoint,
): { distM: number; t: number } {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  // Rappeutunut jana (kaksi identtistä pistettä): projektio on kärkipiste itse.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
  const dx = p.x - (a.x + t * vx)
  const dy = p.y - (a.y + t * vy)
  return { distM: Math.sqrt(dx * dx + dy * dy), t }
}

/** Lähin kohta jäljellä: kohtisuora etäisyys + matka jäljen alusta siihen kohtaan. */
function nearestOnTrack(
  track: SegmentTrack,
  lat: number,
  lon: number,
): { distM: number; d: number } | null {
  if (track.length === 0) return null
  if (track.length === 1) {
    return { distM: haversineDistance(track[0], { lat, lon }), d: track[0].d }
  }

  const p = project(lat, lon, lat)
  let bestDist = Infinity
  let bestD = 0
  for (let i = 0; i + 1 < track.length; i++) {
    const a = track[i]
    const b = track[i + 1]
    const { distM, t } = segmentProjection(p, project(a.lat, a.lon, lat), project(b.lat, b.lon, lat))
    if (distM < bestDist) {
      bestDist = distM
      bestD = a.d + (b.d - a.d) * t
    }
  }
  return { distM: bestDist, d: bestD }
}

/**
 * V259/V261: merkin kohtisuora etäisyys pätkän jälkeen. Tämä on jäsenyyden RATKAISIJA
 * (lähin jälki voittaa aina, ⊥ kynnystä) ∴ tarkkuus ratkaisee omistajuuden, ⊥ vain näyttöä.
 * Tyhjä jälki → `Infinity`: reititön tehtävä (V139) ⊥ voi voittaa ketään geometrialla.
 */
export function distanceToTrackM(track: SegmentTrack, lat: number, lon: number): number {
  return nearestOnTrack(track, lat, lon)?.distM ?? Infinity
}

/**
 * V259: merkin km PÄTKÄN akselilla (0…pituus) — matka jäljen alusta lähimpään kohtaan.
 * `null` = ei jälkeä ∴ kutsuja ⊥ arvaa lukemaa (V139 reititön tehtävä, tai jälki puuttuu vielä
 * V260-välitilassa).
 */
export function kmAlongTrackM(track: SegmentTrack, lat: number, lon: number): number | null {
  return nearestOnTrack(track, lat, lon)?.d ?? null
}

/** Klikin osuma reitille: piste-INDEKSI (⊥ km) + sen km & koordinaatit näyttöä varten. */
export interface AnchorHit {
  idx: number
  dist: number
  lat: number
  lon: number
}

/**
 * T362/B144: klikin ankkuri reitillä — lähin piste `fromIdx`:stä ETEENPÄIN, ≤`thresholdM`.
 * `null` = klikki ⊥ osu reitin jäljellä olevaan osaan.
 *
 * Miksi eteenpäin: `nearestPointIndex` etsii GLOBAALIN minimin ∴ edestakaisella osuudella se
 * palauttaa väärän kierroksen pisteen (B144(b): klikki 20.69 km kohtaan sai km 18.85).
 * Kun haku alkaa edellisestä ankkurista, kierros ⊥ ole arvaus vaan seuraus siitä mitä käyttäjä
 * on jo osoittanut. ENSIMMÄINEN ankkuri (`fromIdx = 0`) on yhä globaali — sille ⊥ ole aiempaa
 * kontekstia ∴ UI ! NÄYTTÄÄ valittu km (B144(a)) jotta käyttäjä voi perua sen itse.
 */
export function nextAnchorIndex(
  routePoints: RoutePoint[],
  lat: number,
  lon: number,
  fromIdx: number,
  thresholdM: number,
): AnchorHit | null {
  let best: AnchorHit | null = null
  let bestDist = Infinity
  for (let i = Math.max(0, fromIdx); i < routePoints.length; i++) {
    const p = routePoints[i]
    const d = haversineDistance(p, { lat, lon })
    if (d <= thresholdM && d < bestDist) {
      bestDist = d
      best = { idx: i, dist: p.distanceFromStart, lat: p.lat, lon: p.lon }
    }
  }
  return best
}
