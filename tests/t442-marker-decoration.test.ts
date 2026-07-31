// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { markerDecoration } from '../src/logic/sign-visual'
import { buildMarkerVisual } from '../src/ui/marker-visual-row'

// T442/V328 — päätetila erottuu MUODOLLA, ei pelkällä värillä tai himmennyksellä.

describe('markerDecoration — kolme loppua, kolme ilmettä', () => {
  it('kerätty → vinoviiva (collected), vaiheesta riippumatta', () => {
    expect(markerDecoration('kerätty', 'purku')).toBe('collected')
    expect(markerDecoration('kerätty', 'asettaminen')).toBe('collected')
  })

  it('purun ei_tarpeen = "ei löytynyt" → oma ilme (missing, V319)', () => {
    expect(markerDecoration('ei_tarpeen', 'purku')).toBe('missing')
  })

  it('asetusvaiheen ei_tarpeen → ohitus (skipped) — eri tapahtuma, sama status', () => {
    expect(markerDecoration('ei_tarpeen', 'asettaminen')).toBe('skipped')
    expect(markerDecoration('ei_tarpeen', 'tarkastus')).toBe('skipped')
  })

  it('ilman vaihetta ei arvata "ei löytynyttä" — putoaa ohitukseen', () => {
    expect(markerDecoration('ei_tarpeen')).toBe('skipped')
  })

  it('kolme päätetilaa ovat keskenään eri arvoja — yksikään ei sulaudu toiseen', () => {
    const three = [
      markerDecoration('kerätty', 'purku'),
      markerDecoration('ei_tarpeen', 'purku'),
      markerDecoration('ei_tarpeen', 'asettaminen'),
    ]
    expect(new Set(three).size).toBe(3)
  })

  it('keskeneräiset statukset eivät saa koristetta', () => {
    for (const s of ['suunniteltu', 'asetettu', 'tarkistettu']) {
      expect(markerDecoration(s, 'purku')).toBe('none')
    }
  })
})

describe('buildMarkerVisual — koriste DOM:issa', () => {
  const base = { type: 'left', label: 'Vasen' }

  it('kerätty saa data-decoration="collected"', () => {
    const el = buildMarkerVisual({ ...base, status: 'kerätty', phase: 'purku' }, { size: 36, zoomable: false })
    expect(el.dataset.decoration).toBe('collected')
    expect(el.classList.contains('marker-visual-row-sv--collected')).toBe(true)
  })

  it('ei löytynyt ja ohitettu ovat eri luokkia — kolme tilaa erottuvat toisistaan', () => {
    const missing = buildMarkerVisual({ ...base, status: 'ei_tarpeen', phase: 'purku' }, { size: 36, zoomable: false })
    const skipped = buildMarkerVisual({ ...base, status: 'ei_tarpeen', phase: 'asettaminen' }, { size: 36, zoomable: false })
    const collected = buildMarkerVisual({ ...base, status: 'kerätty', phase: 'purku' }, { size: 36, zoomable: false })
    const set = new Set([missing.dataset.decoration, skipped.dataset.decoration, collected.dataset.decoration])
    expect(set).toEqual(new Set(['missing', 'skipped', 'collected']))
  })

  it('keskeneräinen merkki ei saa koristeatribuuttia lainkaan', () => {
    const el = buildMarkerVisual({ ...base, status: 'asetettu', phase: 'purku' }, { size: 36, zoomable: false })
    expect(el.dataset.decoration).toBeUndefined()
  })

  it('ilman statusta (merkkikirjasto, esikatselu) koriste puuttuu — vanhat kutsujat ennallaan', () => {
    const el = buildMarkerVisual(base, { size: 36, zoomable: false })
    expect(el.dataset.decoration).toBeUndefined()
  })

  it('tyyppi säilyy luettavana: ikoni/label-sisältö on yhä paikallaan viivan alla', () => {
    const el = buildMarkerVisual({ ...base, status: 'kerätty', phase: 'purku' }, { size: 36, zoomable: false })
    const box = el.querySelector('.marker-visual-row-single')
    expect(box).not.toBeNull()
    expect(box!.textContent).toContain('VAS')
  })

  it('koriste ei korvaa yhdistelmämerkin osia', () => {
    const el = buildMarkerVisual(
      { type: 'left', label: 'Combo', parts: [{ iconId: 'arrow-left' }, { iconId: 'arrow-right' }], status: 'kerätty', phase: 'purku' },
      { size: 36, zoomable: false },
    )
    expect(el.dataset.decoration).toBe('collected')
    expect(el.querySelectorAll('.marker-visual-row-combo-slot').length).toBe(2)
  })
})
