import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { SessionData } from './types'
import { distanceToTrackM, parseTrack } from './track-geo'

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
  // T360/V259: eksklusiivisuus vaatii identiteetin & vaiheen — "kuka omistaa" ratkeaa vasta
  // kun kilpailijat tunnetaan, ja kilpailu käydään vaiheen SISÄLLÄ (V91).
  id: string
  phase: string
  route_ids: string | null
  // T299/V211: mitä reittiä start_dist/end_dist mittaavat. NULL = legacy → route_ids[0].
  primary_route_id: string | null
  start_dist: number | null
  end_dist: number | null
  linked_marker_ids: string | null
  excluded_marker_ids: string | null
  marker_type_filter: string | null
  // T360/V258: pätkän oma jälki (JSON). NULL = legacy → km-haara (V260).
  track: string | null
}

const SEG_COLS =
  'id, phase, route_ids, primary_route_id, start_dist, end_dist, linked_marker_ids, excluded_marker_ids, marker_type_filter, track'

/**
 * T360/V259/V260: KAIKKI pätkät — eksklusiivisuuden ehdokasjoukko. `ownSegments` ⊥ riitä:
 * se vastaa "kuuluuko merkki johonkin MINUN pätkääni", mutta lähin-voittaa-sääntö ⊥ ratkea
 * ilman kilpailijoita (ck:review H-5). `segments`-taulussa on kaikki rivit ∴ tämä on KYSELY,
 * ⊥ arkkitehtuurimuutos.
 */
export function allSegments(db: Database): OwnerSegRow[] {
  return db.query<OwnerSegRow, []>(`SELECT ${SEG_COLS} FROM segments`).all()
}

// Talkoolaisen omat pätkät (assigned_code = session.talkoolainen_code). Tyhjä jos ei koodia/rooli väärä.
export function ownSegments(db: Database, session: SessionData): OwnerSegRow[] {
  if (session.role !== 'talkoolainen' || !session.talkoolainen_code) return []
  return db
    .query<OwnerSegRow, [string]>(
      `SELECT ${SEG_COLS} FROM segments WHERE UPPER(assigned_code) = ?`,
    )
    .all(session.talkoolainen_code.toUpperCase())
}

export interface OwnershipCandidate {
  // T360/V259: lat/lon on jäljen etäisyyslaskun ainoa syöte. Puuttuu (vanha client) → serveri
  // putoaa km-haaraan ∴ käytös on entinen, ⊥ hylkäystä (V260-välitila).
  lat?: number
  lon?: number
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

// T360/V259: onko merkki eksplisiittisesti liitetty/suodatettu tähän pätkään (⊥ geometriaa).
function isExplicitMember(seg: OwnerSegRow, marker: OwnershipCandidate): boolean {
  if (marker.id && seg.linked_marker_ids) {
    const linked = JSON.parse(seg.linked_marker_ids) as string[]
    if (linked.includes(marker.id)) return true
  }
  return (
    marker.templateId != null &&
    seg.marker_type_filter != null &&
    seg.marker_type_filter === marker.templateId
  )
}

function isExcluded(seg: OwnerSegRow, marker: OwnershipCandidate): boolean {
  if (!marker.id || !seg.excluded_marker_ids) return false
  return (JSON.parse(seg.excluded_marker_ids) as string[]).includes(marker.id)
}

// KANONINEN km-sääntö (V260-legacy-haara) — peilaa frontendin resolveTaskMarkers-unionia:
//   reittifiltteri (route∩ ∧ dist∈[start−ε,end+ε]) ∪ linked_marker_ids ∪ marker_type_filter.
function matchesLegacyRule(seg: OwnerSegRow, marker: OwnershipCandidate): boolean {
  // V139: reititön pätkä (ei route/dist-geometriaa) → salli jos assignattu seg olemassa.
  if (seg.route_ids == null || seg.start_dist == null || seg.end_dist == null) return true
  const segRoutes = JSON.parse(seg.route_ids) as string[]
  const start = seg.start_dist - RANGE_EPS_M
  const end = seg.end_dist + RANGE_EPS_M
  const routeMatch =
    marker.routeIds.some((r) => segRoutes.includes(r)) &&
    distsOnSegmentAxis(marker, segRoutes, seg.primary_route_id).some(d => d >= start && d <= end)
  if (routeMatch) return true
  return isExplicitMember(seg, marker)
}

/**
 * T360/V259: MITKÄ pätkät omistavat merkin. Peilaa clientin `resolveSegmentMarkers`ia
 * (`src/logic/segment-membership.ts`) — jos muutat toista, muuta molempia (V261-oppi).
 *
 * Jäljelliset pätkät kilpailevat vaiheen sisällä: eksplisiittinen tahto voittaa geometrian,
 * muuten LÄHIN jälki voittaa & tasapeli ratkeaa id:llä. Jäljetön pätkä (V260-välitila) pitää
 * entisen km-sääntönsä ∴ migraation aikana kumpikin kerros käyttäytyy kuten ennen.
 */
export function ownerSegmentIds(allSegs: OwnerSegRow[], marker: OwnershipCandidate): Set<string> {
  const owners = new Set<string>()
  const byPhase = new Map<string, OwnerSegRow[]>()

  for (const seg of allSegs) {
    const track = parseTrack(seg.track)
    if (track === null || marker.lat === undefined || marker.lon === undefined) {
      // V260: jäljetön pätkä (tai jäljetön merkki-payload) → entinen per-pätkä-sääntö.
      if (!isExcluded(seg, marker) && matchesLegacyRule(seg, marker)) owners.add(seg.id)
      continue
    }
    const list = byPhase.get(seg.phase)
    if (list) list.push(seg)
    else byPhase.set(seg.phase, [seg])
  }

  for (const phaseSegs of byPhase.values()) {
    const explicit = phaseSegs.filter(s => !isExcluded(s, marker) && isExplicitMember(s, marker))
    if (explicit.length > 0) {
      for (const seg of explicit) owners.add(seg.id)
      continue
    }
    let winner: OwnerSegRow | null = null
    let best = Infinity
    for (const seg of phaseSegs) {
      if (isExcluded(seg, marker)) continue
      const segRoutes = seg.route_ids ? (JSON.parse(seg.route_ids) as string[]) : []
      // V25: ehdokkuus = pätkän reitti kulkee merkin ohi. Scope, ⊥ jäsenyyssääntö.
      if (!marker.routeIds.some(r => segRoutes.includes(r))) continue
      const d = distanceToTrackM(parseTrack(seg.track)!, marker.lat!, marker.lon!)
      if (d < best || (d === best && winner !== null && seg.id < winner.id)) {
        best = d
        winner = seg
      }
    }
    if (winner) owners.add(winner.id)
  }

  return owners
}

/**
 * Onko merkki jossakin NÄISTÄ pätkistä — 403-portin & audit-lokin yhteinen sääntö (V213/B100).
 *
 * `allSegs` = eksklusiivisuuden ehdokasjoukko (`allSegments(db)`). Ilman sitä kilpailijoita ⊥ ole
 * ∴ oletus on `segs` itse: sääntö degradoituu "omat pätkät kilpailevat keskenään" -tilaan, joka on
 * SALLIVA ⊥ hylkäävä — portti ⊥ saa koskaan hylätä kirjoitusta siksi että kutsuja unohti joukon.
 */
export function markerInOwnSegment(
  segs: OwnerSegRow[],
  marker: OwnershipCandidate,
  allSegs: OwnerSegRow[] = segs,
): boolean {
  if (segs.length === 0) return false
  const owners = ownerSegmentIds(allSegs, marker)
  return segs.some(seg => owners.has(seg.id))
}

interface CodedSegRow extends OwnerSegRow {
  assigned_code: string | null
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
  // T360/V259: omistajuus ratkeaa KAIKKIEN pätkien kesken (lähin jälki voittaa) ∴ ehdokasjoukko
  // on koko taulu, ⊥ vain koodilliset. Vasta voittajista poimitaan koodillinen — muuten
  // koodillinen kaukainen pätkä voittaisi koodittoman lähemmän & loki valehtelisi tekijästä.
  const all = db.query<CodedSegRow, []>(`SELECT ${SEG_COLS}, assigned_code FROM segments`).all()
  const owners = ownerSegmentIds(all, marker)

  for (const seg of all) {
    if (!owners.has(seg.id)) continue
    if (seg.assigned_code == null || seg.assigned_code === '') continue
    // V139-poikkeus: geometriaton pätkä tuottaa `matchesLegacyRule`ssa toden MILLE TAHANSA
    // merkille — se on oikein kun pätkä on jo tiedetty omaksi, mutta täällä se liittäisi
    // jokaisen merkin ensimmäiseen geometriattomaan pätkään ∴ vain eksplisiittinen liitos kelpaa.
    const geometryless = seg.route_ids == null || seg.start_dist == null || seg.end_dist == null
    if (geometryless && !isExplicitMember(seg, marker)) continue
    return seg.assigned_code
  }
  return null
}
