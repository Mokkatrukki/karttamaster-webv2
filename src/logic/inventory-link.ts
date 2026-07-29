import { rankTemplates, SUGGESTION_THRESHOLD, ATTACHMENT_WORDS } from './template-match'
import type { InventoryItem } from './inventory'

/**
 * T398 — inventaariorivi ↔ merkkipohja, KÄÄNTEINEN suunta T386:lle (V276/V277/V278).
 *
 * T386 kysyy "mihin merkkipohjaan tämä varastorivi kuuluu". Tämä moduuli kysyy toisin päin:
 * "mitä varastossa on tälle nimelle jota olen juuri kirjoittamassa" — merkkipohja luodaan
 * yleensä juuri siksi että laatikossa on kyltti ∴ linkitys kuuluu luontihetkeen.
 *
 * Puhdas: ⊥ DOM, ⊥ Leaflet, ⊥ fetch. V277 säilyy: tämä tuottaa EHDOTUKSIA, kirjoitus vaatii
 * ihmisen eksplisiittisen valinnan.
 */

/** Yhdistämislistalle & ehdotuksiin kelpaava rivi. */
export interface InventoryLinkRow {
  id: string
  name: string
  qty: number
  /** Paikan NIMI (⊥ id) — kutsuja resolvoi, ranking ⊥ tarvitse sitä. */
  locationName?: string
}

export interface RankedInventoryRow<T> {
  row: T
  score: number
}

/**
 * V276/V279: yhdistettäviä ovat vain linkittämättömät JA ei-tarvikkeiksi merkityt rivit.
 * ASUU TÄÄLLÄ ⊥ UI-moduulissa: sääntö on logiikkaa & sillä on kaksi kuluttajaa
 * (T386 yhdistämispaneeli, T399 luontimodaalin picker).
 */
export function unlinkedItems<T extends { templateId?: string | null; notSign?: boolean }>(items: T[]): T[] {
  return items.filter((i) => !i.templateId && i.notSign !== true)
}

/** Laskuri "🔗 Yhdistä (N)" -nappiin & "Näytä kaikki varastorivit (N)" -linkkiin. */
export function unlinkedCount(items: Array<Pick<InventoryItem, 'templateId' | 'notSign'>>): number {
  return unlinkedItems(items).length
}

/**
 * Rankkaa VARASTORIVIT kirjoitettua merkkipohjan labelia vasten — `rankTemplates` (T384)
 * toisin päin. Adapteri on tarpeen koska `rankTemplates` lukee `label`-kenttää & rivillä on
 * `name`; Levenshteiniä ⊥ kopioida, se kääritään.
 *
 * Palauttaa vain kynnyksen ylittävät, laskevassa järjestyksessä. Tyhjä label → tyhjä tulos
 * (⊥ ehdotuksia ennen kuin käyttäjä on kirjoittanut jotain).
 */
export function rankInventoryRows<T extends { id: string; name: string }>(
  label: string,
  rows: readonly T[],
): RankedInventoryRow<T>[] {
  if (!label.trim()) return []
  const byIndex = new Map(rows.map((r, i) => [i, r]))
  const asLabels = rows.map((r, i) => ({ id: String(i), label: r.name }))
  return rankTemplates(label, asLabels)
    .filter((r) => r.score >= SUGGESTION_THRESHOLD)
    .map((r) => ({ row: byIndex.get(Number(r.template.id))!, score: r.score }))
}

/**
 * NÄYTTÖtason siivous: varastorivin nimi → merkkipohjan nimi. Poistaa kiinnitystapa-sanat mutta
 * SÄILYTTÄÄ välit, ison alkukirjaimen & välimerkit (⊥ `normalizeName`, joka murskaa kaiken
 * vertailumuotoon).
 *
 * "Nuoli irtokyltti, valkoinen tausta" → "Nuoli, valkoinen tausta"
 * "Ennakko oikea, 90 irtokyltti"       → "Ennakko oikea, 90"
 *
 * **Kiinnitystapa kuuluu VARASTORIVILLE ⊥ merkkipohjan nimeen** (V278/V186): laatikon kannalta
 * on olennaista onko kyltti irrallinen, merkkipohjan kannalta ⊥ ole.
 */
export function cleanDisplayName(name: string): string {
  const stripped = name
    .split(/(\s+)/) // säilytä välit paloina → alkuperäinen välitys ei katoa
    .map((part) =>
      // Poistetaan vain SANA, ⊥ siihen takertunut välimerkki: "irtokyltti," → "," ∴ luettelon
      // pilkku säilyy ("Nuoli irtokyltti, valkoinen" → "Nuoli, valkoinen", ⊥ "Nuoli valkoinen").
      ATTACHMENT_WORDS.has(normalizeWord(part)) ? part.replace(/[\p{L}\p{N}]/gu, '') : part,
    )
    .join('')
  return stripped
    .replace(/\s{2,}/g, ' ') // poistetun sanan jättämä tuplaväli
    .replace(/\s+([,;.])/g, '$1') // "Peikko , kolmio" → "Peikko, kolmio"
    .replace(/[,;]\s*$/, '') // roikkuva pilkku lopussa
    .replace(/^\s*[,;]\s*/, '') // roikkuva pilkku alussa
    .trim()
}

/** Sanan vertailumuoto ATTACHMENT_WORDS-tarkistukseen: pienet kirjaimet, diakriitit & välimerkit pois. */
function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
