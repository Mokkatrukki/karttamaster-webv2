import type { SignMarker, MarkerStatus } from './types'
import type { SegmentTrack } from './segment-track'
import { markersForSegment } from './segment-membership'
import { phaseTarget } from './phase-target'
import { countsAsSign } from './marker-kind'
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
  excludedMarkerIds?: string[] // V259: järjestäjän ohitus — poistaa merkin geometrian yli
  markerTypeFilter?: string    // V140/V143: dynaaminen tyyppisuodatin (templateId-osumat)
  // T358/T359/V258: pätkän OMA geometria. `startDist`/`endDist` ovat tästä johdettuja
  // yhteensopivuusarvoja (V260) — jälki on totuus. Puuttuu legacy-pätkältä kunnes T361:n
  // backfill ajaa; siihen asti jäsenyys putoaa entiseen km-sääntöön (V260-välitila).
  track?: SegmentTrack
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
//
// T439/V324: KLOONI KANTAA TEHTÄVÄN KOKO MERKKIJOUKON. Kopioitavien kenttien lista ON
// `TaskMarkerSource` (`task-markers.ts`) — kaikki mitä `resolveTaskMarkers` lukee:
//   routeIds, primaryRouteId, startDist, endDist, linkedMarkerIds, markerTypeFilter
// Kenttä joka lisätään `TaskMarkerSource`en ! lisätä myös tähän, muuten reitittömän tehtävän
// (V139/V140) klooni syntyy ilman merkkejä: näkyy listalla, aukeaa, on tyhjä (B178).
// Testi `segments.test.ts` → "V324: klooni kopioi ∀ TaskMarkerSource-kentän" pitää listan yhtenä.
//
// T439: `targetPhase` on VALINTA ⊥ pakko. `NEXT_PHASE` on kiinteä kierros ∴ asetuspätkästä
// purkupätkän sai vain kloonaamalla kahdesti tarkastuksen kautta — & välipätkä jäi elämään
// vaiheeseen jota kukaan ⊥ aja. Oletus säilyy `NEXT_PHASE`ina.
export function cloneSegmentToNextPhase(
  store: SegmentStore,
  segment: Segment,
  phase?: Segment['phase'],
): Segment | null {
  const targetPhase = phase ?? NEXT_PHASE[segment.phase]
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
    // T439/V324: merkkijoukon kaksi ⊥-reitillistä lähdettä. Uusi taulukko ⊥ jaettu viittaus —
    // kloonin merkkilistan muokkaus ⊥ saa mutatoida alkuperäisen tehtävän joukkoa.
    linkedMarkerIds: segment.linkedMarkerIds ? [...segment.linkedMarkerIds] : undefined,
    markerTypeFilter: segment.markerTypeFilter,
    // T361/V258 (ck:review H-7): klooni kattaa SAMAN maaston ∴ se perii jäljen. Ilman tätä
    // tarkastus-/purku-vaiheen pätkä jäisi ikuisesti jäljettömäksi (V260 sallii sen ∴ ⊥ rikki,
    // mutta se ⊥ koskaan saisi V259:n eksklusiivista jäsenyyttä). Kopio ⊥ jaettu viittaus:
    // kloonin rajojen muokkaus (T363) ⊥ saa mutatoida alkuperäisen geometriaa.
    track: segment.track ? segment.track.map(p => ({ ...p })) : undefined,
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
  // V259: eksklusiivisuus vaatii kilpailijat. Ilman niitä lukema putoaa legacy-km-sääntöön
  // (markersForSegment) — konservatiivinen, ⊥ "kaikki reitin merkit".
  peers: Segment[] = [],
): Record<MarkerStatus, number> {
  const counts: Record<MarkerStatus, number> = {
    suunniteltu: 0,
    asetettu: 0,
    tarkistettu: 0,
    kerätty: 0,
    ei_tarpeen: 0,
  }
  // T447/V331: kasa ⊥ ole kyltti ∴ se ⊥ kasvata pätkän merkkimäärää. Ennen tätä järjestäjä
  // luki hubissa "13 merkkiä" kun kylttejä oli 12 & yksi oli purkajan jättämä kasa.
  for (const m of getMarkersForSegment(segment, markers, peers)) {
    if (!countsAsSign(m)) continue
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
// T421/V313: taulu asuu `phase-target.ts`:ssä — tämä oli yksi kolmesta kopiosta.

// T144/V91: tarkastus-phase ei laske per-merkki-statusta (ei ole marker-tason "tarkastettu"-statusta,
// ks. V92) — segmentin oma inspected-boolean sen sijaan. Discriminated union ettei count-muoto valehtele.
export type PhaseProgress =
  | { kind: 'count'; done: number; total: number; label: string }
  | { kind: 'boolean'; done: boolean; label: string }

export function getPhaseProgress(segment: Segment, markers: SignMarker[], peers: Segment[] = []): PhaseProgress {
  if (segment.phase === 'tarkastus') {
    return { kind: 'boolean', done: segment.inspected ?? false, label: 'tarkastettu' }
  }
  // T447/V331: sama rajaus kuin `getSegmentStatusCounts`illa — edistymä mittaa kylttityötä.
  // Kasa on työn TULOS ⊥ sen kohde: jos se laskettaisiin nimittäjään, purku ei koskaan
  // näyttäisi valmiilta (jokainen jätetty kasa lisäisi tekemätöntä).
  const segMarkers = getMarkersForSegment(segment, markers, peers).filter(countsAsSign)
  const target = phaseTarget(segment.phase)
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

// T464/V352 (B200): pätkäväri on SUHDE NAAPUREIHIN ⊥ funktio id:stä. `colorForSegment` antoi
// vakauden (poisto ⊥ siirrä muita) mutta ⊥ luvannut erottuvuutta ∴ 4 väriä & 13 purkupätkää
// tuotti kolme PERÄKKÄISTÄ samanväristä = katkeamaton 16 km viiva jossa rajoja ⊥ näy.
//
// Ahne intervallivärjäys aloitusjärjestyksessä on intervalligraafilla OPTIMAALINEN ∴ paletti
// riittää kunnes viisi pätkää on päällekkäin yhtä aikaa. Ryhmä = (phase + primary-reitti): eri
// vaiheen tai eri reitin pätkä ⊥ piirry samaan pikseliin ∴ se ⊥ ole naapuri eikä saa rajoittaa.
//
// Jako on RIIPPUMATON `completed`-lipusta vaikka valmis pätkä piirtyy vihreänä (T348): jos
// valmistuminen vapauttaisi värin, yhden pätkän kuittaus vaihtaisi naapureiden värit kesken
// työpäivän. Puhdas ∴ Vitest-pure.
export function assignSegmentColors(segments: Iterable<Segment>): Map<string, string> {
  const result = new Map<string, string>()
  const groups = new Map<string, Segment[]>()

  for (const seg of segments) {
    // V139-reititön tehtävä ⊥ ole intervalli ∴ sillä ⊥ ole naapuria josta erottua — hash kelpaa.
    if (seg.startDist === undefined || seg.endDist === undefined) {
      result.set(seg.id, colorForSegment(seg.id))
      continue
    }
    const key = `${seg.phase} ${segmentPrimaryRouteId(seg) ?? ''}`
    const g = groups.get(key)
    if (g) g.push(seg)
    else groups.set(key, [seg])
  }

  for (const group of groups.values()) {
    // Vakaa järjestys: startDist, tasapeli id ∴ sama syöte → sama väritys joka renderissä
    // (Map-iteraatiojärjestys ⊥ saa vuotaa väreihin).
    group.sort((a, b) => (a.startDist! - b.startDist!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const placed: { start: number; end: number; idx: number }[] = []
    for (const seg of group) {
      const start = seg.startDist!
      const end = seg.endDist!
      const used = new Set<number>()
      for (const p of placed) {
        // Leikkaus TAI kosketus: jaettu päätepiste (edellisen end === tämän start) on juuri se
        // tapaus jossa sama väri sulattaa kaksi pätkää yhdeksi ∴ `≤` molempiin suuntiin.
        if (start <= p.end && p.start <= end) used.add(p.idx)
      }
      let idx = 0
      while (idx < SEGMENT_COLORS.length && used.has(idx)) idx++
      // Paletti loppui (≥5 päällekkäistä yhtä aikaa): törmäys hyväksytään. ⊥ kaadu & ⊥ keksi
      // väriä paletin ulkopuolelta — V244:n ehdot (∩ ROUTE = ∅, ≥3:1 valkoista vasten) pätevät.
      if (idx === SEGMENT_COLORS.length) idx = 0
      placed.push({ start, end, idx })
      result.set(seg.id, SEGMENT_COLORS[idx])
    }
  }

  return result
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

// T353/V256 (B142): `completed` VOITTAA merkkilaskurin. Talkoolaisen eksplisiittinen kuittaus on
// vahvempi tieto kuin johdettu laskuri — hän on paikan päällä & tietää onko pätkä oikeasti hoidettu
// (suunnitelmasta voi puuttua merkkejä tai olla liikaa). Ennen tätä lipulla ⊥ ollut yhtään lukijaa
// nappien labelien ulkopuolella ∴ kuittaus ⊥ näkynyt järjestäjälle missään.
export function segmentLineState(progress: PhaseProgress, completed = false): SegmentLineState {
  if (completed) return 'valmis'
  if (progress.kind === 'boolean') {
    return progress.done ? 'valmis' : 'ei_alkanut'
  }
  if (progress.total === 0 || progress.done === 0) return 'ei_alkanut'
  if (progress.done >= progress.total) return 'valmis'
  return 'kesken'
}

// T348/V96-amend: KARTAN viivaväri = tunniste PAITSI valmiina, jolloin status voittaa.
//
// T464/V352: parametri on TUNNISTEVÄRI ⊥ id. Ennen tätä funktio hashasi id:n itse ∴ kutsupaikka
// ⊥ voinut antaa naapuritietoista väriä ilman että sääntö "valmis voittaa identiteetin" olisi
// pitänyt kopioida sinne. Väri tulee `assignSegmentColors`ilta; jos lista/sivupalkki joskus
// näyttää pätkävärin, se lukee SAMAA jakoa (V96: rivi & kartta ⊥ saa olla eri mieltä
// identiteetistä). Testattavuus: Vitest-pure.
export function segmentLineColor(identityColor: string, state: SegmentLineState): string {
  return state === 'valmis' ? SEGMENT_DONE_COLOR : identityColor
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

// T359/V259: delegoi kanoniseen `markersForSegment`iin (segment-membership.ts).
// `peers` = saman VAIHEEN muut pätkät (`getSegmentsForPhase`). Ilman niitä eksklusiivisuutta
// ⊥ voi ratkaista — "kuka omistaa" vaatii kilpailijat ∴ kutsuja jolla on store ! antaa ne.
// Jäljetön pätkä (V260-välitila) käyttäytyy täsmälleen kuten ennen myös ilman peersejä.
export function getMarkersForSegment(
  segment: Segment,
  markers: SignMarker[],
  peers: Segment[] = [],
): SignMarker[] {
  return markersForSegment(segment, markers, peers)
}

/** Kutsupaikan apuri: pätkän kilpailijat = saman vaiheen pätkät storesta (V259). */
export function segmentPeers(store: SegmentStore, segment: Segment): Segment[] {
  return getSegmentsForPhase(store, segment.phase)
}
