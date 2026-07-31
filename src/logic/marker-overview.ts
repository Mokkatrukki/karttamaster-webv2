import type { MarkerStatus, SignMarker } from './types'
import type { Segment } from './segments'
import { segmentDisplayName } from './segment-name'
import { resolveSegmentMarkers } from './segment-membership'
import { orderMarkersInSegment } from './segment-order'
import { markerVisibility } from './map-filter'
import type { MapFilter, MarkerFilterContext } from './map-filter'

// T400/V290: järjestäjän merkkijono — "mitkä merkit jäivät asettamatta ja miltä pätkiltä".
//
// Tämä moduuli KOOSTAA & JÄRJESTÄÄ. Se ⊥ päätä näkyvyyttä (`map-filter` V271), ⊥ ratkaise
// jäsenyyttä (`segment-membership` V259) eikä keksi km-akselia (`segment-order` V237/V238).
// Oma sääntö tänne olisi B114–B129-perheen 11. esiintymä.
//
// ⊥ Leafletia, ⊥ DOM:ia → Vitest-pure.

/** Ryhmäavain. Sama kolmijako kuin talkoolaisen koti-tabissa (V184) ∴ sama sana tarkoittaa
 *  samaa asiaa molemmille rooleille — + `suodatettu` joka on TÄMÄN näkymän oma (V290). */
export type OverviewGroupKey = 'asettamatta' | 'asetetut' | 'ei_tarpeen' | 'suodatettu'

/** Lookup ⊥ if-ketju (V91-kuvio): ryhmien järjestys & jäsenyys luetaan tästä taulusta. */
const GROUP_DEFS: ReadonlyArray<{ key: OverviewGroupKey; title: string; statuses: MarkerStatus[] }> = [
  { key: 'asettamatta', title: 'Asettamatta', statuses: ['suunniteltu'] },
  { key: 'asetetut', title: 'Asetetut', statuses: ['asetettu', 'tarkistettu', 'kerätty'] },
  { key: 'ei_tarpeen', title: 'Ei tarpeen', statuses: ['ei_tarpeen'] },
]

const SUODATETTU_TITLE = 'Suodattimen ulkopuolella'

export interface OverviewSubgroup {
  /** `null` = merkki ⊥ kuulu yhteenkään pätkään. Oma alaryhmä ∴ ⊥ katoa hiljaa (V290/V238-kuvio). */
  segment: Segment | null
  markers: SignMarker[]
}

export interface OverviewGroup {
  key: OverviewGroupKey
  title: string
  /** Merkkien määrä koko ryhmässä (alaryhmien summa) — otsikon laskuri. */
  count: number
  subgroups: OverviewSubgroup[]
}

export interface OverviewInput {
  markers: SignMarker[]
  /** VAIN aktiivisen vaiheen pätkät (V290/V91). Kutsuja rajaa `getSegmentsForPhase`illa —
   *  `resolveSegmentMarkers` ryhmittelee vaiheen vielä itsekin ∴ ylimääräinen vaihe ⊥ sotke
   *  jäsenyyttä, mutta se toisi listaan pätkäryhmiä joita näkymä ⊥ näytä. */
  segments: Segment[]
  filter: MapFilter
  ctx?: MarkerFilterContext
}

/**
 * Ryhmittely status → pätkä. Palauttaa AINA ryhmät `GROUP_DEFS`-järjestyksessä + `suodatettu`
 * viimeisenä; tyhjät ryhmät karsitaan (tyhjä otsikko on kohinaa, ⊥ tietoa).
 *
 * Jokainen merkki esiintyy TASAN kerran koko rakenteessa: suodatus ratkaistaan ensin
 * (`markerVisibility` ≠ 'full' → `suodatettu`), sitten status-ryhmä, sitten omistaja.
 */
export function groupMarkersForOverview(input: OverviewInput): OverviewGroup[] {
  const { markers, segments, filter, ctx = {} } = input

  // Omistaja per merkki — V259-jäsenyys, ⊥ omaa sääntöä. Käänteinen indeksi ∴ O(1) lookup.
  const ownerOf = new Map<string, Segment>()
  const bySegId = new Map(segments.map(s => [s.id, s]))
  for (const [segId, list] of resolveSegmentMarkers(segments, markers)) {
    const seg = bySegId.get(segId)
    if (!seg) continue
    for (const m of list) ownerOf.set(m.id, seg)
  }

  const statusGroup = new Map<MarkerStatus, OverviewGroupKey>()
  for (const def of GROUP_DEFS) for (const s of def.statuses) statusGroup.set(s, def.key)

  // key → (segmentId | '' ) → merkit
  const buckets = new Map<OverviewGroupKey, Map<string, SignMarker[]>>()
  const put = (key: OverviewGroupKey, segId: string, m: SignMarker): void => {
    let bySeg = buckets.get(key)
    if (!bySeg) { bySeg = new Map(); buckets.set(key, bySeg) }
    const list = bySeg.get(segId)
    if (list) list.push(m)
    else bySeg.set(segId, [m])
  }

  for (const m of markers) {
    // V290: suodattimen rajaama merkki ⊥ katoa listalta — se siirtyy omaan ryhmäänsä.
    // 'dim' lasketaan mukaan: kartta on jo de-emphasoinut sen ∴ lista ⊥ saa väittää sitä
    // tavalliseksi. 'hidden' & 'dim' ovat molemmat "⊥ täysin näkyvissä".
    const vis = markerVisibility(m, filter, ctx)
    const key: OverviewGroupKey = vis === 'full' ? (statusGroup.get(m.status) ?? 'asetetut') : 'suodatettu'
    put(key, ownerOf.get(m.id)?.id ?? '', m)
  }

  const out: OverviewGroup[] = []
  const emit = (key: OverviewGroupKey, title: string): void => {
    const bySeg = buckets.get(key)
    if (!bySeg || bySeg.size === 0) return
    const subgroups: OverviewSubgroup[] = []
    let count = 0
    for (const [segId, list] of bySeg) {
      const segment = segId === '' ? null : (bySegId.get(segId) ?? null)
      // V238: "ei reitillä" -merkit ryhmän ALKUUN, molemmat omalla akselillaan.
      const ordered = orderMarkersInSegment(list, segment)
      const markersOrdered = [...ordered.offRoute, ...ordered.onRoute]
      count += markersOrdered.length
      subgroups.push({ segment, markers: markersOrdered })
    }
    // Pätkät nimen mukaan; omistajaton ryhmä VIIMEISENÄ (se on jäännös ⊥ pätkä).
    subgroups.sort((a, b) => {
      if (a.segment === null) return 1
      if (b.segment === null) return -1
      return (a.segment.displayName ?? '').localeCompare(b.segment.displayName ?? '', 'fi')
    })
    out.push({ key, title, count, subgroups })
  }

  for (const def of GROUP_DEFS) emit(def.key, def.title)
  emit('suodatettu', SUODATETTU_TITLE)
  return out
}

/** Alaryhmän otsikko. Omistajaton = eksplisiittinen teksti ⊥ tyhjä rivi (V290). */
export function subgroupTitle(sub: OverviewSubgroup): string {
  if (sub.segment === null) return 'Ei pätkää'
  return sub.segment ? segmentDisplayName(sub.segment) : 'Nimetön pätkä'
}
