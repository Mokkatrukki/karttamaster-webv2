// T423/V314/V315: KASA — purkajan maastoon jättämä merkkinippu, jonka autoporukka hakee.
//
// Kasa on MERKKI, ei uusi olio (V314). Siksi se perii koko koneiston ilmaiseksi: kartta,
// audit-loki (V227), undo (T227), `markerTypeFilter`-osuma keräystehtävään (V143) ja
// "📍 Navigoi tähän" (V286). Uusi olio olisi vaatinut jokaisen niistä uudelleen.
//
// Sisältö on OMISTUSSUHDE, ei aikaikkuna (V314): uuteen kasaan menevät ne `kerätty`-merkit
// joita ei ole vielä missään kasassa. "Edellisen kasan jälkeen kerätyt" olisi tilallinen
// sääntö joka rikkoutuu offline-järjestyksessä, kellon siirtyessä ja kun kaksi purkajaa on
// samalla pätkällä. Omistamattomuus on tilaton ja idempotentti ∴ tuplaklikkaus tuottaa tyhjän
// kasan, ei tuplakirjausta.
//
// Puhdas: ei DOM, ei Leaflet, ei fetch → Vitest-pure.

import type { SignMarker } from './types'
import type { SignTemplate } from './sign-library'

/** V315: kasa-templaten id. Yksi paikka — `markerTypeFilter` osoittaa tähän. */
export const PILE_TEMPLATE_ID = 'kerayskasa'

/**
 * V315: kasa-template tulee KOODISTA, ei kuvatiedostosta eikä järjestäjän muistista.
 * `sign-catalog.ts` johtaa templatet `src/assets/signs/`-webpeistä ja kirjasto seedaa
 * tyhjänä (V125) ∴ ilman tätä kasa-templatea ei olisi olemassa ja `markerTypeFilter`
 * osoittaisi tyhjään joukkoon — ketju katoaisi hiljaa, ei virheenä (V21-suku).
 *
 * `favorite:false`: talkoolainen ei sijoita kasaa quick-pickistä vaan omalla napillaan (T424).
 */
export function pileTemplate(): SignTemplate {
  return {
    id: PILE_TEMPLATE_ID,
    label: 'Keräyskasa',
    color: '#8A5CD1',
    description: 'Purettujen merkkien kasa maastossa — autoporukka hakee.',
    favorite: false,
    iconId: 'package',
  }
}

/** Kirjastoon taataan kasa-template. Idempotentti: olemassa olevaa ei ylikirjoiteta. */
export function ensurePileTemplate(library: Map<string, SignTemplate>): Map<string, SignTemplate> {
  if (!library.has(PILE_TEMPLATE_ID)) library.set(PILE_TEMPLATE_ID, pileTemplate())
  return library
}

export function isPile(m: Pick<SignMarker, 'templateId'>): boolean {
  return m.templateId === PILE_TEMPLATE_ID
}

/** Montako merkkiä kasassa on. Ei-kasa → null (rivi ei saa lukua, T425). */
export function pileCount(m: Pick<SignMarker, 'templateId' | 'pileMarkerIds'>): number | null {
  if (!isPile(m)) return null
  return m.pileMarkerIds?.length ?? 0
}

/**
 * V314: kerätyt merkit jotka eivät ole vielä missään kasassa.
 *
 * `segmentMarkers` = ehdokkaat (pätkän merkit); `allMarkers` = koko joukko josta kasat
 * etsitään — kasa voi olla eri pätkällä kuin sen sisältö (talkoolainen kävelee kasalle),
 * ∴ omistajuutta ei saa etsiä pelkästä pätkäjoukosta.
 */
export function unclaimedCollected(
  segmentMarkers: SignMarker[],
  allMarkers: SignMarker[],
): SignMarker[] {
  const claimed = new Set<string>()
  for (const m of allMarkers) {
    if (!isPile(m)) continue
    for (const id of m.pileMarkerIds ?? []) claimed.add(id)
  }
  return segmentMarkers.filter((m) => m.status === 'kerätty' && !isPile(m) && !claimed.has(m.id))
}
