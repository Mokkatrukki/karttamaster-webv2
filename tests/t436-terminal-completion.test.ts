// T436/V326: valmius katsoo tehtävän KOKO merkkijoukkoa. Puhdas taso — ei DOM:ia.
//
// B175: purun avoin joukko on `asetettu|tarkistettu` (V313) ∴ kuittaamatta jäänyt
// `suunniteltu`-merkki ⊥ ole avoin — hero julisti "✓ Kaikki kerätty 🎉" kun kerättyjä oli 1/12.
import { describe, it, expect } from 'vitest'
import {
  phaseTarget, segmentTarget, isOpenInSegment, isTerminalInSegment,
  isPendingInSegment, isTaskComplete,
} from '../src/logic/phase-target'
import { pendingMarkersOrdered, unsetMarkersOrdered } from '../src/logic/navigation'
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
  return { id: 's1', name: 'P1', phase, routeIds: ['r1'], startDist: 0, endDist: 20000 } as Segment
}

describe('T436/V326 — päätetilat ja valmius', () => {
  it('(a) ∀ vaihe tarjoaa ei-tyhjät terminalStatuses + pendingLabelin', () => {
    for (const p of PHASES) {
      const t = phaseTarget(p)
      expect(t.terminalStatuses.length).toBeGreaterThan(0)
      expect(t.pendingLabel).toBeTruthy()
    }
    expect(segmentTarget({ markerTypeFilter: 'kerayskasa' }).terminalStatuses.length).toBeGreaterThan(0)
  })

  it('(a) purku & keräys: päätetilat ovat tasan kerätty|ei_tarpeen', () => {
    expect(phaseTarget('purku').terminalStatuses.sort()).toEqual(['ei_tarpeen', 'kerätty'])
    expect(segmentTarget({ markerTypeFilter: 'kerayskasa' }).terminalStatuses.sort())
      .toEqual(['ei_tarpeen', 'kerätty'])
  })

  it('(a) asetuksessa `asetettu` on päätetila — muuten "Kaikki asetettu" ⊥ tulisi koskaan', () => {
    expect(isTerminalInSegment('asetettu', seg('asettaminen'))).toBe(true)
    expect(isTaskComplete([marker('a', 'asetettu', 100)], seg('asettaminen'))).toBe(true)
  })

  it('avoin ja päätetila eivät leikkaa missään vaiheessa', () => {
    for (const p of PHASES) {
      for (const s of STATUSES) {
        expect(isOpenInSegment(s, seg(p)) && isTerminalInSegment(s, seg(p))).toBe(false)
      }
    }
  })

  it('(B175) purussa 1 kerätty + 11 suunniteltu ⊥ ole valmis vaikka avoimia ⊥ ole', () => {
    const s = seg('purku')
    const markers = [
      marker('m0', 'kerätty', 0),
      ...Array.from({ length: 11 }, (_, i) => marker(`m${i + 1}`, 'suunniteltu', (i + 1) * 100)),
    ]
    expect(unsetMarkersOrdered(markers, s)).toEqual([]) // avoimia ei ole (V313)
    expect(isTaskComplete(markers, s)).toBe(false) // …mutta valmis se ⊥ ole (V326)
    expect(pendingMarkersOrdered(markers, s)).toHaveLength(11)
  })

  it('purku on valmis vasta kun ∀ merkki on kerätty|ei_tarpeen', () => {
    const s = seg('purku')
    expect(isTaskComplete([marker('a', 'kerätty', 0), marker('b', 'ei_tarpeen', 100)], s)).toBe(true)
    expect(isTaskComplete([marker('a', 'kerätty', 0), marker('b', 'asetettu', 100)], s)).toBe(false)
  })

  it('välitila = ⊥ avoin & ⊥ päätetila; purussa se on `suunniteltu`', () => {
    const s = seg('purku')
    expect(isPendingInSegment('suunniteltu', s)).toBe(true)
    for (const st of ['asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen'] as MarkerStatus[]) {
      expect(isPendingInSegment(st, s)).toBe(false)
    }
  })

  it('asetusvaiheessa välitilaa ⊥ ole olemassa — ∀ status on avoin tai päätetila', () => {
    for (const st of STATUSES) expect(isPendingInSegment(st, seg('asettaminen'))).toBe(false)
  })

  it('(c) `unsetMarkersOrdered` ⊥ näe välitilan merkkejä — se on oma selektorinsa', () => {
    const s = seg('purku')
    const markers = [marker('avoin', 'asetettu', 5000), marker('pending', 'suunniteltu', 1000)]
    expect(unsetMarkersOrdered(markers, s).map(m => m.id)).toEqual(['avoin'])
    expect(pendingMarkersOrdered(markers, s).map(m => m.id)).toEqual(['pending'])
  })

  it('välitilan merkit tulevat km-järjestyksessä (sama akseli kuin avoimet)', () => {
    const s = seg('purku')
    const markers = [
      marker('kauka', 'suunniteltu', 9000),
      marker('lahi', 'suunniteltu', 1000),
      marker('keski', 'suunniteltu', 5000),
    ]
    expect(pendingMarkersOrdered(markers, s).map(m => m.id)).toEqual(['lahi', 'keski', 'kauka'])
  })

  it('tyhjä joukko ⊥ ole "ei valmis" — kutsuja erottaa tyhjän pätkän', () => {
    expect(isTaskComplete([], seg('purku'))).toBe(true)
    expect(pendingMarkersOrdered([], seg('purku'))).toEqual([])
  })
})
