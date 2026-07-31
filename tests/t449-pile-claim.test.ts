import { describe, it, expect } from 'vitest'
import { pileClaim, isClaimedByOther, formatClaimAge, formatClaimLabel } from '../src/logic/pile-claim'
import type { SignMarker } from '../src/logic/types'

const NOW = Date.parse('2026-07-31T12:00:00.000Z')

function m(over: Partial<SignMarker> = {}): SignMarker {
  return { id: 'k', claimedBy: undefined, claimedAt: undefined, ...over } as SignMarker
}

describe('T449/V333 — varaus on tila, ⊥ automaatti', () => {
  it('varaamaton kasa → null', () => {
    expect(pileClaim(m())).toBeNull()
    // Tyhjä nimi ⊥ ole varaus — muuten UI näyttäisi ", 5 min sitten".
    expect(pileClaim(m({ claimedBy: '   ' }))).toBeNull()
  })

  it('varattu kasa kantaa nimen & ajan', () => {
    const claim = pileClaim(m({ claimedBy: 'Mikko', claimedAt: '2026-07-31T11:15:00.000Z' }))
    expect(claim).toEqual({ by: 'Mikko', at: '2026-07-31T11:15:00.000Z' })
  })

  it('vanha rivi ilman aikaleimaa on silti varaus', () => {
    expect(pileClaim(m({ claimedBy: 'Mikko' }))).toEqual({ by: 'Mikko' })
  })

  it('oma vs toisen varaus', () => {
    const marker = m({ claimedBy: 'Mikko' })
    expect(isClaimedByOther(marker, 'Mikko')).toBe(false)
    expect(isClaimedByOther(marker, 'Liisa')).toBe(true)
    expect(isClaimedByOther(marker, undefined)).toBe(true)
    expect(isClaimedByOther(m(), 'Mikko')).toBe(false)
  })
})

describe('T449/V333 — IKÄ näytetään, ⊥ ratkaista', () => {
  it('minuutit, tunnit, vuorokaudet', () => {
    expect(formatClaimAge('2026-07-31T11:59:30.000Z', NOW)).toBe('juuri nyt')
    expect(formatClaimAge('2026-07-31T11:15:00.000Z', NOW)).toBe('45 min sitten')
    expect(formatClaimAge('2026-07-31T09:00:00.000Z', NOW)).toBe('3 t sitten')
    expect(formatClaimAge('2026-07-29T12:00:00.000Z', NOW)).toBe('2 vrk sitten')
  })

  it('vanha varaus ⊥ katoa — se vain näyttää vanhalta (⊥ automaattivanhenemista)', () => {
    // V333: kadonnut varaus on näkymätön ongelma; vanha varaus on näkyvä.
    expect(formatClaimAge('2026-07-25T12:00:00.000Z', NOW)).toBe('6 vrk sitten')
    expect(pileClaim(m({ claimedBy: 'Mikko', claimedAt: '2026-07-25T12:00:00.000Z' }))).not.toBeNull()
  })

  it('tuleva/kelvoton aikaleima ⊥ tuota negatiivista ikää', () => {
    expect(formatClaimAge('2026-08-01T12:00:00.000Z', NOW)).toBe('juuri nyt')
    expect(formatClaimAge('ei-aika', NOW)).toBe('')
    expect(formatClaimAge(undefined, NOW)).toBe('')
  })

  it('nimi & ikä yhdessä: "Mikko, 45 min sitten"', () => {
    expect(formatClaimLabel({ by: 'Mikko', at: '2026-07-31T11:15:00.000Z' }, NOW)).toBe('Mikko, 45 min sitten')
    expect(formatClaimLabel({ by: 'Mikko' }, NOW)).toBe('Mikko')
  })
})
