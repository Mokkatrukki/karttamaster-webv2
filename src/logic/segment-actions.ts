import { isTerminal } from './marker-status'
import type { Segment } from './segments'
import type { SignMarker } from './types'

// V28: atomic bulk-collect — all non-terminal markers in segment → kerätty
// Returns updated copies (caller is responsible for persisting)
export function bulkCollect(
  _segment: Segment,
  markers: SignMarker[],
): SignMarker[] {
  const targets = markers.filter(m => !isTerminal(m.status))
  if (targets.length === 0) return []
  return targets.map(m => ({ ...m, status: 'kerätty' as const }))
}

// T414/V305: merkkien liittäminen tehtävään. YKSI apuri kolmelle kutsupaikalle (järjestäjän
// merkkijono T415, talkoolaisen kartta T416, serverin unioni V307) — inline-kopio ⊥ ole
// hyväksyttävä (V299-kuvio). Palauttaa KOPION, kutsuja persistoi (bulkCollectin kuvio).
//
// Operaatio on ADDITIIVINEN: `segment-membership.ts` palauttaa linkatulle `true` ENNEN
// geometriatarkistusta ∴ sama apuri kattaa reitittömän (V139) JA reitillisen "automaattisesti
// poimivan" pätkän — linkki tulee poimintojen PÄÄLLE, ⊥ tilalle. Toisen pätkän merkkejä ⊥
// kosketa (V291).
export function addMarkersToSegment(segment: Segment, markerIds: string[]): Segment {
  const existing = segment.linkedMarkerIds ?? []
  const fresh = markerIds.filter(id => !existing.includes(id))
  const excluded = segment.excludedMarkerIds ?? []
  // V305: sama id ⊥ voi olla yhtä aikaa linkattu & poissuljettu — ristiriita poistetaan
  // RAKENTEESTA (lisäys pudottaa exclude-listalta), ⊥ ratkaista lukujärjestyksellä.
  const nextExcluded = excluded.filter(id => !markerIds.includes(id))
  // Idempotenssi: ⊥ uutta id:tä & ⊥ exclude-osumaa → SAMA olio ∴ kutsuja voi ohittaa syncin.
  if (fresh.length === 0 && nextExcluded.length === excluded.length) return segment
  return {
    ...segment,
    linkedMarkerIds: [...existing, ...fresh],
    excludedMarkerIds: nextExcluded.length > 0 ? nextExcluded : undefined,
  }
}

// T414/V305: käänteinen operaatio — merkki POIS tehtävästä. Kirjoittaa `excludedMarkerIds`in
// (T360:n kenttä, jo kannassa) koska geometrinen poiminta löytäisi merkin uudelleen ∴ pelkkä
// `linkedMarkerIds`istä poistaminen ⊥ riitä reitilliselle pätkälle. Peili: poisto pudottaa
// linkin, jotta sama id ⊥ jää molemmille listoille.
export function removeMarkersFromSegment(segment: Segment, markerIds: string[]): Segment {
  const linked = (segment.linkedMarkerIds ?? []).filter(id => !markerIds.includes(id))
  const excluded = segment.excludedMarkerIds ?? []
  const fresh = markerIds.filter(id => !excluded.includes(id))
  if (fresh.length === 0 && linked.length === (segment.linkedMarkerIds ?? []).length) return segment
  return {
    ...segment,
    linkedMarkerIds: linked.length > 0 ? linked : undefined,
    excludedMarkerIds: [...excluded, ...fresh],
  }
}
