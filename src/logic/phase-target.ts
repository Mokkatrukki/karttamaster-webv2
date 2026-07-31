// T421/V313: VAIHEEN KUITTAUSTAVOITE — yksi lookup, kolme entistä kotia.
//
// Miksi tämä tiedosto on olemassa: "vielä tekemättä" oli kovakoodattu vakioksi
// (`navigation.ts` `status === 'suunniteltu'`) ja "tehty" oli kopioitu kahteen paikkaan
// (`segments.ts` COUNT_PHASE_TARGET, `equipment-counts.ts` PHASE_TARGET). Purku-hero olisi
// ollut kolmas kopio ja neljäs kovakoodaus — ja se kopio, joka jää päivittämättä kun
// `tarkastus` joskus saa oman per-merkki-kuittauksensa.
//
// Purussa avoin merkki on `asetettu | tarkistettu`: merkkiä jota ei ole koskaan asetettu ei
// voi purkaa, ja `kerätty`/`ei_tarpeen` ovat terminaaleja. Asettamisessa avoin on
// `suunniteltu` (entinen käytös bitti bitiltä).
//
// `tarkastus` ei laske per-merkki-statusta (V91: segmentin oma inspected-boolean) → se putoaa
// `asettaminen`-oletukseen, kuten molemmissa entisissä lookupeissa.
//
// Puhdas: ei DOM, ei Leaflet, ei localStorage → Vitest-pure.

import type { MarkerStatus } from './types'
import type { Segment } from './segments'

export interface PhaseTarget {
  /** Vielä tekemättä — hero & navigaatio valitsevat näistä (V313). */
  openStatuses: MarkerStatus[]
  /** "Tehty" laskureille (V90/V285). */
  doneStatuses: MarkerStatus[]
  /**
   * T436/V326: PÄÄTETILAT — statukset joissa merkki ⊥ enää odota tässä tehtävässä mitään.
   * Valmius lasketaan TÄSTÄ, ⊥ "avoimia ⊥ ole": purussa avoin joukko on `asetettu|tarkistettu`
   * ∴ kuittaamatta jäänyt `suunniteltu`-merkki ⊥ ole avoin muttei myöskään tehty — se putosi
   * "kaikki kerätty 🎉":n läpi näkymättömiin (B175). Merkki joka ⊥ ole avoin eikä päätetilassa
   * on VÄLITILASSA: hero näyttää sen omana rivinään.
   *
   * HUOM (poikkeama T436(a):n kirjaimesta): asetusvaiheen päätetilat ovat `doneStatuses` +
   * `ei_tarpeen`, ⊥ `['kerätty','ei_tarpeen']`. Kirjaimellinen lista tekisi asetusvaiheessa
   * jokaisesta `asetettu`-merkistä välitilaisen ∴ "✓ Kaikki asetettu 🎉" ⊥ tulisi koskaan.
   * Purun & keräyksen arvot ovat speciä bitti bitiltä.
   */
  terminalStatuses: MarkerStatus[]
  /** T436/V326: välitilarivin varoitus — miksi merkki ⊥ ole avoin muttei tehty. */
  pendingLabel: string
  /**
   * T437/V323: MIHIN päätetila puretaan. Paluu on vaiheen funktio kuten kuittauskin ∴ sama
   * lookup toisin päin — ⊥ UI:n if-lause, ⊥ per-vaihe-erikoistapaus (V313-suku).
   */
  revertStatus: MarkerStatus
  /** T437/V323: peruutusnapin sana. */
  revertLabel: string
  /** Mihin statukseen kuittaus vie. */
  targetStatus: MarkerStatus
  /** Laskurin sana: "N/M asetettu" | "N/M kerätty". */
  label: string
  /** Heron otsikko: "Seuraava merkki" | "Seuraava purettava". */
  nextLabel: string
  /** Kuittausnapin teksti. */
  actionLabel: string
  /** Valmis-rivi kun avoimia ei ole. */
  doneLabel: string
  /**
   * T429/V319: TOINEN ja viimeinen toiminto merkille. Asetusvaiheessa "Ei tarpeen" (merkkiä ei
   * sittenkään tarvita), purussa "Ei löytynyt" (merkki on kadonnut maastosta). Sama status —
   * vaihe erottaa merkinnät, ⊥ tarvita uutta enum-arvoa. Sana tulee tästä ⊥ UI:n if-lauseesta.
   */
  secondaryLabel: string
  secondaryStatus: MarkerStatus
}

const TARGETS: Record<'asettaminen' | 'purku', PhaseTarget> = {
  asettaminen: {
    openStatuses: ['suunniteltu'],
    doneStatuses: ['asetettu', 'tarkistettu', 'kerätty'],
    terminalStatuses: ['asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen'],
    pendingLabel: '⚠ Odottaa kuittausta',
    revertStatus: 'suunniteltu',
    revertLabel: '↩ Palauta asettamattomaksi',
    targetStatus: 'asetettu',
    label: 'asetettu',
    nextLabel: 'Seuraava merkki',
    actionLabel: '✓ Aseta',
    doneLabel: '✓ Kaikki asetettu 🎉',
    secondaryLabel: 'Ei tarpeen',
    secondaryStatus: 'ei_tarpeen',
  },
  purku: {
    openStatuses: ['asetettu', 'tarkistettu'],
    doneStatuses: ['kerätty'],
    terminalStatuses: ['kerätty', 'ei_tarpeen'],
    pendingLabel: '⚠ Ei kuitattu asetetuksi — maastossa?',
    revertStatus: 'asetettu',
    revertLabel: '↩ Palauta keräämättömäksi',
    targetStatus: 'kerätty',
    label: 'kerätty',
    nextLabel: 'Seuraava purettava',
    actionLabel: '✓ Kerätty',
    doneLabel: '✓ Kaikki kerätty 🎉',
    secondaryLabel: 'Ei löytynyt',
    secondaryStatus: 'ei_tarpeen',
  },
}

// T425/V143: KERÄYSTEHTÄVÄ (`markerTypeFilter`, V143 skenaario 2) ei ole pätkä vaan elävä
// keräyslista: kasa syntyy `suunniteltu`-tilassa (= hakematta) ja "Haettu" vie `kerätty`yn
// (T218). Se on eri elinkaari kuin purkupätkän merkillä, jonka ! olla ensin asetettu ∴ pelkkä
// phase-lookup valitsisi keräystehtävässä väärän joukon: kasat katoaisivat listan ohjauksesta.
const COLLECTION: PhaseTarget = {
  openStatuses: ['suunniteltu'],
  doneStatuses: ['kerätty'],
  terminalStatuses: ['kerätty', 'ei_tarpeen'],
  pendingLabel: '⚠ Odottaa hakua',
  revertStatus: 'suunniteltu',
  revertLabel: '↩ Palauta hakemattomaksi',
  targetStatus: 'kerätty',
  label: 'haettu',
  nextLabel: 'Lähin kasa',
  actionLabel: '✓ Haettu',
  doneLabel: '✓ Kaikki haettu 🎉',
  secondaryLabel: 'Ei löytynyt',
  secondaryStatus: 'ei_tarpeen',
}

export function phaseTarget(phase: Segment['phase'] | undefined): PhaseTarget {
  return TARGETS[phase === 'purku' ? 'purku' : 'asettaminen']
}

/**
 * Tehtävän tavoite. Keräystehtävä (`markerTypeFilter`) voittaa vaiheen — se on oma
 * elinkaarensa, ei pätkän vaihe. Tämä on se kutsu jota navigaatio & UI käyttävät; pelkkä
 * `phaseTarget` on vain vaiheen taulu.
 */
export function segmentTarget(
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): PhaseTarget {
  if (segment?.markerTypeFilter) return COLLECTION
  return phaseTarget(segment?.phase)
}

/** Onko merkki vielä tekemättä tässä tehtävässä? Ainoa "avoin"-predikaatti (V313). */
export function isOpenInSegment(
  status: MarkerStatus,
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): boolean {
  return segmentTarget(segment).openStatuses.includes(status)
}

/** T436/V326: onko merkki päätetilassa tässä tehtävässä? Valmiuden ainoa predikaatti. */
export function isTerminalInSegment(
  status: MarkerStatus,
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): boolean {
  return segmentTarget(segment).terminalStatuses.includes(status)
}

/**
 * T436/V326: VÄLITILA — merkki joka ⊥ ole avoin eikä päätetilassa. Purussa tämä on merkki
 * jota ⊥ koskaan kuitattu asetetuksi: se on fyysisesti maastossa mutta putoaisi sekä heron
 * ohjauksesta (V313) että valmius-laskennasta ∴ hiljainen katoaminen (V21-suku).
 */
export function isPendingInSegment(
  status: MarkerStatus,
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): boolean {
  return !isOpenInSegment(status, segment) && !isTerminalInSegment(status, segment)
}

/**
 * T436/V326: onko tehtävä valmis? ∀ merkki päätetilassa — ⊥ "avoimia ⊥ ole". Tyhjä joukko ⊥ ole
 * valmis vaan tyhjä: kutsuja erottaa ne (hero näyttää "Ei merkkejä tällä pätkällä").
 */
export function isTaskComplete(
  markers: { status: MarkerStatus }[],
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): boolean {
  return markers.every((m) => isTerminalInSegment(m.status, segment))
}

/**
 * T437/V323: MIHIN tämä päätetila palautuu tässä tehtävässä? `null` = ⊥ ole mitä perua
 * (merkki ⊥ ole päätetilassa) ∴ kutsuja ⊥ tarvitse omaa if-lausetta statuksista.
 *
 * `ei_tarpeen` palautuu vaiheen AVOIMEEN statukseen, ⊥ `revertStatus`iin: sillä on KAKSI
 * lähdettä (suunniteltu→"ei tarpeen", asetettu→"ei löytynyt") ∴ alkuperää ⊥ voi arvata. Yksi
 * paluu joka jättää merkin tehtävän listalle on ainoa vastaus jota ⊥ tarvitse arvata.
 */
export function revertTarget(
  status: MarkerStatus,
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): MarkerStatus | null {
  if (!isTerminalInSegment(status, segment)) return null
  const t = segmentTarget(segment)
  const next = status === 'ei_tarpeen' ? t.openStatuses[0] : t.revertStatus
  return next === status ? null : next
}

/** T437/V323: peruutusnapin sana tässä tehtävässä. Pari `revertTarget`ille. */
export function revertLabel(
  segment: { phase?: Segment['phase']; markerTypeFilter?: string } | null | undefined,
): string {
  return segmentTarget(segment).revertLabel
}
