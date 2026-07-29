/**
 * T384 — inventaariorivin nimen fuzzy-ranking merkkipohjia vasten (V276/V277/V278).
 *
 * V276: LIITOS on aina `templates.id` (`inventory_items.template_id` ↔ `markers.template_id`).
 * Nimivertailu ⊥ ole liitos vaan EHDOTUSHEURISTIIKKA — se saa elää TASAN tässä tiedostossa.
 * V277: kone ⊥ kirjoita linkitystä. Tämä moduuli tuottaa ehdotuksia; kirjoitus vaatii
 * järjestäjän kuittauksen per rivi (T386).
 *
 * Puhdas & deterministinen: ⊥ DOM, ⊥ Leaflet, ⊥ fetch, ⊥ Date, ⊥ Math.random.
 *
 * VÄLI- ja TYPO-sietoinen (⊥ pelkkä substring `includes`):
 *  - normalisointi: lowercase + diakriittipoisto + kaikki ei-alfanumeerit pois
 *    → "10,1 km" ≡ "10,1km" ≡ "101km"
 *  - V278: "irtokyltti"/"lisäkilpi"-suffiksi pois — kiinnitystapa ⊥ ole eri nimike
 *    ("Ennakko oikea, 90 irtokyltti" ≡ "Ennakko oikea, 90")
 *  - Levenshtein squash-muodoille → tuotantodata sisältää "Ennako"/"Ennnako"/"Ennakko" JA
 *    template-id:ssä ITSESSÄÄN on typo (`ennako-oikea-135`) ∴ toleranssi toimii molempiin suuntiin
 *  - token-overlap → moniosaiset / uudelleenjärjestetyt nimet
 */

/** Ehdotus/ei-ehdotus-raja: score ≥ tämä = "varmaankin tämä?". Alle → ⊥ tarjota. */
export const SUGGESTION_THRESHOLD = 0.6

/** V278: kiinnitystapaan viittaavat nimivariantit — sama nimike kuin kantamuoto. */
const ATTACHMENT_TOKENS = new Set(['irtokyltti', 'irtokyltit', 'lisakilpi', 'lisakilvet'])

/** Rankattu tulos: alkuperäinen template-olio + [0,1]-samankaltaisuus kyselyyn. */
export interface RankedTemplate<T> {
  template: T
  score: number
}

/** Minimimuoto jonka ranking lukee — kutsuja saa antaa rikkaamman olion (T386 tarvitsee koko templaten). */
export interface TemplateLike {
  id: string
  label: string
}

/** lowercase + diakriittipoisto (ä→a, ö→o, é→e). Ei vielä välimerkkipoistoa. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * V278-normalisointi vertailua varten: lowercase, ä/ö→a/o, kiinnitystapa-suffiksi pois,
 * kaikki välimerkit + välilyönnit pois. "Ennakko oikea, 90 irtokyltti" → "ennakkooikea90".
 */
export function normalizeName(s: string): string {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !ATTACHMENT_TOKENS.has(t))
    .join('')
}

/** Tokenit vertailuun: kiinnitystapa-suffiksi pois (V278). "Huolto 25 km" → ["huolto","25","km"]. */
function tokenize(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !ATTACHMENT_TOKENS.has(t))
}

/** Levenshtein-etäisyys (DP, iteratiivinen rivi). Puhdas. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Levenshtein-suhde [0,1]: 1 = identtiset, 0 = täysin erilaiset. Tyhjät → 0. */
function levRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

/** Token-overlap [0,1]: keskiarvo kunkin kysely-tokenin parhaasta osumasta label-tokeneihin. */
function tokenScore(queryTokens: string[], labelTokens: string[]): number {
  if (queryTokens.length === 0 || labelTokens.length === 0) return 0
  let sum = 0
  for (const qt of queryTokens) {
    let best = 0
    for (const lt of labelTokens) {
      const r = levRatio(qt, lt)
      if (r > best) best = r
    }
    sum += best
  }
  return sum / queryTokens.length
}

/** Fuzzy-kaistan katto: rakenteellinen osuma (prefix/substring) on AINA fuzzyn yläpuolella. */
const FUZZY_CEILING = 0.74

/**
 * Samankaltaisuus [0,1]. Kaistat:
 *  - identtinen normalisointi → 1.0
 *  - toinen alkaa toisella → 0.86..0.99 (ratio = lyhyempi/pidempi)
 *  - toinen sisältää toisen → 0.75..0.85
 *  - muuten → fuzzy × FUZZY_CEILING. Skaalaus ⊥ katkaisu: katkaisu litistäisi kaikki
 *    hyvät typo-osumat samaan 0.74:ään ∴ T386:n top-3 menettäisi järjestyksensä.
 */
function similarity(query: string, label: string): number {
  const sq = normalizeName(query)
  const sl = normalizeName(label)
  if (sq.length === 0) return 0
  if (sq === sl) return 1

  if (sl.length > 0) {
    const ratio = Math.min(sq.length, sl.length) / Math.max(sq.length, sl.length)
    if (sl.startsWith(sq) || sq.startsWith(sl)) return 0.86 + 0.13 * ratio
    if (sl.includes(sq) || sq.includes(sl)) return 0.75 + 0.1 * ratio
  }

  const fuzzy = Math.max(levRatio(sq, sl), tokenScore(tokenize(query), tokenize(label)))
  return fuzzy * FUZZY_CEILING
}

/**
 * Rankkaa merkkipohjat inventaariorivin nimen mukaan. Palauttaa score-desc, STABIILI:
 * tasapeli → syötejärjestys (eksplisiittinen indeksi-tiebreak, ⊥ engine-riippuvainen stabiilius)
 * ∴ sama syöte tuottaa saman järjestyksen ajojen välillä.
 * Tyhjä / pelkkä-whitespace nimi → score 0 kaikille + ALKUPERÄINEN järjestys (⊥ ehdotuksia).
 */
export function rankTemplates<T extends TemplateLike>(
  itemName: string,
  templates: ReadonlyArray<T>,
): RankedTemplate<T>[] {
  const sq = normalizeName(itemName)
  if (sq.length === 0) {
    return templates.map((t) => ({ template: t, score: 0 }))
  }
  return templates
    .map((t, i) => ({ template: t, score: similarity(itemName, t.label), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ template, score }) => ({ template, score }))
}
