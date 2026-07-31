// T456/V341 — kohteen statuspinta on siellä missä se työ tehdään (B189).
//
// Kasan `collectable`+`hasStatus` on oikein `/kasat`ille (V332: "Haettu"), väärin pätkäkartalle:
// siellä sama nappi on vahinkoklikki jonka TOINEN porukka lukee tosiasiana ("haettu" kasasta
// jota kukaan ⊥ hakenut). Rajaus on TAULUN SARAKE ⊥ `isPile`-haara kutsupaikoissa (V331-kuvio).
//
// Puhdas logiikka → Vitest-pure (⊥ jsdom).

import { describe, it, expect } from 'vitest'
import { MARKER_KINDS, canChangeStatusOn, markerKind, isCollectable, hasStatus, type MarkerKind, type MarkerSurface } from '../src/logic/marker-kind'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'

const kasa = { templateId: PILE_TEMPLATE_ID }
const kyltti = { templateId: 'nuoli-vasen' }

describe('T456/V341 — statuspinta on taulun sarake', () => {
  it('jokaisella luokalla on `statusSurfaces` (uusi luokka ⊥ pääse läpi tyhjänä)', () => {
    for (const [kind, behavior] of Object.entries(MARKER_KINDS) as [MarkerKind, typeof MARKER_KINDS[MarkerKind]][]) {
      expect(behavior.statusSurfaces.length, kind).toBeGreaterThan(0)
    }
  })

  it('kasan status vaihtuu VAIN kasapinnalla', () => {
    expect(canChangeStatusOn(kasa, 'kasat')).toBe(true)
    expect(canChangeStatusOn(kasa, 'patka')).toBe(false)
  })

  it('kyltin status vaihtuu pätkäpinnalla — & kyltti ⊥ ole kasalistan työtä', () => {
    expect(canChangeStatusOn(kyltti, 'patka')).toBe(true)
    expect(canChangeStatusOn(kyltti, 'kasat')).toBe(false)
  })

  it('tuntematon/puuttuva template on kyltti (vanha data ⊥ menetä statustaan)', () => {
    expect(markerKind(undefined)).toBe('kyltti')
    expect(canChangeStatusOn(undefined, 'patka')).toBe(true)
    expect(canChangeStatusOn({ templateId: 'oma-malli' }, 'patka')).toBe(true)
  })

  it('rajaus koskee VAIN statusta — kasa on yhä kerättävä & statuksellinen kohde', () => {
    expect(isCollectable(kasa)).toBe(true)
    expect(hasStatus(kasa)).toBe(true)
  })

  it('pinta on suljettu joukko ∴ tuntematon pinta ⊥ avaa mitään', () => {
    const surfaces: MarkerSurface[] = ['patka', 'kasat']
    expect(surfaces.filter(s => canChangeStatusOn(kasa, s))).toEqual(['kasat'])
    expect(surfaces.filter(s => canChangeStatusOn(kyltti, s))).toEqual(['patka'])
  })
})
