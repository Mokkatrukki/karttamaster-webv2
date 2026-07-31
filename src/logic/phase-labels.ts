import type { Segment } from './segments'

// T433/V321: vaiheen NIMI & vaiheenvaihdon SEURAUS yhdestä lookupista.
//
// Oma moduulinsa ⊥ `phase-view.ts`:n sisällä tarkoituksella: `phase-view` lukee
// `localStorage`ia moduulitasolla (välimuisti) ∴ jokainen importtaaja perisi sivuvaikutuksen.
// Tämä on pelkkää dataa — node-ympäristön testattavissa ilman DOM:ia.
//
// Seurauslause tulee VAIHEESTA ⊥ if-lauseesta: kolmas vaihe joka unohtuu if-ketjusta
// vahvistaisi adminille tyhjällä lupauksella ("oletko varma?" ⊥ kerro mistä).

export const PHASE_ORDER: Segment['phase'][] = ['asettaminen', 'tarkastus', 'purku']

export const PHASE_LABELS: Record<Segment['phase'], string> = {
  asettaminen: 'Asetus',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

/** Pitkä nimi nykytila-riville — "Käynnissä: Asetusvaihe" lukee paremmin kuin "Asetus". */
export const PHASE_LONG_LABELS: Record<Segment['phase'], string> = {
  asettaminen: 'Asetusvaihe',
  tarkastus: 'Tarkastusvaihe',
  purku: 'Purkuvaihe',
}

/**
 * T443/V329: VAIHEEN NIMI JOKA SANOO MITÄ OLLAAN TEKEMÄSSÄ, ⊥ mikä tila on päällä.
 *
 * "Purku" on tilan nimi; "Purkumaster" on rooli jossa käyttäjä on juuri nyt. Tila jota ⊥ näe
 * on tila jonka voi luulla joksikin muuksi (V321:n synty). Nimi kulkee aina aksenttivärin
 * rinnalla — väri ⊥ ole ainoa kantaja (V329).
 */
export const PHASE_MASTER_NAMES: Record<Segment['phase'], string> = {
  asettaminen: 'Asetusmaster',
  tarkastus: 'Tarkastusmaster',
  purku: 'Purkumaster',
}

/**
 * T435/V322: epäonnistunut vaiheenvaihto → TOIMENPIDE, ⊥ toteamus.
 *
 * Yksi geneerinen "vaihe ei tallentunut" teki 403:sta, 404:stä, 5xx:stä & verkkokatkosta
 * saman tapahtuman vaikka jokainen vaatii eri teon. Mitattu 2026-07-31: ajossa ollut
 * serveriprosessi oli käynnistetty ennen `routes/phase.ts`:n olemassaoloa (⊥ `--watch`)
 * ∴ `PUT` sai 404:n & juurisyytä etsittiin tunti väärästä kerroksesta.
 *
 * `status === null` = `fetch` heitti (verkko poikki, ⊥ vastausta lainkaan).
 */
export function phaseChangeErrorMessage(status: number | null): string {
  if (status === null) return 'Ei yhteyttä — vaihe ei vaihtunut. Tarkista verkko ja yritä uudelleen.'
  if (status === 401) return 'Istunto vanhentunut — kirjaudu uudelleen sisään.'
  if (status === 403) return 'Vain admin voi vaihtaa vaihetta.'
  if (status === 404) return 'Serveri ei tunne pyyntöä — onko backend ajan tasalla? (käynnistä serveri uudelleen)'
  if (status >= 500) return 'Serverivirhe — vaihe ei vaihtunut. Yritä hetken päästä uudelleen.'
  return `Vaihe ei vaihtunut (virhe ${status}).`
}

/**
 * Mitä TAPAHTUU kaikille kun vaihe vaihtuu tähän. Vahvistusdialogin teksti — kertoo
 * seurauksen ⊥ kysy geneeristä "oletko varma". Admin ⊥ voi punnita riskiä jota ⊥ ole sanottu.
 */
export function phaseChangeWarning(phase: Segment['phase']): string {
  switch (phase) {
    case 'asettaminen':
      return 'Asetusvaihe alkaa kaikille. Jokainen talkoolainen näkee asetuspätkät, ja tarkastus- sekä purkutehtävät katoavat hänen listaltaan.'
    case 'tarkastus':
      return 'Tarkastusvaihe alkaa kaikille. Jokainen talkoolainen näkee tarkastuspätkät, ja asetus- sekä purkutehtävät katoavat hänen listaltaan.'
    case 'purku':
      return 'Purku alkaa kaikille. Jokainen talkoolainen näkee purkupätkät, ja asetusvaiheen tehtävät katoavat hänen listaltaan.'
  }
}
