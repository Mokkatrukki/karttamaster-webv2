// T437/V323: kuittauksen peruutus on VAIHEEN funktio kuten kuittauskin — sama lookup toisin päin.
// Puhdas taso: ei DOM:ia.
import { describe, it, expect } from 'vitest'
import { phaseTarget, segmentTarget, revertTarget, revertLabel, isOpenInSegment } from '../src/logic/phase-target'
import type { Segment } from '../src/logic/segments'
import type { MarkerStatus } from '../src/logic/types'

const STATUSES: MarkerStatus[] = ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen']
const PURKU = { phase: 'purku' as Segment['phase'] }
const ASETUS = { phase: 'asettaminen' as Segment['phase'] }
const KERAYS = { markerTypeFilter: 'kerayskasa' }

describe('T437/V323 — peruutuksen kohde tulee vaiheen lookupista', () => {
  it('(a) ∀ vaihe tarjoaa revertStatuksen + sanan', () => {
    for (const t of [phaseTarget('asettaminen'), phaseTarget('purku'), phaseTarget('tarkastus'), segmentTarget(KERAYS)]) {
      expect(t.revertStatus).toBeTruthy()
      expect(t.revertLabel).toBeTruthy()
    }
  })

  it('(a) purku: kerätty → asetettu, "Palauta keräämättömäksi"', () => {
    expect(revertTarget('kerätty', PURKU)).toBe('asetettu')
    expect(revertLabel(PURKU)).toContain('keräämättömäksi')
  })

  it('(a) asetus: asetettu → suunniteltu, "Palauta asettamattomaksi"', () => {
    expect(revertTarget('asetettu', ASETUS)).toBe('suunniteltu')
    expect(revertLabel(ASETUS)).toContain('asettamattomaksi')
  })

  it('(a) keräys: kerätty → suunniteltu, "Palauta hakemattomaksi"', () => {
    expect(revertTarget('kerätty', KERAYS)).toBe('suunniteltu')
    expect(revertLabel(KERAYS)).toContain('hakemattomaksi')
  })

  it('`ei_tarpeen` palautuu vaiheen AVOIMEEN statukseen — ⊥ arvata alkuperää', () => {
    for (const task of [PURKU, ASETUS, KERAYS]) {
      const back = revertTarget('ei_tarpeen', task)
      expect(back).not.toBeNull()
      expect(isOpenInSegment(back!, task)).toBe(true)
    }
    // purussa "ei löytynyt" palaa asetetuksi, ⊥ suunnitelluksi (muuten se katoaisi listalta)
    expect(revertTarget('ei_tarpeen', PURKU)).toBe('asetettu')
  })

  it('paluu jättää merkin AINA tehtävän listalle (avoin tai välitila, ⊥ päätetila)', () => {
    for (const task of [PURKU, ASETUS, KERAYS]) {
      for (const s of STATUSES) {
        const back = revertTarget(s, task)
        if (back === null) continue
        expect(back).not.toBe(s)
        expect(segmentTarget(task).terminalStatuses.includes(back)).toBe(false)
      }
    }
  })

  it('ei-päätetilalla ⊥ ole mitä perua → null (kutsuja ⊥ tarvitse omaa if-lausetta)', () => {
    expect(revertTarget('asetettu', PURKU)).toBeNull()
    expect(revertTarget('tarkistettu', PURKU)).toBeNull()
    expect(revertTarget('suunniteltu', ASETUS)).toBeNull()
    expect(revertTarget('suunniteltu', KERAYS)).toBeNull()
  })

  it('tarkastus & tuntematon vaihe putoavat asettaminen-oletukseen', () => {
    expect(revertTarget('asetettu', { phase: 'tarkastus' })).toBe('suunniteltu')
    expect(revertTarget('asetettu', null)).toBe('suunniteltu')
  })
})
