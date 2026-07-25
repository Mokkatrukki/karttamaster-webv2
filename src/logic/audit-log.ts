// T320: aktiviteettilokin puhdas logiikka — muotoilu, suodatus, poikkeaman laskenta.
// EI DOM:ia, EI Leafletia, EI fetchiä (verkko on audit-sync.ts:n vastuu) → Vitest-pure.
//
// Tausta 2026-07-25: 14 merkkiä siirtyi 1–7 km sivuun eikä sitä huomannut kukaan ennen kuin
// kentällä ihmeteltiin. Poikkeama metreinä on se luku joka tekee sotkusta näkyvän listassa.
import { haversineDistance } from './bearing'
import type { AuditEntry, AuditAction } from './audit-sync'

// Yksi totuus verbeille — myös pätkämodaali (segment-details-modal.ts) lukee tämän.
export const ACTION_VERB: Record<AuditAction, string> = {
  add: 'lisäsi merkin',
  move: 'siirsi merkkiä',
  remove: 'poisti merkin',
  status: 'muutti tilan',
}

export interface AuditDescription {
  verb: string
  actorLabel: string
  timeLabel: string
  segmentLabel: string
}

export function describeAuditEntry(entry: AuditEntry): AuditDescription {
  return {
    verb: ACTION_VERB[entry.action] ?? entry.action,
    actorLabel: entry.actor?.trim() || 'tuntematon',
    timeLabel: formatTime(entry.created_at),
    // B124-legacy: 263 riviä ilman pätkäkoodia. Näytetään rehellisesti, ei arvata takautuvasti.
    segmentLabel: entry.segment_code ?? 'pätkä tuntematon',
  }
}

// "2026-07-25T07:30:44.657Z" → "25.7. 07:30". Päivä mukaan: incidentin selvittelyssä
// pelkkä kellonaika ei riitä kun rivejä on monelta päivältä.
export function formatTime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return iso
  const [, , month, day, hh, mm] = m
  return `${Number(day)}.${Number(month)}. ${hh}:${mm}`
}

export interface MarkerPosition { lat: number; lon: number }

interface MovePayload { lat: number; lon: number }

function movePayload(entry: AuditEntry): MovePayload | null {
  const p = entry.payload as Record<string, unknown> | null
  if (p == null || typeof p !== 'object') return null
  if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null
  return { lat: p.lat, lon: p.lon }
}

// Kuinka kauas merkki siirtyi tästä rivistä nykyiseen sijaintiinsa. null = ei laskettavissa
// (ei move-rivi, vajaa payload, tai merkkiä ei enää ole) — kutsuja näyttää tyhjän, ei nollaa:
// "0 m" valehtelisi "ei liikkunut".
export function moveDeviationM(entry: AuditEntry, current: MarkerPosition | undefined): number | null {
  if (entry.action !== 'move' || !current) return null
  const before = movePayload(entry)
  if (!before) return null
  return Math.round(haversineDistance(before, current))
}

export interface AuditFilters {
  role?: string
  actor?: string
  segmentCode?: string
  since?: string
  until?: string
}

export function filterEntries(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
  return entries.filter((e) => {
    if (filters.role && e.actor_role !== filters.role) return false
    if (filters.actor && e.actor !== filters.actor) return false
    if (filters.segmentCode && (e.segment_code ?? '') !== filters.segmentCode) return false
    if (filters.since && e.created_at < filters.since) return false
    if (filters.until && e.created_at > filters.until) return false
    return true
  })
}

// Suodatinvalikkojen sisältö luetaan datasta — kiinteä lista vanhenisi heti kun uusi
// talkoolainen kirjautuu (T317).
export function distinctActors(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.actor).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, 'fi'))
}

export function distinctSegments(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.segment_code).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'fi'))
}

export interface MarkerChain {
  markerId: string
  entries: AuditEntry[]
}

// Saman merkin rivit yhteen, vanhin ensin — sama ketjuanalyysi jonka runbook tekee käsin
// (docs/RUNBOOK-merkkien-palautus.md). Ketju paljastaa sarjan: kuka siirsi, kuka korjasi perään.
export function groupByMarker(entries: AuditEntry[]): MarkerChain[] {
  const byId = new Map<string, AuditEntry[]>()
  for (const e of entries) {
    const list = byId.get(e.marker_id)
    if (list) list.push(e)
    else byId.set(e.marker_id, [e])
  }
  return [...byId.entries()].map(([markerId, list]) => ({
    markerId,
    entries: [...list].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}
