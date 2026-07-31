import { describe, it, expect } from 'vitest'
import { phaseTarget, segmentTarget, isOpenInSegment } from '../src/logic/phase-target'
import { firstUnsetMarker, unsetMarkersOrdered } from '../src/logic/navigation'
import type { Segment } from '../src/logic/segments'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

const PHASES: Segment['phase'][] = ['asettaminen', 'tarkastus', 'purku']
const STATUSES: MarkerStatus[] = ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen']

function marker(id: string, status: MarkerStatus, dist: number): SignMarker {
  return {
    id, type: 'right', lat: 65 + dist / 100000, lon: 27,
    distanceFromStart: dist, routeIds: ['r1'], status,
  }
}

function seg(phase: Segment['phase']): Segment {
  return {
    id: 's1', name: 'P1', phase,
    routeIds: ['r1'], startDist: 0, endDist: 10000,
  } as Segment
}

describe('T421/V313 — vaihekohtainen kuittaustavoite', () => {
  it('(i) ∀ phase palauttaa ei-tyhjän tavoitteen — uusi phase ei putoa hiljaa', () => {
    for (const p of PHASES) {
      const t = phaseTarget(p)
      expect(t.openStatuses.length).toBeGreaterThan(0)
      expect(t.doneStatuses.length).toBeGreaterThan(0)
      expect(t.targetStatus).toBeTruthy()
      expect(t.actionLabel).toBeTruthy()
    }
  })

  it('(ii) purussa avoin = asetettu|tarkistettu, EI suunniteltu', () => {
    expect(isOpenInSegment('asetettu', { phase: 'purku' })).toBe(true)
    expect(isOpenInSegment('tarkistettu', { phase: 'purku' })).toBe(true)
    expect(isOpenInSegment('suunniteltu', { phase: 'purku' })).toBe(false)
    expect(phaseTarget('purku').targetStatus).toBe('kerätty')
  })

  it('(ii) asettamisessa avoin = suunniteltu (entinen käytös)', () => {
    expect(isOpenInSegment('suunniteltu', { phase: 'asettaminen' })).toBe(true)
    expect(isOpenInSegment('asetettu', { phase: 'asettaminen' })).toBe(false)
    expect(phaseTarget('asettaminen').targetStatus).toBe('asetettu')
  })

  it('(iii) terminaalit eivät valikoidu missään vaiheessa', () => {
    for (const p of PHASES) {
      expect(isOpenInSegment('kerätty', { phase: p })).toBe(false)
      expect(isOpenInSegment('ei_tarpeen', { phase: p })).toBe(false)
    }
  })

  it('tarkastus putoaa asettaminen-oletukseen (V91: ei per-merkki-statusta)', () => {
    expect(phaseTarget('tarkastus')).toEqual(phaseTarget('asettaminen'))
    expect(phaseTarget(undefined)).toEqual(phaseTarget('asettaminen'))
  })

  it('avoin ja tehty eivät leikkaa missään vaiheessa', () => {
    for (const p of PHASES) {
      const t = phaseTarget(p)
      for (const s of STATUSES) {
        expect(t.openStatuses.includes(s) && t.doneStatuses.includes(s)).toBe(false)
      }
    }
  })

  it('(iv) navigaatio noudattaa vaihepredikaattia — purussa asetetut, asettamisessa suunnitellut', () => {
    const markers = [
      marker('a', 'suunniteltu', 1000),
      marker('b', 'asetettu', 2000),
      marker('c', 'tarkistettu', 3000),
      marker('d', 'kerätty', 4000),
    ]
    expect(unsetMarkersOrdered(markers, seg('asettaminen')).map(m => m.id)).toEqual(['a'])
    expect(unsetMarkersOrdered(markers, seg('purku')).map(m => m.id)).toEqual(['b', 'c'])
    expect(firstUnsetMarker(markers, seg('purku'))?.id).toBe('b')
  })

  it('keräystehtävä (markerTypeFilter) VOITTAA vaiheen — kasa on suunniteltu, ei asetettu', () => {
    const kerays = { phase: 'purku' as const, markerTypeFilter: 'kerayskasa' }
    expect(isOpenInSegment('suunniteltu', kerays)).toBe(true)
    expect(isOpenInSegment('asetettu', kerays)).toBe(false)
    expect(segmentTarget(kerays).targetStatus).toBe('kerätty')
    expect(segmentTarget(kerays).actionLabel).toContain('Haettu')
  })

  it('kuittausnapin verbi tulee lookupista, ei UI:n if-lauseesta', () => {
    expect(phaseTarget('asettaminen').actionLabel).toContain('Aseta')
    expect(phaseTarget('purku').actionLabel).toContain('Kerätty')
    expect(phaseTarget('purku').nextLabel).toBe('Seuraava purettava')
  })
})
