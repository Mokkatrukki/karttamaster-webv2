import type { MarkerStatus, SignMarker } from './types'
import type { Segment, SegmentLineState } from './segments'
import { segmentLineState, getPhaseProgress } from './segments'
import { segmentVisibleOnRoutes } from './segment-visibility'
import { markersForSegment } from './segment-membership'

// T376/V271: kartan näkyvyys-/himmennyspäätös ratkeaa TASAN TÄSSÄ moduulissa. `src/map/`-kerros
// SOVELTAA palautetun tilan, ⊥ päätä sitä — sääntö joka elää kahdessa paikassa on kaksi eri
// mieltä olevaa karttaa.
//
// Tämä moduuli KOOSTAA olemassa olevat predikaatit (`segmentVisibleOnRoutes` V269,
// `markersForSegment` V259, `segmentLineState` V96) — se ⊥ keksi omaa jäsenyyssääntöä.
// Oma jäsenyyssääntö olisi B114–B129-perheen kymmenes esiintymä: yhdeksän kertaa sama juurisyy.
//
// ⊥ Leafletia, ⊥ DOM:ia → Vitest-pure.

/** Kolmiarvoinen: "piilota" ⊥ ole himmennyksen ääriarvo vaan oma tilansa, & tyyppi pakottaa
 *  kutsupaikan käsittelemään sen (V271). */
export type Visibility = 'full' | 'dim' | 'hidden'

/** V243-amend: himmennystaso on JÄRJESTÄJÄN valinta. Talkoolaisen automaattifokus pysyy
 *  vakiona `kevyt`-portaassa ∴ kenttänäkymä ⊥ muutu kenenkään säädöstä kesken tapahtuman. */
export type DimLevel = 'kevyt' | 'vahva' | 'piilota'

export interface MapFilter {
  /** undefined = suodatinta ⊥ asetettu. Reittinäkyvyys on KOVA piilotus (V269): piilotetun
   *  reitin päällä ⊥ ole mitään näytettävää, himmennys valehtelisi. */
  visibleRouteIds?: string[]
  /** "vain tämä pätkä" — valinta tehdään kartalta/modaalista, paneeli näyttää TILAN (V272). */
  isolatedSegmentId?: string
  markerStatuses: Set<MarkerStatus>
  segmentStates: Set<SegmentLineState>
  dimLevel: DimLevel
}

export const ALL_MARKER_STATUSES: MarkerStatus[] = ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen']
export const ALL_SEGMENT_STATES: SegmentLineState[] = ['ei_alkanut', 'kesken', 'valmis']

/** V243-amend: portaiden mitatut arvot. Merkki & viiva saavat ERI alfat ∀ portaalla — viiva on
 *  satoja px pitkä, merkki 40×48 ∴ sama alfa katoaa ilmakuvasta auringossa (§K MarkerFocus). */
export const DIM_OPACITY: Record<Exclude<DimLevel, 'piilota'>, { marker: number; line: number }> = {
  kevyt: { marker: 0.4, line: 0.22 },
  vahva: { marker: 0.15, line: 0.08 },
}

export function defaultMapFilter(): MapFilter {
  return {
    visibleRouteIds: undefined,
    isolatedSegmentId: undefined,
    markerStatuses: new Set(ALL_MARKER_STATUSES),
    segmentStates: new Set(ALL_SEGMENT_STATES),
    // V243-amend: OLETUS = vahva. "Piilota" vain eksplisiittisestä valinnasta.
    dimLevel: 'vahva',
  }
}

/** Suodatettu-mutta-⊥-oletus = tila jonka käyttäjän ! nähdä (V272). */
export function isDefaultFilter(f: MapFilter): boolean {
  return activeFilterCount(f) === 0
}

/** Aktiivilaskuri suodatinbarin trigger-nappiin. `dimLevel` ⊥ lasketa: se on esitystapa
 *  ⊥ rajaus — se ⊥ poista mitään kartalta (paitsi 'piilota', joka lasketaan). */
export function activeFilterCount(f: MapFilter): number {
  let n = 0
  if (f.visibleRouteIds !== undefined) n++
  if (f.isolatedSegmentId) n++
  if (f.markerStatuses.size < ALL_MARKER_STATUSES.length) n++
  if (f.segmentStates.size < ALL_SEGMENT_STATES.length) n++
  if (f.dimLevel === 'piilota') n++
  return n
}

/** Suodatettu pois → mitä sille tehdään. Piilota on eksplisiittinen valinta (V243-amend). */
function filteredOut(f: MapFilter): Visibility {
  return f.dimLevel === 'piilota' ? 'hidden' : 'dim'
}

/**
 * V272: monivalinta ⊥ saa tyhjentyä nollaan (V6-kuvio reiteiltä) — tyhjä kartta ⊥ ole
 * saavutettavissa vahingossa. Palauttaa UUDEN joukon (⊥ mutatoi) tai saman jos poisto torjuttiin.
 */
export function toggleFilterValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) {
    if (next.size <= 1) return set        // viimeistä ⊥ voi poistaa
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

export interface MarkerFilterContext {
  /** Isoloidun pätkän merkit (V259-jäsenyys, kutsuja laskee `markersForSegment`illa TAI antaa
   *  `segments` alla & tämä moduuli laskee). */
  isolatedMarkerIds?: Set<string>
}

/**
 * Merkin näkyvyys. Järjestys on merkitsevä: reittipiilotus on kova (V269), sen jälkeen
 * pehmeät rajaukset (isolointi, status) jotka noudattavat `dimLevel`iä.
 */
export function markerVisibility(
  marker: Pick<SignMarker, 'id' | 'status' | 'routeIds'>,
  f: MapFilter,
  ctx: MarkerFilterContext = {},
): Visibility {
  // V269: reitti pois → kaikki siihen ankkuroitu pois. Merkki ilman reittejä (esim. vapaasti
  // sijoitettu) ⊥ katoa reittisuodattimesta — sillä ⊥ ole reittiä jonka mukana kadota (V139-henki).
  if (f.visibleRouteIds !== undefined && marker.routeIds && marker.routeIds.length > 0) {
    if (!marker.routeIds.some(id => f.visibleRouteIds!.includes(id))) return 'hidden'
  }
  if (ctx.isolatedMarkerIds && !ctx.isolatedMarkerIds.has(marker.id)) return filteredOut(f)
  if (!f.markerStatuses.has(marker.status)) return filteredOut(f)
  return 'full'
}

export interface SegmentFilterContext {
  /** Saman vaiheen muut pätkät + merkit — tarvitaan tilan (`segmentLineState`) laskentaan.
   *  Kutsuja antaa jo phase-suodatetun joukon (V259: se ON kilpailijajoukko). */
  peers?: Segment[]
  markers?: SignMarker[]
  /** Valmiiksi laskettu tila — ohittaa laskennan (kutsupaikka joka laskee sen jo, ⊥ tuplatyötä). */
  state?: SegmentLineState
}

export function segmentVisibility(
  seg: Segment,
  f: MapFilter,
  ctx: SegmentFilterContext = {},
): Visibility {
  // V269: piilotetun reitin pätkä katoaa kokonaan — himmennys väittäisi että pätkä on siellä
  // missä ⊥ ole reittiä (B157). Reititön tehtävä (V139) läpäisee aina.
  if (!segmentVisibleOnRoutes(seg, f.visibleRouteIds)) return 'hidden'
  if (f.isolatedSegmentId && seg.id !== f.isolatedSegmentId) return filteredOut(f)
  const state = ctx.state ?? segmentLineState(getPhaseProgress(seg, ctx.markers ?? [], ctx.peers ?? []), seg.completed)
  if (!f.segmentStates.has(state)) return filteredOut(f)
  return 'full'
}

/** Isoloidun pätkän merkkijoukko — V259-jäsenyys, ⊥ omaa sääntöä. */
export function isolatedMarkerIds(
  f: MapFilter,
  segments: Segment[],
  markers: SignMarker[],
): Set<string> | undefined {
  if (!f.isolatedSegmentId) return undefined
  const seg = segments.find(s => s.id === f.isolatedSegmentId)
  if (!seg) return undefined
  const peers = segments.filter(s => s.phase === seg.phase)
  return new Set(markersForSegment(seg, markers, peers).map(m => m.id))
}

// ── Persistointi (V5-kuvio, V272) ────────────────────────────────────────────────────────────
// Suodatin persistoituu ∴ banneri on PAKOLLINEN: eilinen suodatin jonka syytä ⊥ näy luetaan
// kadonneena datana (B131-luokka). Vioittunut/vanha JSON → oletukset, ⊥ kaadu.

const LS_KEY = 'karttamaster-map-filter'

interface StoredFilter {
  visibleRouteIds?: string[]
  isolatedSegmentId?: string
  markerStatuses?: string[]
  segmentStates?: string[]
  dimLevel?: string
}

export function loadMapFilter(): MapFilter {
  const base = defaultMapFilter()
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LS_KEY)
  } catch {
    return base
  }
  if (!raw) return base
  let parsed: StoredFilter
  try {
    parsed = JSON.parse(raw) as StoredFilter
  } catch {
    return base
  }
  if (!parsed || typeof parsed !== 'object') return base

  const statuses = Array.isArray(parsed.markerStatuses)
    ? parsed.markerStatuses.filter((s): s is MarkerStatus => (ALL_MARKER_STATUSES as string[]).includes(s))
    : []
  const states = Array.isArray(parsed.segmentStates)
    ? parsed.segmentStates.filter((s): s is SegmentLineState => (ALL_SEGMENT_STATES as string[]).includes(s))
    : []

  return {
    visibleRouteIds: Array.isArray(parsed.visibleRouteIds)
      ? parsed.visibleRouteIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    isolatedSegmentId: typeof parsed.isolatedSegmentId === 'string' ? parsed.isolatedSegmentId : undefined,
    // V272: tyhjä joukko ⊥ ole laillinen tila ∴ vioittunut/tyhjä lista palautuu täydeksi.
    markerStatuses: statuses.length > 0 ? new Set(statuses) : base.markerStatuses,
    segmentStates: states.length > 0 ? new Set(states) : base.segmentStates,
    dimLevel: parsed.dimLevel === 'kevyt' || parsed.dimLevel === 'vahva' || parsed.dimLevel === 'piilota'
      ? parsed.dimLevel
      : base.dimLevel,
  }
}

export function saveMapFilter(f: MapFilter): void {
  const stored: StoredFilter = {
    visibleRouteIds: f.visibleRouteIds,
    isolatedSegmentId: f.isolatedSegmentId,
    markerStatuses: [...f.markerStatuses],
    segmentStates: [...f.segmentStates],
    dimLevel: f.dimLevel,
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stored))
  } catch {
    // Kiintiö täynnä / privaattitila: suodatin on näkymätila ⊥ dataa — hiljainen epäonnistuminen
    // on oikein, sillä UI näyttää tilan silti & seuraava lataus alkaa oletuksista.
  }
}
