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

/** Segment-muotoinen minimisyöte — testit & osittaiset näkymät ⊥ tarvitse koko oliota. */
export type SegmentNameSource = Pick<Segment, 'phase'> & { displayName?: string }

/**
 * Pätkän NÄYTTÖNIMI — ainoa paikka josta nimi luetaan UI:hin.
 *
 * `displayName` voittaa aina: järjestäjän kirjoittama nimi on ylikirjoitus, ⊥ pohja jota
 * koristellaan. Vasta nimetön pätkä saa vaihe-etuliitteen `fallback`in eteen.
 *
 * Yksi kutsu ∀ näyttöpaikassa (hub, sivupaneeli, hero, modaalit) — muuten puolet listasta
 * saa etuliitteen & järjestäjä näkee kaksi eri nimeä samalle pätkälle.
 */
export function segmentDisplayName(
  seg: SegmentNameSource,
  fallback = 'Nimetön pätkä',
): string {
  const own = seg.displayName?.trim()
  if (own) return own
  const prefix = PHASE_PREFIX[seg.phase]
  return prefix ? `${prefix} ${fallback}` : fallback
}
