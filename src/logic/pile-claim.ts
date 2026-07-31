// T449/V333: VARAUS ON TOINEN VAIHDE ⊥ OLETUS.
//
// Kaksi autoa samalla listalla ajaa samalle kasalle (20 km hukkaan metsätietä) ∴ varaus
// tarvitaan; mutta todennäköisin tapaus on YKSI auto & sille jokainen valintaruutu on este
// toiminnon edessä (VISION §UX: max 2 nappia). Tämä moduuli kantaa varauksen TULKINNAN;
// näkyvyyspäätös ("näytetäänkö ruutuja") on UI:n & se on oletuksena EI.
//
// Varaus ⊥ vanhene automaattisesti: auto voi olla tunnin ajomatkan päässä & varauksen
// katoaminen kesken ajon tuottaa juuri sen päällekkäisajon jonka esto oli koko pointti.
// Vanha varaus on NÄKYVÄ ongelma, kadonnut varaus on näkymätön ∴ ikä näytetään, ⊥ ratkaista.
//
// Puhdas: ei DOM, ei fetch → Vitest-pure.

import type { SignMarker } from './types'

export interface PileClaim {
  by: string
  /** ISO-aika. `undefined` = vanha rivi jolta leima puuttuu — varaus on silti voimassa. */
  at?: string
}

/** Varaus vai vapaa. Tyhjä/whitespace-nimi ⊥ ole varaus (⊥ näytä "  , 5 min sitten"). */
export function pileClaim(m: Pick<SignMarker, 'claimedBy' | 'claimedAt'>): PileClaim | null {
  const by = m.claimedBy?.trim()
  if (!by) return null
  return { by, ...(m.claimedAt ? { at: m.claimedAt } : {}) }
}

export function isClaimedByOther(
  m: Pick<SignMarker, 'claimedBy' | 'claimedAt'>,
  me: string | undefined,
): boolean {
  const claim = pileClaim(m)
  return claim !== null && claim.by !== me?.trim()
}

const MIN = 60_000
const HOUR = 60 * MIN

/**
 * Varauksen IKÄ ihmisen sanoina. Kellonaika olisi väärä muoto: se vaatisi vertaamista omaan
 * kelloon & metsässä se on juuri se laskutoimitus jota ⊥ jaksa tehdä.
 * Tuleva/kelvoton aikaleima → 'juuri nyt' (⊥ negatiivista ikää: kellot heittävät).
 */
export function formatClaimAge(at: string | undefined, now: number = Date.now()): string {
  if (!at) return ''
  const t = Date.parse(at)
  if (!Number.isFinite(t)) return ''
  const age = now - t
  if (age < MIN) return 'juuri nyt'
  if (age < HOUR) return `${Math.floor(age / MIN)} min sitten`
  const hours = Math.floor(age / HOUR)
  if (hours < 24) return `${hours} t sitten`
  return `${Math.floor(hours / 24)} vrk sitten`
}

/** "Mikko, 45 min sitten" — nimi & ikä yhdessä, ⊥ kahtena eri kenttänä kahdella tyylillä. */
export function formatClaimLabel(claim: PileClaim, now: number = Date.now()): string {
  const age = formatClaimAge(claim.at, now)
  return age ? `${claim.by}, ${age}` : claim.by
}
