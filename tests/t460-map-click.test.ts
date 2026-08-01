// T460/V345 — kuka omistaa kartan napautuksen (B192).
//
// Kartan kerrokset (merkki, pätkäviiva, rajakahva, reittiviiva, alue) kutsuvat kaikki
// `stopPropagation`ia ∴ kartan oma `click` — josta sijoitus lukee koordinaatin — ⊥ laukea kun
// napautus osuu kerrokseen. Sijoitustilassa merkin päälle napauttaminen avasi merkkimodaalin.
//
// Puhdas logiikka → Vitest-pure.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimMapClicks, deliverMapClick, mapClickClaimed, resetMapClicks } from '../src/logic/map-click'

beforeEach(() => {
  resetMapClicks()
})

describe('T460/V345 — varaus & luovutus', () => {
  it('ilman varausta kerros tekee oman työnsä (`false` = ⊥ kulutettu)', () => {
    expect(mapClickClaimed()).toBe(false)
    expect(deliverMapClick(65.6, 27.5)).toBe(false)
  })

  it('varaus kuluttaa klikin & saa koordinaatit', () => {
    const consume = vi.fn()
    claimMapClicks(consume)
    expect(mapClickClaimed()).toBe(true)
    expect(deliverMapClick(65.61, 27.52)).toBe(true)
    expect(consume).toHaveBeenCalledWith(65.61, 27.52)
  })

  it('vapautus palauttaa klikit kerroksille', () => {
    const release = claimMapClicks(vi.fn())
    release()
    expect(mapClickClaimed()).toBe(false)
    expect(deliverMapClick(65.6, 27.5)).toBe(false)
  })

  it('uusi varaus voittaa & VANHAN vapautus ⊥ kaappaa sitä pois', () => {
    const first = vi.fn()
    const second = vi.fn()
    const releaseFirst = claimMapClicks(first)
    claimMapClicks(second)
    // Edellinen varaaja siivoaa jälkiään myöhässä — se ⊥ saa purkaa nykyistä varausta.
    releaseFirst()
    expect(mapClickClaimed()).toBe(true)
    deliverMapClick(65.6, 27.5)
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('varaus kestää useamman napautuksen (sijoituspiste siirtyy, ⊥ kulu loppuun)', () => {
    const consume = vi.fn()
    claimMapClicks(consume)
    deliverMapClick(1, 1)
    deliverMapClick(2, 2)
    expect(consume).toHaveBeenCalledTimes(2)
    expect(consume).toHaveBeenLastCalledWith(2, 2)
  })
})
