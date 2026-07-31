import type { Segment } from './segments'

// T445 (käyttäjätoive 2026-07-31): "Kaikki pätkät voisi saada Purku-sanan eteen automaattisesti
// jonka voi sit ylikirjata."
//
// Etuliite on JOHDETTU ⊥ TALLENNETTU. Kannassa oleva nimi ⊥ muutu ∴
//   - ⊥ datamigraatiota,
//   - ⊥ "Purku Purku X" -kertymää kloonatessa (T439 klooni kopioi `displayName`in sellaisenaan),
//   - etuliite seuraa vaihetta jos pätkä siirretään toiseen vaiheeseen.
//
// Asettaminen ⊥ saa etuliitettä: asetus on oletusvaihe & etuliite ⊥ erottaisi mitään
// ("Asetus"-alkuiset nimet kaikkialla = sama kuin ⊥ etuliitettä lainkaan, vain pidempänä.)
export const PHASE_PREFIX: Record<Segment['phase'], string> = {
  asettaminen: '',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

/**
 * T445 (PM-päätös 2026-07-31): AUTOMAATTINIMI ⊥ ole nimi.
 *
 * `segment-creation-modal.ts:270/294` & `:333/414` esitäyttävät luontilomakkeen `Pätkä N` /
 * `Aluetehtävä N` ∴ JOKAISELLA pätkällä on `displayName` heti luonnista. Aiempi literaali
 * sääntö ("displayName voittaa aina") teki featuresta kuolleen: etuliite ⊥ näkynyt koskaan,
 * koska nimetöntä pätkää ⊥ ole olemassa.
 *
 * Kuvio tunnistaa juuri sen mitä lomake tarjoaa — ⊥ mitään laveampaa. Käyttäjän kirjoittama
 * "Pätkä 3 pohjoinen" tai "Pätkä Kalliolenkki" ⊥ täsmää ∴ se on nimi & se voittaa.
 * Jos luonnin esitäyttö muuttuu, TÄMÄ kuvio ! muuttua samalla (yksi lista, ⊥ kaksi).
 */
const AUTO_NAME_RE = /^(Pätkä|Aluetehtävä)\s*\d+$/

/** Onko nimi luonnin esitäyttö (= käyttäjä ⊥ ole nimennyt pätkää itse)? */
export function isAutoSegmentName(name: string | undefined): boolean {
  return AUTO_NAME_RE.test((name ?? '').trim())
}

/** Segment-muotoinen minimisyöte — testit & osittaiset näkymät ⊥ tarvitse koko oliota. */
export type SegmentNameSource = Pick<Segment, 'phase'> & { displayName?: string }

/**
 * Pätkän NÄYTTÖNIMI — ainoa paikka josta nimi luetaan UI:hin.
 *
 * Sääntö: KÄYTTÄJÄN antama nimi voittaa (ylikirjoitus, ⊥ pohja jota koristellaan);
 * automaattinimi & nimettömyys saavat vaihe-etuliitteen. Tämä on käyttäjän toiveen molemmat
 * puolet: "kaikki pätkät saisi Purku-sanan eteen automaattisesti" + "jonka voi sit ylikirjata"
 * — ylikirjoitus tapahtuu nimeämällä pätkä, ⊥ erillisellä kentällä.
 *
 * Etuliite on JOHDETTU näyttöhetkellä ∴ kantaan ⊥ koskaan kirjoiteta etuliitettyä nimeä ∴
 * klooniketju (T439) ⊥ kerrytä "Purku Purku Pätkä 3":a. Lisävarmistus samasta asiasta:
 * etuliitteellinen nimi ⊥ täsmää `AUTO_NAME_RE`ään ∴ se palautuisi sellaisenaan vaikka joku
 * kirjoittaisikin sen kantaan.
 *
 * Yksi kutsu ∀ näyttöpaikassa (hub, sivupaneeli, pätkänäkymä, modaalit) — muuten puolet
 * listasta saa etuliitteen & järjestäjä näkee samalle pätkälle kaksi eri nimeä.
 */
export function segmentDisplayName(
  seg: SegmentNameSource,
  fallback = 'Nimetön pätkä',
): string {
  const own = seg.displayName?.trim()
  if (own && !isAutoSegmentName(own)) return own
  const base = own || fallback
  const prefix = PHASE_PREFIX[seg.phase]
  return prefix ? `${prefix} ${base}` : base
}
