// T438/V323: kasan poisto palauttaa sen merkit. Puhdas taso: ei DOM:ia.
import { describe, it, expect } from 'vitest'
import { pileRemoval, pileRemovalConfirm, PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

function marker(id: string, status: MarkerStatus, extra: Partial<SignMarker> = {}): SignMarker {
  return {
    id, type: 'right', lat: 65, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status, ...extra,
  }
}

function pile(id: string, ids: string[]): SignMarker {
  return marker(id, 'suunniteltu', { templateId: PILE_TEMPLATE_ID, pileMarkerIds: ids })
}

describe('T438/V323 — kasan poisto palauttaa merkit', () => {
  it('palauttaa täsmälleen kasan omat merkit, ⊥ naapurikasan', () => {
    const all = [
      pile('kasa-a', ['m1', 'm2']),
      pile('kasa-b', ['m3']),
      marker('m1', 'kerätty'), marker('m2', 'kerätty'), marker('m3', 'kerätty'),
    ]
    const r = pileRemoval(all[0], all)
    expect(r.pileId).toBe('kasa-a')
    expect(r.restored.map(x => x.id).sort()).toEqual(['m1', 'm2'])
  })

  it('merkit palaavat PURUN avoimeen statukseen (asetettu), ⊥ suunnitelluksi', () => {
    const all = [pile('kasa', ['m1']), marker('m1', 'kerätty')]
    expect(pileRemoval(all[0], all).restored).toEqual([{ id: 'm1', status: 'asetettu' }])
  })

  it('"ei löytynyt" -merkki palaa myös avoimeksi (⊥ jää päätetilaan)', () => {
    const all = [pile('kasa', ['m1']), marker('m1', 'ei_tarpeen')]
    expect(pileRemoval(all[0], all).restored).toEqual([{ id: 'm1', status: 'asetettu' }])
  })

  it('jo avoin merkki ⊥ ylikirjoiteta (joku ehti palauttaa sen)', () => {
    const all = [pile('kasa', ['m1', 'm2']), marker('m1', 'asetettu'), marker('m2', 'kerätty')]
    expect(pileRemoval(all[0], all).restored).toEqual([{ id: 'm2', status: 'asetettu' }])
  })

  it('kasan sisältö löytyy koko joukosta — kasa voi olla eri pätkällä kuin merkit (V314)', () => {
    const p = pile('kasa', ['m1'])
    expect(pileRemoval(p, [marker('m1', 'kerätty')]).restored).toHaveLength(1)
    // sisältöä ei löydy joukosta → ⊥ keksitä riviä
    expect(pileRemoval(p, []).restored).toEqual([])
  })

  it('tyhjä kasa: ⊥ palautettavaa, poisto silti laillinen', () => {
    const p = pile('kasa', [])
    expect(pileRemoval(p, [marker('m1', 'kerätty')]).restored).toEqual([])
    expect(pileRemovalConfirm(pileRemoval(p, []))).toContain('ei ole merkkejä')
  })

  it('vahvistus kertoo MITÄ palautuu ennen kuin mitään tapahtuu', () => {
    const all = [pile('kasa', ['m1', 'm2', 'm3']), marker('m1', 'kerätty'), marker('m2', 'kerätty'), marker('m3', 'kerätty')]
    expect(pileRemovalConfirm(pileRemoval(all[0], all))).toBe('Poistetaanko kasa? 3 merkkiä palaa keräyslistalle.')
    const yksi = [pile('k', ['m1']), marker('m1', 'kerätty')]
    expect(pileRemovalConfirm(pileRemoval(yksi[0], yksi))).toContain('1 merkki palaa')
  })
})
