import { describe, it, expect } from 'vitest'
import { rankTemplates, normalizeName, SUGGESTION_THRESHOLD } from '../src/logic/template-match'

// T384/V276/V277/V278 — Taso 1 Vitest-pure. EI jsdom-docblockia: moduuli ⊥ koske DOM:iin.
// Nimivertailu on EHDOTUS, ⊥ liitos (V276). Kirjoitus vaatii kuittauksen per rivi (V277).

const tpl = (id: string, label: string) => ({ id, label })

/** Apuri: labelit ranking-järjestyksessä. */
function order(name: string, list: Array<{ id: string; label: string }>): string[] {
  return rankTemplates(name, list).map((r) => r.template.label)
}

/** Apuri: score annetulle labelille. */
function scoreOf(name: string, list: Array<{ id: string; label: string }>, label: string): number {
  return rankTemplates(name, list).find((r) => r.template.label === label)?.score ?? -1
}

describe('T384 — normalizeName (V278)', () => {
  it('lowercase + ä/ö→a/o + välimerkit ja välilyönnit pois', () => {
    expect(normalizeName('Ylös ja Soininsuo')).toBe('ylosjasoininsuo')
    expect(normalizeName('10,1 km')).toBe('101km')
    expect(normalizeName('10,1km')).toBe('101km')
  })

  it('V278: irtokyltti/lisäkilpi-suffiksi pois — kiinnitystapa ⊥ ole eri nimike', () => {
    expect(normalizeName('Ennakko oikea, 90 irtokyltti')).toBe(normalizeName('Ennakko oikea, 90'))
    expect(normalizeName('Huolto 25 km lisäkilpi')).toBe(normalizeName('Huolto 25 km'))
  })

  it('tyhjä ja pelkkä-välimerkki → tyhjä', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ,.- ')).toBe('')
  })
})

describe('T384 — rankTemplates', () => {
  it('välilyöntiero "10,1km" vs "10,1 km" → ykköspaikka, score 1', () => {
    const list = [tpl('a', 'Peikko'), tpl('b', '10,1 km'), tpl('c', 'Pumppaamo')]
    expect(order('10,1km', list)[0]).toBe('10,1 km')
    expect(scoreOf('10,1km', list, '10,1 km')).toBe(1)
  })

  it('V278: irtokyltti-variantti osuu kantamuotoon (score 1)', () => {
    const list = [tpl('a', 'Ennakko oikea, 90'), tpl('b', 'Soininsuo')]
    expect(order('Ennakko oikea, 90 irtokyltti', list)[0]).toBe('Ennakko oikea, 90')
    expect(scoreOf('Ennakko oikea, 90 irtokyltti', list, 'Ennakko oikea, 90')).toBe(1)
  })

  it('typo-pari "Ennako"/"Ennakko" osuu molempiin suuntiin', () => {
    // Tuotannossa typo voi olla kummassa päässä tahansa — template-id:ssä ITSESSÄÄN on
    // typo `ennako-oikea-135` ∴ toleranssi ! toimia symmetrisesti.
    const list = [tpl('a', 'Ennakko oikea'), tpl('b', 'Soininsuo')]
    expect(scoreOf('Ennako oikea', list, 'Ennakko oikea')).toBeGreaterThanOrEqual(SUGGESTION_THRESHOLD)

    const typoList = [tpl('ennako-oikea-135', 'Ennako oikea'), tpl('b', 'Soininsuo')]
    expect(scoreOf('Ennakko oikea', typoList, 'Ennako oikea')).toBeGreaterThanOrEqual(SUGGESTION_THRESHOLD)
  })

  it('vieras nimi ("Taittopöytä") ⊥ saa korkeaa scorea', () => {
    const list = [tpl('a', 'Ennakko oikea, 90'), tpl('b', 'U-käännös vasen'), tpl('c', 'Myllyn laavu')]
    for (const r of rankTemplates('Taittopöytä', list)) {
      expect(r.score).toBeLessThan(SUGGESTION_THRESHOLD)
    }
  })

  it('score aina välillä [0,1]', () => {
    const list = [tpl('a', '10,1 km'), tpl('b', 'x'), tpl('c', 'Täysin muu juttu')]
    for (const r of rankTemplates('10,1 km', list)) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  it('tyhjä templates-lista ⊥ kaadu', () => {
    expect(rankTemplates('mikä vaan', [])).toEqual([])
  })

  it('tyhjä / whitespace-nimi → score 0 + alkuperäinen järjestys (⊥ ehdotuksia)', () => {
    const list = [tpl('a', 'Beeta'), tpl('b', 'Alfa'), tpl('c', 'Gamma')]
    for (const name of ['', '   ', ' , . ']) {
      const res = rankTemplates(name, list)
      expect(res.map((r) => r.template.id)).toEqual(['a', 'b', 'c'])
      expect(res.every((r) => r.score === 0)).toBe(true)
    }
  })

  it('deterministisesti järjestetty — tasapeli ⊥ heilu ajojen välillä', () => {
    const list = [tpl('a', 'Peikko'), tpl('b', 'Peikko'), tpl('c', 'Pumppaamo')]
    expect(rankTemplates('Peikko', list).map((r) => r.template.id)).toEqual(['a', 'b', 'c'])
    // Kaksi ajoa → identtinen tulos (⊥ Math.random, ⊥ Date, ⊥ engine-riippuvainen sort-stabiilius).
    expect(rankTemplates('peikk', list)).toEqual(rankTemplates('peikk', list))
  })

  it('score laskee monotonisesti (paras ehdotus kärkeen)', () => {
    const list = [tpl('a', 'Ylös'), tpl('b', 'Ylös ja soininsuo'), tpl('c', 'Pumppaamo')]
    const scores = rankTemplates('Ylös', list).map((r) => r.score)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))
    expect(order('Ylös', list)[0]).toBe('Ylös')
  })

  it('palauttaa alkuperäisen template-olion (T386 tarvitsee koko olion signVisualiin)', () => {
    const rich = { id: 'a', label: 'Peikko', color: '#f00', icon_id: 'peikko' }
    const [top] = rankTemplates('Peikko', [rich])
    expect(top.template).toBe(rich)
  })
})
