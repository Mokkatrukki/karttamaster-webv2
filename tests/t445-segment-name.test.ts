import { describe, it, expect } from 'vitest'
import { segmentDisplayName, PHASE_PREFIX } from '../src/logic/segment-name'
import { createSegmentStore, createSegment, cloneSegmentToNextPhase } from '../src/logic/segments'

describe('T445 — segmentDisplayName (vaihe-etuliite, johdettu)', () => {
  it('etuliite vaiheittain: purku ja tarkastus saavat sanan, asetus ei', () => {
    expect(PHASE_PREFIX.asettaminen).toBe('')
    expect(segmentDisplayName({ phase: 'purku' }, 'Pätkä 3')).toBe('Purku Pätkä 3')
    expect(segmentDisplayName({ phase: 'tarkastus' }, 'Pätkä 3')).toBe('Tarkastus Pätkä 3')
    expect(segmentDisplayName({ phase: 'asettaminen' }, 'Pätkä 3')).toBe('Pätkä 3')
  })

  it('displayName ohittaa etuliitteen — järjestäjän nimi on ylikirjoitus ⊥ pohja', () => {
    expect(segmentDisplayName({ phase: 'purku', displayName: 'Kalliolenkki' })).toBe('Kalliolenkki')
    expect(segmentDisplayName({ phase: 'tarkastus', displayName: 'Kalliolenkki' })).toBe('Kalliolenkki')
  })

  it('tyhjä/whitespace displayName ⊥ ole nimi — fallback + etuliite', () => {
    expect(segmentDisplayName({ phase: 'purku', displayName: '   ' }, 'Pätkä 3')).toBe('Purku Pätkä 3')
  })

  it('oletusfallback nimettömälle pätkälle', () => {
    expect(segmentDisplayName({ phase: 'purku' })).toBe('Purku Nimetön pätkä')
    expect(segmentDisplayName({ phase: 'asettaminen' })).toBe('Nimetön pätkä')
  })

  // JOHDETTU ⊥ TALLENNETTU: kanta säilyy ennallaan ∴ klooniketju ⊥ kerrytä etuliitteitä.
  it('kloonaus (T439) ⊥ kerrytä etuliitettä nimeen', () => {
    const store = createSegmentStore()
    const original = createSegment(store, { equipment: [], phase: 'asettaminen' })
    const tarkastus = cloneSegmentToNextPhase(store, original)!
    const purku = cloneSegmentToNextPhase(store, tarkastus)!
    expect(purku.displayName).toBeUndefined()
    expect(segmentDisplayName(purku, 'Pätkä 1')).toBe('Purku Pätkä 1')
    expect(segmentDisplayName(tarkastus, 'Pätkä 1')).toBe('Tarkastus Pätkä 1')
    // sama pätkä siirrettynä purkuun → etuliite seuraa vaihetta, nimi kannassa ⊥ muutu
    expect(segmentDisplayName({ ...tarkastus, phase: 'purku' }, 'Pätkä 1')).toBe('Purku Pätkä 1')
  })
})
