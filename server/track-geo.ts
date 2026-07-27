// T360/V261: KOHTISUORA etäisyys pätkän jälkeen — serverin kopio.
//
// Tämä on TARKOITUKSELLINEN duplikaatti `src/logic/segment-track.ts`:n `distanceToTrackM`ista.
// Server ⊥ importtaa `src/`:ää (arkkitehtuuriraja, CLAUDE.md) ∴ vaihtoehtoja on kaksi: kopio
// jolla on oma testi, tai serveri joka ⊥ osaa ratkaista jäsenyyttä ollenkaan. Sama precedent
// kuin `server/db.ts:305` slugify.
//
// V261: kopion HINTA on että kaksi toteutusta voi ajautua erilleen ∴ molemmilla ! olla testi
// joka vertaa SAMAAN odotusarvoon (`server/track-geo.test.ts` & `tests/segment-track.test.ts`
// mittaavat saman geometrian). Kaksi toteutusta ilman yhteistä odotusarvoa on B100-suvun
// seuraava jäsen: kerrokset ovat eri mieltä jäsenyydestä & talkoolainen saa 403:n merkistä
// jonka hänen oma näkymänsä listaa.

export interface TrackPoint {
  lat: number
  lon: number
  d: number
}

const DEG = Math.PI / 180
const EARTH_R = 6371000

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * DEG
  const dLon = (b.lon - a.lon) * DEG
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(s))
}

interface PlanePoint {
  x: number
  y: number
}

function project(lat: number, lon: number, refLat: number): PlanePoint {
  return { x: lon * DEG * EARTH_R * Math.cos(refLat * DEG), y: lat * DEG * EARTH_R }
}

/** Kohtisuora etäisyys janalle metreinä (projektio kiinnitetään janan päihin). */
function distanceToSegmentM(p: PlanePoint, a: PlanePoint, b: PlanePoint): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
  const dx = p.x - (a.x + t * vx)
  const dy = p.y - (a.y + t * vy)
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * V261: merkin kohtisuora etäisyys jälkeen. Tyhjä jälki → `Infinity` (⊥ voi voittaa ketään).
 * Peilaa `src/logic/segment-track.ts:distanceToTrackM`ia — jos muutat toista, muuta molempia.
 */
export function distanceToTrackM(track: TrackPoint[], lat: number, lon: number): number {
  if (track.length === 0) return Infinity
  if (track.length === 1) return haversineM(track[0], { lat, lon })

  const p = project(lat, lon, lat)
  let best = Infinity
  for (let i = 0; i + 1 < track.length; i++) {
    const d = distanceToSegmentM(
      p,
      project(track[i].lat, track[i].lon, lat),
      project(track[i + 1].lat, track[i + 1].lon, lat),
    )
    if (d < best) best = d
  }
  return best
}

/** Turvallinen JSON-parse kannan `track`-sarakkeelle. Rikkinäinen arvo = ei jälkeä (legacy-haara). */
export function parseTrack(raw: string | null): TrackPoint[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as TrackPoint[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}
