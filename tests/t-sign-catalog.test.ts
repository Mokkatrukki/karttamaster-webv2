import { describe, it, expect } from 'vitest'
import { signCatalog } from '../src/logic/sign-catalog'

describe('T161-kuratointi: signCatalog', () => {
  const cat = signCatalog()

  it('sisältää webp-taustaiset merkit (yli 60 kpl)', () => {
    expect(cat.length).toBeGreaterThan(60)
  })

  it('skippaa perusnuolet ja logot', () => {
    const ids = cat.map((e) => e.id)
    for (const skip of ['nuoli', 'kaannos_oikealle', 'u-kaannos_oikealle', 'syotemtb_oik', 'syote-mtb']) {
      expect(ids).not.toContain(skip)
    }
  })

  it('käyttää siistittyjä labeleita (ä/ö säilyy)', () => {
    const byId = Object.fromEntries(cat.map((e) => [e.id, e.label]))
    expect(byId['wc']).toBe('WC')
    expect(byId['iso-syote-430']).toBe('Iso-Syöte 430')
    expect(byId['pitamavaara-262']).toBe('Pitämävaara 262')
  })

  it('favoritet ovat quick-pickin yleismerkkejä', () => {
    const favs = cat.filter((e) => e.favorite).map((e) => e.id)
    expect(favs).toContain('wc')
    expect(favs).toContain('huolto-service')
    // suurin osa EI ole favorite → picker pysyy lean
    expect(favs.length).toBeLessThan(cat.length / 2)
  })

  it('id:t uniikkeja', () => {
    const ids = cat.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('säilyttää category-datan (paikka vs merkki)', () => {
    const byId = Object.fromEntries(cat.map((e) => [e.id, e.category]))
    expect(byId['iso-syote-430']).toBe('place')
    expect(byId['wc']).toBe('sign')
  })
})
