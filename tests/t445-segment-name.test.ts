import { describe, it, expect } from 'vitest'
import { segmentDisplayName, isAutoSegmentName, PHASE_PREFIX } from '../src/logic/segment-name'
import { createSegmentStore, createSegment, cloneSegmentToNextPhase } from '../src/logic/segments'

describe('T445 — segmentDisplayName (vaihe-etuliite, johdettu)', () => {
  it('automaattinimi purussa → etuliite eteen', () => {
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Pätkä 3' })).toBe('Purku Pätkä 3')
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Aluetehtävä 1' })).toBe('Purku Aluetehtävä 1')
    expect(segmentDisplayName({ phase: 'tarkastus', displayName: 'Pätkä 3' })).toBe('Tarkastus Pätkä 3')
  })

  it('käyttäjän nimeämä purussa → EI etuliitettä ("voi ylikirjata")', () => {
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Kalliolenkki' })).toBe('Kalliolenkki')
    // "Pätkä" + jotain muuta kuin pelkkä numero on käyttäjän kirjoittama nimi
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Pätkä 3 pohjoinen' })).toBe('Pätkä 3 pohjoinen')
    expect(segmentDisplayName({ phase: 'tarkastus', displayName: 'Kalliolenkki' })).toBe('Kalliolenkki')
  })

  it('asettaminen ⊥ saa etuliitettä kummassakaan tapauksessa', () => {
    expect(PHASE_PREFIX.asettaminen).toBe('')
    expect(segmentDisplayName({ phase: 'asettaminen', displayName: 'Pätkä 3' })).toBe('Pätkä 3')
    expect(segmentDisplayName({ phase: 'asettaminen', displayName: 'Kalliolenkki' })).toBe('Kalliolenkki')
    expect(segmentDisplayName({ phase: 'asettaminen' })).toBe('Nimetön pätkä')
  })

  it('isAutoSegmentName tunnistaa luonnin esitäytön, ⊥ enempää', () => {
    expect(isAutoSegmentName('Pätkä 1')).toBe(true)
    expect(isAutoSegmentName('Aluetehtävä 12')).toBe(true)
    expect(isAutoSegmentName('  Pätkä 2  ')).toBe(true)
    expect(isAutoSegmentName('Pätkä Kalliolenkki')).toBe(false)
    expect(isAutoSegmentName('Purku Pätkä 1')).toBe(false)
    expect(isAutoSegmentName(undefined)).toBe(false)
  })

  it('nimetön pätkä (⊥ displayNamea) saa etuliitteen fallbackin eteen', () => {
    expect(segmentDisplayName({ phase: 'purku' })).toBe('Purku Nimetön pätkä')
    expect(segmentDisplayName({ phase: 'purku', displayName: '   ' }, 'Pätkäsi')).toBe('Purku Pätkäsi')
  })

  // JOHDETTU ⊥ TALLENNETTU: kanta säilyy ennallaan ∴ klooniketju ⊥ kerrytä etuliitteitä.
  it('klooni purkuun (T439) ⊥ saa kaksoisetuliitettä', () => {
    const store = createSegmentStore()
    const original = createSegment(store, {
      equipment: [], phase: 'asettaminen', displayName: 'Pätkä 3',
    })
    const tarkastus = cloneSegmentToNextPhase(store, original)!
    const purku = cloneSegmentToNextPhase(store, tarkastus)!
    // kantaan ⊥ kirjoiteta etuliitettä missään vaiheessa ketjua
    expect(tarkastus.displayName).toBe('Pätkä 3')
    expect(purku.displayName).toBe('Pätkä 3')
    expect(segmentDisplayName(tarkastus)).toBe('Tarkastus Pätkä 3')
    expect(segmentDisplayName(purku)).toBe('Purku Pätkä 3')
    // etuliite seuraa vaihetta, ⊥ kerry: sama pätkä siirrettynä purkuun
    expect(segmentDisplayName({ ...tarkastus, phase: 'purku' })).toBe('Purku Pätkä 3')
  })

  it('etuliitteellinen nimi kannassa ⊥ etuliitettäisi toista kertaa (varajärjestelmä)', () => {
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Purku Pätkä 3' })).toBe('Purku Pätkä 3')
  })
})
