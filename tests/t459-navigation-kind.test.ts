// T459/V344 — navigaation joukko on KYLTIT: kasa ⊥ ole askel pätkän läpi (B191).
//
// Käyttäjä 2026-08-01: "navigointi ei saa ottaa keräyskasaa mukaan että talkoolainen saisi sen
// kerättyä, se pitää olla eri flowssa." Purussa kasa on `suunniteltu` = VÄLITILA (T436/V326) ∴
// se nousi heroon heti kun pätkän avoimet kyltit loppuivat & yksi napautus vei sen `kerätty`yn.
//
// Puhdas logiikka → Vitest-pure.

import { describe, it, expect } from 'vitest'
import {
  firstUnsetMarker,
  unsetMarkersOrdered,
  pendingMarkersOrdered,
  nearestUnsetByGps,
  nearestUnsetMarker,
  nextMarkerAhead,
  distanceAhead,
} from '../src/logic/navigation'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { SignMarker } from '../src/logic/types'
import type { MarkerStatus } from '../src/logic/types'

const SEG = { routeIds: ['r1'], startDist: 0, endDist: 10000, phase: 'purku' as const }
const SEG_SET = { ...SEG, phase: 'asettaminen' as const }
const KASA_TASK = { ...SEG, markerTypeFilter: PILE_TEMPLATE_ID }

function m(id: string, status: MarkerStatus, dist: number, templateId?: string): SignMarker {
  return {
    id,
    type: templateId ?? 'nuoli-vasen',
    lat: 65.6 + dist / 1e6,
    lon: 27.5,
    distanceFromStart: dist,
    distanceByRoute: { r1: dist },
    routeIds: ['r1'],
    status,
    ...(templateId ? { templateId } : { templateId: 'nuoli-vasen' }),
  } as SignMarker
}

const kasa = (id: string, status: MarkerStatus, dist: number): SignMarker =>
  m(id, status, dist, PILE_TEMPLATE_ID)

describe('T459/V344 — kasa ⊥ nouse navigaatioon pätkätehtävällä', () => {
  it('purku: kasa ⊥ ole "kuittaamaton merkki" vaikka se on `suunniteltu` (B191)', () => {
    const markers = [m('kyltti', 'asetettu', 1000), kasa('kasa', 'suunniteltu', 2000)]
    expect(pendingMarkersOrdered(markers, SEG).map(x => x.id)).toEqual([])
    // Kun avoimet kyltit on kuitattu, hero ⊥ saa löytää kasaa välitilasta.
    const done = [m('kyltti', 'kerätty', 1000), kasa('kasa', 'suunniteltu', 2000)]
    expect(pendingMarkersOrdered(done, SEG)).toEqual([])
    expect(unsetMarkersOrdered(done, SEG)).toEqual([])
    expect(firstUnsetMarker(done, SEG)).toBeNull()
  })

  it('purku: kuittaamaton KYLTTI nousee yhä välitilasta (rajaus koskee luokkaa ⊥ vaihetta)', () => {
    const markers = [m('unohtui', 'suunniteltu', 1000), kasa('kasa', 'suunniteltu', 2000)]
    expect(pendingMarkersOrdered(markers, SEG).map(x => x.id)).toEqual(['unohtui'])
  })

  it('asettaminen: kasa ⊥ ole asetettava merkki', () => {
    const markers = [m('kyltti', 'suunniteltu', 1000), kasa('kasa', 'suunniteltu', 500)]
    expect(unsetMarkersOrdered(markers, SEG_SET).map(x => x.id)).toEqual(['kyltti'])
    expect(firstUnsetMarker(markers, SEG_SET)!.id).toBe('kyltti')
  })

  it('GPS-oletus ⊥ valitse kasaa vaikka se olisi lähin', () => {
    const markers = [m('kyltti', 'asetettu', 9000), kasa('kasa', 'asetettu', 100)]
    const pos = { lat: 65.6001, lon: 27.5 }
    expect(nearestUnsetByGps(markers, pos, SEG)!.id).toBe('kyltti')
  })

  it('drive/kursori (⊥ pätkäkontekstia): kasa ⊥ ole reitin askel', () => {
    const markers = [m('kyltti', 'suunniteltu', 5000), kasa('kasa', 'suunniteltu', 1000)]
    expect(nearestUnsetMarker(markers, 900, 'r1')!.id).toBe('kyltti')
    expect(nextMarkerAhead(markers, 0, 'r1')!.id).toBe('kyltti')
    expect(distanceAhead(markers, 0, 'r1')).toBe(5000)
  })
})

describe('T459/V344 — tyyppitehtävä määrittelee joukkonsa itse (V143/V139)', () => {
  it('kasatehtävällä kasat SÄILYVÄT — muuten tehtävä olisi tyhjä', () => {
    const markers = [kasa('kasa-1', 'suunniteltu', 1000), kasa('kasa-2', 'suunniteltu', 4000)]
    expect(unsetMarkersOrdered(markers, KASA_TASK).map(x => x.id)).toEqual(['kasa-1', 'kasa-2'])
    expect(firstUnsetMarker(markers, KASA_TASK)!.id).toBe('kasa-1')
    expect(nearestUnsetByGps(markers, { lat: 65.604, lon: 27.5 }, KASA_TASK)!.id).toBe('kasa-2')
  })
})
