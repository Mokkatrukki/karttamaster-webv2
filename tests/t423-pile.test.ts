import { describe, it, expect } from 'vitest'
import {
  PILE_TEMPLATE_ID, pileTemplate, ensurePileTemplate, isPile, pileCount,
  unclaimedCollected,
} from '../src/logic/pile'
import { createLibrary } from '../src/logic/sign-library'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

function marker(id: string, status: MarkerStatus, extra: Partial<SignMarker> = {}): SignMarker {
  return {
    id, type: 'right', lat: 65, lon: 27, distanceFromStart: 1000,
    routeIds: ['r1'], status, ...extra,
  }
}

function pile(id: string, ids: string[], status: MarkerStatus = 'suunniteltu'): SignMarker {
  return marker(id, status, { templateId: PILE_TEMPLATE_ID, pileMarkerIds: ids })
}

describe('T423/V314 — kasan sisältö on omistussuhde', () => {
  it('(i) omistamaton kerätty päätyy kasaan', () => {
    const ms = [marker('a', 'kerätty'), marker('b', 'kerätty')]
    expect(unclaimedCollected(ms, ms).map(m => m.id)).toEqual(['a', 'b'])
  })

  it('(ii) jo kasassa oleva ei päädy toiseen kasaan', () => {
    const a = marker('a', 'kerätty')
    const b = marker('b', 'kerätty')
    const p1 = pile('p1', ['a'])
    expect(unclaimedCollected([a, b], [a, b, p1]).map(m => m.id)).toEqual(['b'])
  })

  it('(ii) tuplaklikkaus → TYHJÄ kasa, ei tuplakirjausta (idempotenssi)', () => {
    const a = marker('a', 'kerätty')
    const p1 = pile('p1', ['a'])
    expect(unclaimedCollected([a], [a, p1])).toEqual([])
  })

  it('(ii) kasa toisella pätkällä omistaa silti sisältönsä', () => {
    // Talkoolainen kävelee kasalle ∴ kasa voi olla eri pätkällä kuin sen sisältö.
    const a = marker('a', 'kerätty')
    const kaukanaOlevaKasa = pile('p1', ['a'])
    expect(unclaimedCollected([a], [kaukanaOlevaKasa])).toEqual([])
  })

  it('(iii) suunniteltu / asetettu / ei_tarpeen eivät päädy kasaan', () => {
    const ms = [
      marker('s', 'suunniteltu'), marker('a', 'asetettu'),
      marker('e', 'ei_tarpeen'), marker('k', 'kerätty'),
    ]
    expect(unclaimedCollected(ms, ms).map(m => m.id)).toEqual(['k'])
  })

  it('(iii) kasa itse ei päädy toisen kasan sisällöksi', () => {
    const haettu = pile('p1', ['a'], 'kerätty')
    expect(unclaimedCollected([haettu], [haettu])).toEqual([])
  })

  it('(v) tyhjä syöte ei heitä', () => {
    expect(unclaimedCollected([], [])).toEqual([])
  })

  it('pileCount: kasa → luku, muu merkki → null', () => {
    expect(pileCount(pile('p', ['a', 'b', 'c']))).toBe(3)
    expect(pileCount(pile('p', []))).toBe(0)
    expect(pileCount(marker('a', 'kerätty'))).toBeNull()
    expect(isPile(marker('a', 'kerätty'))).toBe(false)
  })

})

describe('T423/V315 — kasa-template on sisäänrakennettu', () => {
  it('(iv) template on olemassa ja sen id kelpaa markerTypeFilteriin', () => {
    const tpl = pileTemplate()
    expect(tpl.id).toBe(PILE_TEMPLATE_ID)
    expect(tpl.iconId).toBeTruthy()
    expect(/^[A-Za-z0-9_-]+$/.test(tpl.id)).toBe(true)
  })

  it('(iv) tyhjä kirjasto saa kasa-templaten', () => {
    expect(ensurePileTemplate(createLibrary()).has(PILE_TEMPLATE_ID)).toBe(true)
  })

  it('(iv) idempotentti — olemassa olevaa ei ylikirjoiteta', () => {
    const lib = createLibrary()
    lib.set(PILE_TEMPLATE_ID, { ...pileTemplate(), label: 'Käyttäjän oma nimi' })
    ensurePileTemplate(lib)
    expect(lib.get(PILE_TEMPLATE_ID)?.label).toBe('Käyttäjän oma nimi')
  })

  it('kasa ei ole quick-pickissä (talkoolainen luo sen omalla napillaan)', () => {
    expect(pileTemplate().favorite).toBe(false)
  })
})
