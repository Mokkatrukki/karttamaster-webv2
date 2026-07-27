import type { SignMarker, MarkerStatus } from './types'
import { resolveTaskMarkers } from './task-markers'
import { genId } from './uid'

export interface EquipmentItem {
  name: string
  count: number
}

// V139: reitilliset kentät VALINNAISIA. Reitillinen tehtävä = kaikki kolme annettu (lineaarinen
// reittipätkä); reititön tehtävä = kentät puuttuvat (aluetehtävä: maali/keräysalue).
export interface Segment {
  id: string
  routeIds?: string[]
  // T299/V211/B114: MITÄ reittiä `startDist`/`endDist` mittaavat. `routeIds` kertoo vain
  // jäsenyyden (jaettu osuus, V25) — se EI kelpaa km-lähteeksi, koska sama fyysinen kohta on
  // eri km eri reiteillä. Puuttuu legacy-pätkiltä → `segmentPrimaryRouteId` palauttaa routeIds[0].
  primaryRouteId?: string
  startDist?: number
  endDist?: number
  linkedMarkerIds?: string[]   // V140: eksplisiittisesti liitetyt merkit (poimittu kartalta)
  markerTypeFilter?: string    // V140/V143: dynaaminen tyyppisuodatin (templateId-osumat)
  assignedCode?: string
  // T297/V209: URL-slug — ∀ pätkällä heti luonnista, ei vaadi "jaa linkki" -assignia.
  // Regeneroituu kun displayName muuttuu; vanha slug kuolee (⊥ alias, V209).
  slug?: string
  displayName?: string
  description?: string
  equipment: EquipmentItem[]
  phase: 'asettaminen' | 'tarkastus' | 'purku'
  inspected?: boolean
  inspectionNote?: string
  // T230: talkoolaisen eksplisiittinen "pätkä valmiiksi" -signaali asettaminen/purku-vaiheelle.
  // Eri kuin merkkimatematiikka (getPhaseProgress) — talkoolainen ilmoittaa "oma osuus tehty".
  completed?: boolean
}

export type SegmentStore = Map<string, Segment>

export function createSegmentStore(): SegmentStore {
  return new Map()
}

// V139: validoi V11 (startDist<endDist) + V25 (routeIds non-empty) VAIN kun reitilliset kentät
// annettu. Reititön tehtävä (kentät puuttuvat) ohittaa route-validoinnit laillisesti.
function validateRouteFields(
  seg: Pick<Segment, 'routeIds' | 'startDist' | 'endDist' | 'primaryRouteId'>,
): void {
  if (seg.startDist !== undefined && seg.endDist !== undefined && seg.startDist >= seg.endDist) {
    throw new Error(`V11: startDist (${seg.startDist}) must be < endDist (${seg.endDist})`)
  }
  if (seg.routeIds !== undefined && seg.routeIds.length === 0) {
    throw new Error('V25: routeIds must not be empty')
  }
  // T299/V211: primary ! kuulua jäsenlistaan — muuten km viittaa reittiin jota pätkä ei kata.
  // Puuttuva primary on laillinen (legacy) — vain ristiriitainen on virhe.
  if (
    seg.primaryRouteId !== undefined &&
    seg.routeIds !== undefined &&
    !seg.routeIds.includes(seg.primaryRouteId)
  ) {
    throw new Error(
      `V211: primaryRouteId (${seg.primaryRouteId}) must be one of routeIds (${seg.routeIds.join(',')})`,
    )
  }
}

// T299/V211: kanoninen "mitä reittiä pätkän km:t mittaavat". Legacy-pätkä ilman kenttää →
// routeIds[0] (sama kuin ennen T299:ää: ensimmäinen oli käytännössä klikkijärjestyksen primary).
export function segmentPrimaryRouteId(
  seg: Pick<Segment, 'primaryRouteId' | 'routeIds'>,
): string | undefined {
  return seg.primaryRouteId ?? seg.routeIds?.[0]
}

// T297/V209/V191: slug-avaruus = kaikkien pätkien slugit + legacy-assignedCodet (vanhat
// jaetut linkit elävät assignedCoden varassa) — uusi slug ei saa varastaa kumpaakaan.
// exceptId: nimenmuutoksessa oma vanha slug ei blokkaa (muuten "Pätkä 1" → "patka-1-2").
function takenSlugs(store: SegmentStore, exceptId?: string): string[] {
  const out: string[] = []
  for (const seg of store.values()) {
    if (seg.id === exceptId) continue
    if (seg.slug) out.push(seg.slug)
    if (seg.assignedCode) out.push(seg.assignedCode)
  }
  return out
}

export function createSegment(
  store: SegmentStore,
  data: Omit<Segment, 'id'>,
  id?: string,
): Segment {
  validateRouteFields(data)
  const segment: Segment = { id: id ?? genId(), ...data }
  // T297/V209/B113: slug ∀ pätkälle heti — jakamatonkin pätkä avattavissa `/s/<slug>`.
  // V210: EI luo talkoolainen_codes-riviä — slug on valitsin, ei credentiaali.
  if (!segment.slug) {
    segment.slug = generateSegmentSlug(segment.displayName ?? '', takenSlugs(store, segment.id))
  }
  store.set(segment.id, segment)
  return segment
}

export function updateSegment(
  store: SegmentStore,
  id: string,
  patch: Partial<Omit<Segment, 'id'>>,
): Segment | null {
  const existing = store.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch }
  validateRouteFields(updated)
  // T297/V209: nimi muuttui → slug regeneroituu & URL päivittyy. Vanha slug KUOLEE
  // (käyttäjäpäätös 2026-07-25: ei alias-taulua — jaettu vanha linkki lakkaa toimimasta).
  // Eksplisiittinen patch.slug voittaa (migraatio/palautus).
  if (patch.slug === undefined && 'displayName' in patch && patch.displayName !== existing.displayName) {
    updated.slug = generateSegmentSlug(updated.displayName ?? '', takenSlugs(store, id))
  }
  store.set(id, updated)
  return updated
}

export function deleteSegment(store: SegmentStore, id: string): boolean {
  return store.delete(id)
}

// T273/V191: ihmisluettava, uniikki slug pätkän nimestä (Model B — koodin ei tarvitse olla
// arvaamaton, salasana suojaa V188/V42). Ääkköset normalisoidaan, [a-z0-9-], törmäys → suffiksi.
function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'patka'
}

export function generateSegmentSlug(name: string, existing: string[]): string {
  const base = slugifyName(name)
  const taken = new Set(existing.map(s => s.toLowerCase()))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// T298/V209: pätkän jaettava URL-polku. Slug ensin, legacy-assignedCode fallbackina;
// null = ei linkitettävissä (ei pitäisi tapahtua T297:n jälkeen, mutta UI ei saa kaatua).
export function segmentPath(seg: Pick<Segment, 'slug' | 'assignedCode'>): string | null {
  const code = seg.slug ?? seg.assignedCode
  return code ? `/s/${code}` : null
}

// T146/V91: lookup, ei if-ketju — uusi phase helppo lisätä. purku→asettaminen kiertää ympäri
// (järjestäjä voi kloonata takaisin seuraavan tapahtuman asetusvaihetta varten).
export const NEXT_PHASE: Record<Segment['phase'], Segment['phase']> = {
  asettaminen: 'tarkastus',
  tarkastus: 'purku',
  purku: 'asettaminen',
}

// T146: korjaa UI-aukon — ei ollut mitään tapaa luoda tarkastus/purku-vaiheen pätkäjakoa.
// Kopioi routeIds/startDist/endDist/displayName, TYHJÄ assignedCode/equipment/description
// (V26: eri talkoolainen eri vaiheessa, ei peri edellisen koodia). Vanha segmentti koskematon.
// T151/V95: validoi kohde-phasen overlap ennen luontia — duplikaattiklooni (tuplaklikki) → null.
// V139: undefined-safe — reititön tehtävä ei laske overlappia eikä kopioi olematonta reittiä.
export function cloneSegmentToNextPhase(store: SegmentStore, segment: Segment): Segment | null {
  const targetPhase = NEXT_PHASE[segment.phase]
  const primary = segmentPrimaryRouteId(segment)
  // T299/V211: overlap ratkeaa primary-reitillä — km-välit ovat vertailukelpoisia vain saman
  // geometrian sisällä. Ennen tätä silmukka vertasi jokaista routeIdiä samaan km-väliin ∴
  // jaetun osuuden pätkä sai vääriä osumia naapurireittien pätkiin.
  if (primary && segment.startDist !== undefined && segment.endDist !== undefined) {
    if (!validateNoOverlap(store, primary, segment.startDist, segment.endDist, targetPhase)) {
      return null
    }
  }
  return createSegment(store, {
    routeIds: segment.routeIds ? [...segment.routeIds] : undefined,
    primaryRouteId: segment.primaryRouteId,
    startDist: segment.startDist,
    endDist: segment.endDist,
    displayName: segment.displayName,
    equipment: [],
    phase: targetPhase,
  })
}

export function getSegmentsForPhase(
  store: SegmentStore,
  phase: Segment['phase'],
): Segment[] {
  return Array.from(store.values()).filter(s => s.phase === phase)
}

export function getSegmentForCode(
  store: SegmentStore,
  code: string,
): Segment | undefined {
  // T297/V209: slug ensin (∀ pätkällä), assignedCode legacy-fallbackina (vanhat jaetut linkit).
  const upper = code.toUpperCase()
  const values = Array.from(store.values())
  return values.find(s => s.slug?.toUpperCase() === upper)
    ?? values.find(s => s.assignedCode?.toUpperCase() === upper)
}

// T141/B61/V88: lukumäärä per status, pätkäjako-listan riville. Vain count>0 -statukset näytetään UI:ssa.
export function getSegmentStatusCounts(
  segment: Segment,
  markers: SignMarker[],
): Record<MarkerStatus, number> {
  const counts: Record<MarkerStatus, number> = {
    suunniteltu: 0,
    asetettu: 0,
    tarkistettu: 0,
    kerätty: 0,
    ei_tarpeen: 0,
  }
  for (const m of getMarkersForSegment(segment, markers)) {
    counts[m.status]++
  }
  return counts
}

const STATUS_COUNT_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'suunniteltu',
  asetettu: 'asetettu',
  tarkistettu: 'tarkistettu',
  kerätty: 'kerätty',
  ei_tarpeen: 'ei tarpeen',
}

export function formatStatusCounts(counts: Record<MarkerStatus, number>): string {
  const parts = (Object.keys(STATUS_COUNT_LABELS) as MarkerStatus[])
    .filter(status => counts[status] > 0)
    .map(status => `${counts[status]} ${STATUS_COUNT_LABELS[status]}`)
  return parts.length > 0 ? parts.join(' · ') : 'ei merkkejä'
}

// T143/V90: yksi phase-tietoinen luku täyden breakdownin sijaan — mahtuu ahtaaseen sivupalkkiriviin.
// Lookup-taulu (ei if-ketju) jotta uudet phaset on helppo lisätä.
const COUNT_PHASE_TARGET: Record<'asettaminen' | 'purku', { label: string; doneStatuses: MarkerStatus[] }> = {
  asettaminen: { label: 'asetettu', doneStatuses: ['asetettu', 'tarkistettu', 'kerätty'] },
  purku: { label: 'kerätty', doneStatuses: ['kerätty'] },
}

// T144/V91: tarkastus-phase ei laske per-merkki-statusta (ei ole marker-tason "tarkastettu"-statusta,
// ks. V92) — segmentin oma inspected-boolean sen sijaan. Discriminated union ettei count-muoto valehtele.
export type PhaseProgress =
  | { kind: 'count'; done: number; total: number; label: string }
  | { kind: 'boolean'; done: boolean; label: string }

export function getPhaseProgress(segment: Segment, markers: SignMarker[]): PhaseProgress {
  if (segment.phase === 'tarkastus') {
    return { kind: 'boolean', done: segment.inspected ?? false, label: 'tarkastettu' }
  }
  const segMarkers = getMarkersForSegment(segment, markers)
  const target = COUNT_PHASE_TARGET[segment.phase]
  const done = segMarkers.filter(m => target.doneStatuses.includes(m.status)).length
  return { kind: 'count', done, total: segMarkers.length, label: target.label }
}

export function formatPhaseProgress(progress: PhaseProgress): string {
  if (progress.kind === 'boolean') {
    return progress.done ? `${progress.label} ✓` : `ei vielä ${progress.label}`
  }
  if (progress.total === 0) return 'ei merkkejä'
  return `${progress.done}/${progress.total} ${progress.label}`
}

// T152/V96: pätkän tunnistehue stabiili per id (⊥ lista-indeksi — poisto ei siirrä muiden värejä).
// V132/T202: valkoiselle kartalle sopivat värit.
// T304/V216/V244: pätkäpaletti on TUMMA perhe & reittipaletti on KESKIKIRKAS ∴ (a) leikkaus
// reittiväreihin on tyhjä myös silmällä ⊥ vain pikselinä (ennen `#2F6FB0` = smtb-55 pikselilleen),
// (b) pätkä & reitti erottuvat päällekkäin myös akromaattisesti (vaaleusero, ⊥ sävyero).
// Vihreä puuttuu tarkoituksella: se on varattu status-kanavalle (SEGMENT_DONE_COLOR, V96-amend).
export const SEGMENT_COLORS = ['#163A5F', '#552070', '#681A41', '#582F0F']

export function colorForSegment(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return SEGMENT_COLORS[Math.abs(hash) % SEGMENT_COLORS.length]
}

// T348/V96-amend: valmis-tila ohittaa tunnistevärin. Valmiin pätkän identiteetti ⊥ enää kanna
// tietoa (kukaan ⊥ etsi kartalta "kuka teki tämän loppuun") — status kantaa. Arvo on §C:n
// KARTTAPINTA-tokenin `--segment-done` peili (V253): Leaflet-polyline ⊥ lue CSS-muuttujaa ∴
// JS-vakio on pakko, mutta se ! olla YKSI paikka (V132: ⊥ hajota hexiä kutsupaikkoihin).
// ⊥ sido tätä `--confirm`iin (B136): se on chrome-token joka vaihtuu Kaamoksessa #2FA35B:ksi
// ∴ viiva & nimilapun reunus ajautuisivat eri vihreisiin teemanvaihdossa.
// Vihreä sävyperhe on VARATTU tälle kanavalle — SEGMENT_COLORS ⊥ saa sisältää vihreää (T304).
export const SEGMENT_DONE_COLOR = '#1F8A50'

// T152/V96: viivatyyli kartalla kertoo statuksen — kolme ämpäriä getPhaseProgress-tuloksesta.
// ei_alkanut = haalea katko, kesken = täysi katko, valmis = ehjä.
export type SegmentLineState = 'ei_alkanut' | 'kesken' | 'valmis'

export function segmentLineState(progress: PhaseProgress): SegmentLineState {
  if (progress.kind === 'boolean') {
    return progress.done ? 'valmis' : 'ei_alkanut'
  }
  if (progress.total === 0 || progress.done === 0) return 'ei_alkanut'
  if (progress.done >= progress.total) return 'valmis'
  return 'kesken'
}

// T348/V96-amend: KARTAN viivaväri = tunniste PAITSI valmiina, jolloin status voittaa.
// `colorForSegment` säilyy erillään & muuttumattomana: sivupalkki/lista käyttää sitä tunnisteena
// ilman status-kontekstia ∴ pätkän väri listassa ⊥ vaihdu valmistumisesta (rivi & kartta ⊥ saa
// olla eri mieltä identiteetistä). Stabiilius (poisto ⊥ siirrä värejä) pätee ennallaan
// kesken/ei_alkanut-tiloissa. Testattavuus: Vitest-pure.
export function segmentLineColor(id: string, state: SegmentLineState): string {
  return state === 'valmis' ? SEGMENT_DONE_COLOR : colorForSegment(id)
}

// V49/V95: overlap = startDist2 < endDist1 && startDist1 < endDist2, vain saman phasen sisällä
// (eri vaiheiden pätkät saavat olla päällekkäin, V91). excludeId skips own segment on edit.
export function validateNoOverlap(
  store: SegmentStore,
  routeId: string,
  startDist: number,
  endDist: number,
  phase: Segment['phase'],
  excludeId?: string,
): boolean {
  for (const seg of store.values()) {
    if (seg.id === excludeId) continue
    if (seg.phase !== phase) continue
    // V139: reitittömät tehtävät eivät osallistu overlappiin (overlap merkitsee vain reitillisille).
    if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
    // T299/V211: vertaa PRIMARY-reittiä, ei jäsenyyttä. `routeIds.includes` tarkoitti että
    // jaetulla osuudella pätkän km-väli törmäsi toisen reitin km-väliin joka on eri geometriaa
    // ∴ vääriä "menee päällekkäin" -esteitä (& päinvastoin ohi meneviä aitoja törmäyksiä).
    if (segmentPrimaryRouteId(seg) !== routeId) continue
    if (startDist < seg.endDist && seg.startDist < endDist) return false
  }
  return true
}

// V140: delegoi kanoniseen resolveTaskMarkers:iin — Segment on strukturaalinen TaskMarkerSource.
// Reittifiltteri (V25) ∪ linkedMarkerIds ∪ markerTypeFilter. Reitilliselle sama tulos kuin ennen.
export function getMarkersForSegment(
  segment: Segment,
  markers: SignMarker[],
): SignMarker[] {
  return resolveTaskMarkers(segment, markers)
}
