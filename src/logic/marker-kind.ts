// T447/V331: KARTAN KOHDE ⊥ OLE AINA KYLTTI — luokka kantaa eron, ⊥ erikoistapaus.
//
// Kasa oli ensimmäinen kohde joka ei ole kyltti & se ratkaistiin `isPile`-tarkistuksena
// (`pile.ts`) jota EI KUTSUTTU yhdestäkään laskurista ∴ kasa kasvatti pätkän merkkimäärää,
// näkyi merkkilistalla & osui karttasuodattimiin kuten kyltti — järjestäjä luki "13 merkkiä"
// kun kylttejä oli 12. Seuraavat kohteet ovat jo näkyvissä (kaatunut puu, parkkipaikka,
// vesipiste, portti) ∴ toinen `isPile`-suku olisi ollut toinen unohdettu kutsupaikka.
//
// LUOKAN KÄYTTÄYTYMINEN TULEE YHDESTÄ TAULUSTA (`MARKER_KINDS`). Hajautettu `switch (kind)`
// olisi se haara joka jää päivittämättä kun kolmas luokka tulee (V313-oppi: lookup ⊥ if-ketju).
// Uusi luokka = uusi RIVI tähän tauluun + uusi rivi `TEMPLATE_KINDS`iin, ⊥ uutta koodia.
//
// `kind` JOHDETAAN templatesta ajossa — sitä EI tallenneta merkille: tallennettu luokka on
// kenttä joka pitää muistaa asettaa & jonka vanha data jättää tyhjäksi ∴ ⊥ migraatiota &
// tuntematon/puuttuva templateId on `kyltti` (vanha data on kylttejä).
//
// `havainto`/`palvelu` ovat PARKISSA (T447c): rakenne kantaa ne rivinä sitten kun tarve on
// todellinen — käyttäytymistä jolle ei ole käyttäjää ei kirjoiteta arvaukselta.
//
// Huomiosysteemi ⊥ palaa (T380/V275 kuoli tuotantodatan nojalla): `kind` on LUOKITTELU,
// ⊥ keskustelukanava.
//
// Puhdas: ei DOM, ei Leaflet, ei fetch → Vitest-pure.

import type { SignMarker } from './types'
import { PILE_TEMPLATE_ID } from './pile'

export type MarkerKind = 'kyltti' | 'kasa'

export interface MarkerKindBehavior {
  /** Lasketaanko tämä "merkiksi" kylttilaskureissa (pätkän merkkimäärä, varustelista, edistymä). */
  countsAsSign: boolean
  /** Voiko kohteen kerätä pois maastosta (purkuvaihe). */
  collectable: boolean
  /** Onko kohteella merkkistatus (`suunniteltu…ei_tarpeen`). */
  hasStatus: boolean
}

/**
 * V331: AINOA taulu. Jokaisella `MarkerKind`illa ! olla rivi — `Record`-tyyppi pakottaa sen
 * käännösaikana & testi ajoaikana (uusi kind ilman riviä ⊥ käänny).
 */
export const MARKER_KINDS: Record<MarkerKind, MarkerKindBehavior> = {
  kyltti: { countsAsSign: true, collectable: true, hasStatus: true },
  // Kasa on kohde jonka autoporukka hakee — se ⊥ ole kyltti jonka joku asetti reitille ∴ se
  // ⊥ saa kasvattaa pätkän merkkimäärää. Kerättävä & statuksellinen se on: kasa kuitataan
  // haetuksi samalla koneistolla kuin kyltti (V314: kasa on merkki).
  kasa: { countsAsSign: false, collectable: true, hasStatus: true },
}

/**
 * templateId → kind. Taulu ⊥ if-ketju (V313): uusi luokka on rivi tässä.
 * Tuntematon id → `kyltti` (oletus alla) ∴ vanha data & järjestäjän omat merkkipohjat ovat
 * kylttejä ilman että kukaan muistaa mitään.
 */
const TEMPLATE_KINDS: Record<string, MarkerKind> = {
  [PILE_TEMPLATE_ID]: 'kasa',
}

const DEFAULT_KIND: MarkerKind = 'kyltti'

/**
 * Merkin (tai pelkän templateId:n) luokka. Ottaa molemmat muodot koska kutsupaikkoja on
 * kahdenlaisia: merkkilistat antavat merkin, merkkikirjasto pelkän templaten id:n.
 */
export function markerKind(
  m: Pick<SignMarker, 'templateId'> | string | null | undefined,
): MarkerKind {
  const id = typeof m === 'string' ? m : m?.templateId
  if (!id) return DEFAULT_KIND
  return TEMPLATE_KINDS[id] ?? DEFAULT_KIND
}

/** Luokan käyttäytymisrivi. Kutsupaikat lukevat kenttää, ⊥ vertaa kindiä literaaliin. */
export function markerBehavior(
  m: Pick<SignMarker, 'templateId'> | string | null | undefined,
): MarkerKindBehavior {
  return MARKER_KINDS[markerKind(m)]
}

/**
 * V331: predikaatti jota KAIKKI kylttilaskurit kutsuvat. Yksi nimi, yksi paikka —
 * `m.templateId !== 'kerayskasa'` hajautettuna olisi sama vika toisessa asussa.
 */
export function countsAsSign(m: Pick<SignMarker, 'templateId'> | string | null | undefined): boolean {
  return markerBehavior(m).countsAsSign
}

export function isCollectable(m: Pick<SignMarker, 'templateId'> | string | null | undefined): boolean {
  return markerBehavior(m).collectable
}

export function hasStatus(m: Pick<SignMarker, 'templateId'> | string | null | undefined): boolean {
  return markerBehavior(m).hasStatus
}

/** Suodatin joka kirjoittaa itsensä auki kutsupaikalla: `markers.filter(onlySigns)`. */
export function onlySigns<T extends Pick<SignMarker, 'templateId'>>(m: T): boolean {
  return countsAsSign(m)
}
