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
  entry: {
    markerId: string
    action: AuditAction
    session: SessionData
    payload?: unknown
    // T316/V227: mutatoitu merkki. Annettuna pätkä JOHDETAAN siitä — sessio ei ole luotettava
    // lähde, koska yleissalasana-sessio on kooditon (B124). Puuttuu → session koodi (legacy-polku).
    marker?: OwnershipCandidate
  },
): void {
  // T316/V227: pätkä johdetaan merkistä, MUTTA session koodi voittaa kun se osuu — päällekkäisillä
  // pätkillä merkki kuuluu useaan, ja tekijän oma pätkä on niistä oikea vastaus. Kooditon sessio
  // (yleissalasana, B124) putoaa johdantoon, joka on koko korjauksen pointti.
  const ownCode = entry.session.talkoolainen_code
  const ownMatch = ownCode != null && entry.marker != null
    && markerInOwnSegment(ownSegments(db, entry.session), entry.marker)
  const segmentCode = ownMatch
    ? ownCode
    : (entry.marker ? segmentCodeForMarker(db, entry.marker) : null) ?? ownCode
  db.run(
    'INSERT INTO marker_audit (id, marker_id, action, actor, actor_role, segment_code, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      randomUUID(),
      entry.markerId,
      entry.action,
      entry.session.display_name,
      entry.session.role,
      segmentCode,
      new Date().toISOString(),
      entry.payload !== undefined ? JSON.stringify(entry.payload) : null,
    ],
  )
}

export interface OwnerSegRow {
  route_ids: string | null
  // T299/V211: mitä reittiä start_dist/end_dist mittaavat. NULL = legacy → route_ids[0].
  primary_route_id: string | null
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
      'SELECT route_ids, primary_route_id, start_dist, end_dist, linked_marker_ids, marker_type_filter FROM segments WHERE UPPER(assigned_code) = ?',
    )
    .all(session.talkoolainen_code.toUpperCase())
}

export interface OwnershipCandidate {
  id?: string // olemassa oleva merkki (PUT/DELETE); uudella (POST) puuttuu → linked ei voi täsmätä
  routeIds: string[]
  distFromStart: number
  // T300/V212/V213: km per reitti. Puuttuu (legacy/vanha client) → distFromStart-fallback,
  // jolloin käytös on täsmälleen entinen. Server ⊥ voi laskea tätä itse: reittigeometriaa ei
  // ole kannassa (V149) ∴ arvo luetaan clientilta samalla luottamustasolla kuin distFromStart.
  distByRoute?: Record<string, number[]> | null
  templateId?: string | null
}

// T300/V212/V213: merkin km SILLÄ reitillä jota pätkän km-väli mittaa. Tämä on se funktio
// jonka ANSIOSTA backend ja frontend ovat samaa mieltä pätkäjäsenyydestä (V213/B100-oppi).
// T302/V214: LISTA, ei luku — lenkillä sama reitti ohittaa merkin kahdesti (km 12 JA km 47).
// Riittää että yksi ehdokas osuu pätkän väliin, muuten backend hylkäisi merkin jonka
// frontend näyttää pätkässä (V213).
function distsOnSegmentAxis(marker: OwnershipCandidate, segRoutes: string[], primary: string | null): number[] {
  const axis = primary ?? segRoutes[0]
  if (axis != null) {
    const d = marker.distByRoute?.[axis]
    if (d !== undefined && d.length > 0) return d
  }
  return [marker.distFromStart]
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
    const start = seg.start_dist - RANGE_EPS_M
    const end = seg.end_dist + RANGE_EPS_M
    const routeMatch =
      marker.routeIds.some((r) => segRoutes.includes(r)) &&
      distsOnSegmentAxis(marker, segRoutes, seg.primary_route_id).some(d => d >= start && d <= end)
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

interface CodedSegRow extends OwnerSegRow {
  assigned_code: string
}

// T316/V227: mille pätkälle merkki kuuluu — audit-rivin `segment_code`. Käänteinen kysymys
// markerInOwnSegmentille: siinä pätkäjoukko on tiedossa (session koodi) ja kysytään osuuko merkki;
// tässä merkki on tiedossa ja etsitään pätkä. SAMA unioni (V154) ratkaisee molemmat ∴ loki ja
// 403-portti eivät voi olla eri mieltä jäsenyydestä (B100-oppi).
//
// V139-poikkeus: geometriaton pätkä (route_ids/start/end NULL) tuottaa markerInOwnSegmentissa
// tosi MILLE TAHANSA merkille — se on oikein kun pätkä on jo tiedetty omaksi, mutta täällä se
// liittäisi jokaisen merkin ensimmäiseen geometriattomaan pätkään. ∴ geometriaton pätkä kelpaa
// vain eksplisiittisellä liitoksella (linked_marker_ids / marker_type_filter).
export function segmentCodeForMarker(db: Database, marker: OwnershipCandidate): string | null {
  const segs = db
    .query<CodedSegRow, []>(
      "SELECT assigned_code, route_ids, primary_route_id, start_dist, end_dist, linked_marker_ids, marker_type_filter FROM segments WHERE assigned_code IS NOT NULL AND assigned_code <> ''",
    )
    .all()

  for (const seg of segs) {
    const geometryless = seg.route_ids == null || seg.start_dist == null || seg.end_dist == null
    if (geometryless) {
      const linked = marker.id && seg.linked_marker_ids
        ? (JSON.parse(seg.linked_marker_ids) as string[]).includes(marker.id)
        : false
      const typeMatch = marker.templateId != null && seg.marker_type_filter === marker.templateId
      if (linked || typeMatch) return seg.assigned_code
      continue
    }
    if (markerInOwnSegment([seg], marker)) return seg.assigned_code
  }
  return null
}
