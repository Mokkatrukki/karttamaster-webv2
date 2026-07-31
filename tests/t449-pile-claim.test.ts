import { describe, it, expect, vi } from 'vitest'
import {
  pileClaim, isClaimedByOther, formatClaimAge, formatClaimLabel,
  claimErrorMessage, releaseErrorMessage,
} from '../src/logic/pile-claim'
import { claimPile, releasePile } from '../src/logic/pile-sync'
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

// ── V333/V322: epäonnistunut varaus sanotaan ääneen & TOIMENPITEENÄ ─────────────────────────
// Varaus ⊥ kulje outboxin läpi (myöhässä toimitettu varaus varaisi kasan porukalle joka ⊥ enää
// ole matkalla) ∴ verkkokatko ! näkyä käyttäjälle heti — ⊥ hiljaisena onnistumisena.

describe('V333 — varauksen epäonnistuminen kääntyy toimenpiteeksi', () => {
  it('jokainen syyluokka tuottaa ERI viestin', () => {
    const msgs = [null, 401, 403, 404, 500].map(s => claimErrorMessage(s))
    expect(new Set(msgs).size).toBe(msgs.length)
  })

  it('verkkokatko kertoo mitä tapahtui JA mitä tehdä', () => {
    const msg = claimErrorMessage(null)
    expect(msg).toContain('ei mennyt läpi')
    expect(msg).toContain('ei yhteyttä')
    expect(msg).toContain('Yritä uudelleen kun verkko palaa')
  })

  it('5xx ⊥ ole sama kuin verkkokatko', () => {
    expect(claimErrorMessage(503)).toContain('serverivirhe')
    expect(claimErrorMessage(503)).not.toContain('ei yhteyttä')
  })

  it('tuntematon status ⊥ jää sanattomaksi — koodi näkyy', () => {
    expect(claimErrorMessage(418)).toContain('418')
  })

  it('monta epäonnistunutta → luku on viestissä, ⊥ käyttäjän laskettavana', () => {
    expect(claimErrorMessage(null, 3)).toContain('3 varausta')
    expect(claimErrorMessage(null, 1)).toContain('Varaus ei mennyt läpi')
  })

  it('vapautus saa oman viestinsä — sama kuvio, eri toiminto', () => {
    expect(releaseErrorMessage(null)).toContain('Vapautus ei mennyt läpi')
    expect(releaseErrorMessage(null)).toContain('ei yhteyttä')
    expect(new Set([null, 401, 403, 404, 500].map(s => releaseErrorMessage(s))).size).toBe(5)
  })
})

describe('V333 — claimPile/releasePile kuljettavat SYYN, ⊥ pelkkää booleania', () => {
  it('fetch heittää → status null (verkko poikki, ⊥ vastausta)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await claimPile('a')).toEqual({ ok: false, reason: 'error', status: null })
    expect(await releasePile('a')).toEqual({ ok: false, status: null })
  })

  it('5xx → status kulkee läpi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })))
    expect(await claimPile('a')).toEqual({ ok: false, reason: 'error', status: 503 })
    expect(await releasePile('a')).toEqual({ ok: false, status: 503 })
  })

  it('409 on TULOS ⊥ virhe — joku ehti ensin & nimi kerrotaan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ claimed_by: 'Mikko' }) })))
    expect(await claimPile('a')).toEqual({ ok: false, reason: 'taken', by: 'Mikko' })
  })

  it('onnistuminen → ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
    expect(await claimPile('a')).toEqual({ ok: true })
    expect(await releasePile('a')).toEqual({ ok: true })
  })
})
