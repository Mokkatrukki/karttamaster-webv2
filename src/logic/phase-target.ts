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
