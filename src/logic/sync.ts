import type { SignMarker, MarkerType, MarkerStatus } from './types'
import type { SignPart } from './sign-library'

interface ServerMarker {
  id: string
  type: string
  lat: number
  lon: number
  distance_from_start: number
  // T300/V212/B115: km per reitti. NULL/puuttuu = legacy → distanceForRoute fallbackaa.
  distance_by_route?: Record<string, number[]> | null
  // T392/V284: lähin reitti + kohtisuora etäisyys. NULL/puuttuu = backfill kesken → jäsenyys
  // ⊥ sovella reittisääntöä (entinen käytös).
  nearest_route_id?: string | null
  nearest_route_dist_m?: number | null
  route_ids: string[]
  status: string
  location_note: string | null
  color: string | null
  label: string | null
  icon_id: string | null
  image_id: string | null
  template_id: string | null
  parts_json: string | null
  // T423/V314: kasan sisältö. NULL = ei kasa (tai vioittunut JSON, serveri normalisoi).
  pile_marker_ids?: string[] | null
  description: string | null
  images: string[]
  created_by: string | null
}

// T172/V107: parts_json on greenfield-data — malformed sisältö ei saa kaataa fetchMarkersia (V14-pattern)
function parsePartsJson(raw: string | null): SignPart[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as SignPart[] : undefined
  } catch {
    return undefined
  }
}

function fromServer(row: ServerMarker): SignMarker {
  return {
    id: row.id,
    type: row.type as MarkerType,
    lat: row.lat,
    lon: row.lon,
    distanceFromStart: row.distance_from_start,
    ...(row.distance_by_route ? { distanceByRoute: row.distance_by_route } : {}),
    ...(row.nearest_route_id != null ? { nearestRouteId: row.nearest_route_id } : {}),
    ...(row.nearest_route_dist_m != null ? { nearestRouteDistM: row.nearest_route_dist_m } : {}),
    routeIds: row.route_ids,
    status: row.status as MarkerStatus,
    ...(row.location_note != null ? { locationNote: row.location_note } : {}),
    ...(row.color != null ? { color: row.color } : {}),
    ...(row.label != null ? { label: row.label } : {}),
    ...(row.icon_id != null ? { iconId: row.icon_id } : {}),
    ...(row.image_id != null ? { imageId: row.image_id } : {}),
    ...(row.template_id != null ? { templateId: row.template_id } : {}),
    ...(parsePartsJson(row.parts_json) ? { parts: parsePartsJson(row.parts_json) } : {}),
    ...(row.pile_marker_ids != null ? { pileMarkerIds: row.pile_marker_ids } : {}),
    ...(row.description != null ? { description: row.description } : {}),
    ...(row.images && row.images.length > 0 ? { images: row.images } : {}),
    ...(row.created_by != null ? { createdBy: row.created_by } : {}),
  }
}

// T184/V118: erottele "0 merkkiä" ja "lataus epäonnistui". Hiljainen []-paluu
// piilotti verkko-/HTTP-virheen → tyhjä kartta luultiin todeksi → duplikaatit,
// ja re-fetch (GPKG-tuonti, role-view) ylikirjoitti olemassa olevat merkit tyhjällä.
export type MarkersResult =
  | { ok: true; markers: SignMarker[] }
  | { ok: false; error: 'http' | 'network' }

export async function fetchMarkers(): Promise<MarkersResult> {
  try {
    const res = await fetch('/api/markers')
    if (!res.ok) return { ok: false, error: 'http' }
    const rows = await res.json() as ServerMarker[]
    return { ok: true, markers: rows.map(fromServer) }
  } catch {
    return { ok: false, error: 'network' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T446/V330: SSE-heräte pollauksen RINNALLE.
//
// Reaaliaika on KIIHDYTIN ⊥ kuljetusväline. Heräte `{type,id,rev}` ⊥ sisällä dataa vaan
// kehottaa hakemaan olemassa olevalla polulla (`fetchMarkers` yms.) — kaksi kanavaa samasta
// rivistä tuottaisi osittaisen totuuden jonka ikäjärjestystä ⊥ voi ratkaista.
//
// Kolme sääntöä joita ⊥ saa rikkoa:
//  1. Pollaus/olemassa oleva hakupolku EI poistu. Katkennut stream ⊥ pysäytä mitään —
//     metsässä yhteys katkeaa jatkuvasti & sovellus joka odottaa auennutta streamia ⊥ toimi
//     juuri siellä missä sitä käytetään.
//  2. Reconnect on SELAIMEN (`EventSource`). Täällä ⊥ ole backoffia eikä uudelleenyhteyttä —
//     oma koneisto olisi toinen, huonompi kopio siitä mitä selain tekee jo.
//  3. Heräte ilman verkkoa (tai ilman `EventSource`-tukea) ⊥ kaada — `start` palauttaa
//     no-op-sulkijan ja soittaja jatkaa kuin streamia ei olisi.
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeType = 'marker' | 'segment' | 'pile'

export interface ChangeEvent {
  type: ChangeType
  id: string
  rev: number
}

/** `EventSource`in se osa jota tämä moduuli käyttää — testattavuus ilman selainta. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (e: { data?: string }) => void): void
  close(): void
}

export interface ChangeStreamOptions {
  /** Heräte: "hae nyt". Saa nipun tapahtumia — purskeesta tulee YKSI haku, ei N. */
  onWake: (events: ChangeEvent[]) => void
  url?: string
  /** Purskeiden niputus. Kasan varaus koskee useaa merkkiä ∴ ⊥ haeta jokaisesta erikseen. */
  coalesceMs?: number
  /** Injektio testeille; oletus = selaimen `EventSource`. */
  create?: (url: string) => EventSourceLike
}

function defaultCreate(url: string): EventSourceLike | null {
  const ES = (globalThis as { EventSource?: new (u: string) => EventSourceLike }).EventSource
  if (!ES) return null
  return new ES(url)
}

/**
 * Avaa SSE-heräteväylän. Palauttaa sulkijan (idempotentti).
 *
 * Streamin avaus tai jäsentäminen ei koskaan heitä soittajalle: ilman `EventSource`-tukea
 * (vanha selain, jsdom, SSR) palautuu no-op eikä mikään muu polku muutu.
 */
export function startChangeStream(options: ChangeStreamOptions): () => void {
  const { onWake, url = '/api/stream', coalesceMs = 300 } = options
  const create = options.create ?? defaultCreate

  let source: EventSourceLike | null = null
  try {
    source = create(url)
  } catch {
    source = null
  }
  if (!source) return () => {}

  const es = source
  let stopped = false
  let lastRev = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let buffer: ChangeEvent[] = []

  const flush = (): void => {
    timer = null
    if (stopped || buffer.length === 0) return
    const batch = buffer
    buffer = []
    try {
      onWake(batch)
    } catch {
      // Hakupolun virhe on hakupolun asia — heräte ⊥ saa kaataa streamia.
    }
  }

  es.addEventListener('change', (e) => {
    if (stopped) return
    let parsed: unknown
    try {
      parsed = JSON.parse(String(e.data ?? ''))
    } catch {
      return // Vioittunut payload: pollaus tuo saman muutoksen joka tapauksessa.
    }
    const ev = parsed as Partial<ChangeEvent>
    if (typeof ev?.rev !== 'number' || typeof ev.id !== 'string' || typeof ev.type !== 'string') return
    // Duplikaatti/vanhentunut (reconnect toistaa Last-Event-ID:n jälkeisiä) → ohitetaan.
    if (ev.rev <= lastRev) return
    lastRev = ev.rev
    buffer.push({ type: ev.type as ChangeType, id: ev.id, rev: ev.rev })
    if (timer === null) timer = setTimeout(flush, coalesceMs)
  })

  // `error` = yhteys poikki. EI mitään tehtävää: selain yrittää itse uudelleen ja pollaus
  // kantaa sillä välin (V330). Kuuntelija on olemassa vain jottei tapahtuma jää käsittelemättä.
  es.addEventListener('error', () => {})

  return () => {
    if (stopped) return
    stopped = true
    if (timer !== null) { clearTimeout(timer); timer = null }
    buffer = []
    try {
      es.close()
    } catch {
      // Jo suljettu.
    }
  }
}

/**
 * T392/V284: lähimmän reitin backfill-push — tarkoituksella outboxin OHI (B145-kuvio, sama
 * peruste kuin `pushSegmentTrack`). Arvo on JOHDETTU (lat/lon + GPX) ∴ epäonnistunut push
 * korjautuu itsestään seuraavalla latauksella; durabiliteetti ei ole sen arvoinen että
 * taustamigraatio saisi laukaista reauth-overlayn.
 */
export async function pushMarkerNearestRoute(id: string, routeId: string, distM: number): Promise<void> {
  try {
    await fetch(`/api/markers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nearest_route_id: routeId, nearest_route_dist_m: distM }),
    })
  } catch {
    // Verkkovirhe: seuraava lataus johtaa arvon uudelleen.
  }
}
