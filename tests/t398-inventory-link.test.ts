import { describe, it, expect } from 'vitest'
import { rankInventoryRows, cleanDisplayName, unlinkedItems, unlinkedCount } from '../src/logic/inventory-link'

// T398/V276/V277/V278 — Taso 1 Vitest-pure. Käänteinen suunta T386:lle: varastorivit
// rankataan kirjoitettua merkkipohjan labelia vasten. EI jsdom-docblockia.

const row = (id: string, name: string, qty = 1) => ({ id, name, qty })

const names = (label: string, rows: ReturnType<typeof row>[]): string[] =>
  rankInventoryRows(label, rows).map((r) => r.row.name)

describe('T398 — rankInventoryRows', () => {
  const PROD = [
    row('a', 'Shuttle-bus opaste'),
    row('b', 'Shuttle-bus aikataulu'),
    row('c', 'Nuoli irtokyltti, valkoinen tausta', 18),
    row('d', 'Ennako, vasen 90', 8),
    row('e', 'Peikko, kolmio irtokyltti'),
  ]

  it('osittainen hakusana löytää rivin ("bus" → Shuttle-bus)', () => {
    const hits = names('bus', PROD)
    expect(hits).toContain('Shuttle-bus opaste')
    expect(hits).toContain('Shuttle-bus aikataulu')
  })

  it('typo osuu MOLEMPIIN suuntiin — virhe voi olla kummassa päässä tahansa', () => {
    // Kirjoitat oikein, rivissä on typo:
    expect(names('Ennakko, vasen 90', PROD)).toContain('Ennako, vasen 90')
    // Kirjoitat väärin, rivi on oikein:
    expect(names('Peiko, kolmio', PROD)).toContain('Peikko, kolmio irtokyltti')
  })

  it('V278: irtokyltti-suffiksi ⊥ estä osumaa', () => {
    expect(names('Peikko, kolmio', PROD)).toContain('Peikko, kolmio irtokyltti')
    expect(names('Nuoli, valkoinen tausta', PROD)).toContain('Nuoli irtokyltti, valkoinen tausta')
  })

  it('tyhjä / whitespace-label → ⊥ ehdotuksia', () => {
    expect(rankInventoryRows('', PROD)).toEqual([])
    expect(rankInventoryRows('   ', PROD)).toEqual([])
  })

  it('tyhjä rows ⊥ kaadu', () => {
    expect(rankInventoryRows('mikä vaan', [])).toEqual([])
  })

  it('kynnyksen alle jäävä ⊥ päädy tulokseen', () => {
    expect(names('Taittopöytä', PROD)).toEqual([])
  })

  it('järjestys laskeva & deterministinen kahdella ajolla', () => {
    const a = rankInventoryRows('shuttle', PROD)
    const b = rankInventoryRows('shuttle', PROD)
    expect(a).toEqual(b)
    expect(a.map((r) => r.score)).toEqual([...a.map((r) => r.score)].sort((x, y) => y - x))
  })

  it('palauttaa alkuperäisen rivi-olion (UI tarvitsee qty/paikan)', () => {
    const rich = { id: 'x', name: 'Peikko', qty: 4, locationName: 'Kärry' }
    expect(rankInventoryRows('Peikko', [rich])[0].row).toBe(rich)
  })

  it('samannimiset rivit säilyttävät syötejärjestyksen (tasapeli ⊥ heilu)', () => {
    const rows = [row('a', 'Peikko'), row('b', 'Peikko')]
    expect(rankInventoryRows('Peikko', rows).map((r) => r.row.id)).toEqual(['a', 'b'])
  })
})

describe('T398 — cleanDisplayName (V278/V186)', () => {
  it('poistaa kiinnitystapa-sanan säilyttäen välit & ison alkukirjaimen', () => {
    expect(cleanDisplayName('Nuoli irtokyltti, valkoinen tausta')).toBe('Nuoli, valkoinen tausta')
    expect(cleanDisplayName('Ennakko oikea, 90 irtokyltti')).toBe('Ennakko oikea, 90')
    expect(cleanDisplayName('Peikko, kolmio irtokyltti')).toBe('Peikko, kolmio')
  })

  it('tuntee taivutukset (tuotantodata sisältää ne)', () => {
    expect(cleanDisplayName('Peikkopolku, lisäkilvellä')).toBe('Peikkopolku')
    expect(cleanDisplayName('Huolto 25 km lisäkilpi')).toBe('Huolto 25 km')
  })

  it('nimi ILMAN suffiksia palautuu muuttumattomana', () => {
    expect(cleanDisplayName('Shuttle-bus aikataulu')).toBe('Shuttle-bus aikataulu')
    expect(cleanDisplayName('10,1 km')).toBe('10,1 km')
  })

  it('siivoaa roikkuvan pilkun & tuplavälin', () => {
    expect(cleanDisplayName('Peikko , kolmio')).toBe('Peikko, kolmio')
    expect(cleanDisplayName('Nuoli irtokyltti')).toBe('Nuoli')
    expect(cleanDisplayName('irtokyltti, Peikko')).toBe('Peikko')
  })

  it('tyhjä → tyhjä, pelkkä suffiksi → tyhjä', () => {
    expect(cleanDisplayName('')).toBe('')
    expect(cleanDisplayName('irtokyltti')).toBe('')
  })
})

describe('T398 — unlinkedItems/unlinkedCount (siirretty T386:sta, sama semantiikka)', () => {
  const items = [
    { id: 'a', name: 'Kapeneva tie', templateId: null, notSign: false },
    { id: 'b', name: 'Peikko', templateId: 'peikko-1', notSign: false },
    { id: 'c', name: 'Taittopöytä', templateId: null, notSign: true },
    { id: 'd', name: 'Nuoli', templateId: null },
  ]

  it('suodattaa linkatut & tarvikkeet', () => {
    expect(unlinkedItems(items).map((i) => i.id)).toEqual(['a', 'd'])
    expect(unlinkedCount(items)).toBe(2)
  })

  it('tyhjä lista → 0', () => {
    expect(unlinkedCount([])).toBe(0)
  })
})
