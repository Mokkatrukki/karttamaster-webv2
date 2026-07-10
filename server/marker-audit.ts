import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { SessionData } from './types'

// T226/V152: audit-action-enum. add=luonti (undo=DELETE, ei ennen-tilaa),
// move=siirto (ennen-tila: lat/lon/dist/route_ids), status=tilamuutos (ennen-tila: status),
// remove=poisto (ennen-tila: koko rivi, ei V153-restorea mutta audit-näkyvyys).
export type AuditAction = 'add' | 'move' | 'remove' | 'status'

// V149: ε-toleranssi GPS-driftille — pätkän reunalle laillisesti sijoitettu merkki EI saa 403:a.
export const RANGE_EPS_M = 50

// T226/V152: kirjaa yksi audit-rivi. KUTSUTTAVA saman db.transaction()-lohkon SISÄLLÄ kuin
// itse mutaatio → kirjaus+mutaatio committautuvat atomisesti tai ei kumpikaan (V120-linja).
export function logMarkerAudit(
  db: Database,
  entry: { markerId: string; action: AuditAction; session: SessionData; payload?: unknown },
): void {
  db.run(
    'INSERT INTO marker_audit (id, marker_id, action, actor, actor_role, segment_code, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      randomUUID(),
      entry.markerId,
      entry.action,
      entry.session.display_name,
      entry.session.role,
      entry.session.talkoolainen_code,
      new Date().toISOString(),
      entry.payload !== undefined ? JSON.stringify(entry.payload) : null,
    ],
  )
}

export interface OwnerSegRow {
  route_ids: string | null
  start_dist: number | null
  end_dist: number | null
  linked_marker_ids: string | null
  marker_type_filter: string | null
}

// Talkoolaisen omat pätkät (assigned_code = session.talkoolainen_code). Tyhjä jos ei koodia/rooli väärä.
export function ownSegments(db: Database, session: SessionData): OwnerSegRow[] {
  if (session.role !== 'talkoolainen' || !session.talkoolainen_code) return []
  return db
    .query<OwnerSegRow, [string]>(
      'SELECT route_ids, start_dist, end_dist, linked_marker_ids, marker_type_filter FROM segments WHERE UPPER(assigned_code) = ?',
    )
    .all(session.talkoolainen_code.toUpperCase())
}

export interface OwnershipCandidate {
  id?: string // olemassa oleva merkki (PUT/DELETE); uudella (POST) puuttuu → linked ei voi täsmätä
  routeIds: string[]
  distFromStart: number
  templateId?: string | null
}

// KANONINEN ownership-sääntö — peilaa frontendin resolveTaskMarkers-unionia (task-markers.ts):
//   reittifiltteri (route∩ ∧ dist∈[start−ε,end+ε]) ∪ linked_marker_ids ∪ marker_type_filter.
// Aiempi backend tarkisti VAIN reittirangen → link/typeFilter-osuma-merkit saivat 403:n statusta
// muuttaessa vaikka frontend näytti ne pätkässä (bugi: "Aseta" herjaa). Yksi totuus molemmille kerroksille.
export function markerInOwnSegment(segs: OwnerSegRow[], marker: OwnershipCandidate): boolean {
  if (segs.length === 0) return false
  return segs.some((seg) => {
    // V139: reititön pätkä (ei route/dist-geometriaa) → salli jos assignattu seg olemassa.
    if (seg.route_ids == null || seg.start_dist == null || seg.end_dist == null) return true
    const segRoutes = JSON.parse(seg.route_ids) as string[]
    const routeMatch =
      marker.routeIds.some((r) => segRoutes.includes(r)) &&
      marker.distFromStart >= seg.start_dist - RANGE_EPS_M &&
      marker.distFromStart <= seg.end_dist + RANGE_EPS_M
    if (routeMatch) return true
    // Eksplisiittinen liitos (poimittu kartalta) — vain olemassa olevalle merkille.
    if (marker.id && seg.linked_marker_ids) {
      const linked = JSON.parse(seg.linked_marker_ids) as string[]
      if (linked.includes(marker.id)) return true
    }
    // Dynaaminen tyyppisuodatin (V143 templateId-täsmäys, EI muuttuva label).
    if (marker.templateId != null && seg.marker_type_filter != null && seg.marker_type_filter === marker.templateId) {
      return true
    }
    return false
  })
}
