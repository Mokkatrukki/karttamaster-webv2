// @vitest-environment jsdom
// T454: vahvistus siirtyi modaalista palkkiin (`openPileConfirmBar`) ∴ sen testit elävät
// `t454-pile-place-flow.test.ts`:ssä — kaksi kotia samalle pinnalle olisi kaksi totuutta.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { groupPileContents, resolvePileContents } from '../src/logic/pile-list'
import { buildPileContentsList } from '../src/ui/pile-contents'
import { showPilePlaceHint, removePilePlaceHint } from '../src/ui/pile-drop'
import type { SignMarker } from '../src/logic/types'

function marker(id: string, over: Partial<SignMarker> = {}): SignMarker {
  return {
    id,
    type: 'nuoli-vasen',
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 0,
    routeIds: [],
    status: 'kerätty',
    templateId: 'nuoli-vasen',
    label: 'Nuoli vasen',
    ...over,
  } as SignMarker
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T450 — sisältö ryhmitellään, ⊥ 12 identtistä riviä', () => {
  const contents = [
    marker('a'),
    marker('b'),
    marker('c'),
    marker('d', { templateId: 'nuoli-oikea', type: 'nuoli-oikea', label: 'Nuoli oikea' }),
  ]

  it('ryhmittely: tyyppi + kpl, ensiesiintymäjärjestys', () => {
    const groups = groupPileContents(contents)
    expect(groups.map(g => [g.label, g.count])).toEqual([
      ['Nuoli vasen', 3],
      ['Nuoli oikea', 1],
    ])
  })

  it('tyhjä sisältö → tyhjä ryhmittely (⊥ kaadu)', () => {
    expect(groupPileContents([])).toEqual([])
  })

  it('sisältö ratkaistaan id-listasta; poistettu merkki putoaa hiljaa pois', () => {
    expect(resolvePileContents(['a', 'kadonnut'], contents).map(m => m.id)).toEqual(['a'])
    expect(resolvePileContents(undefined, contents)).toEqual([])
  })

  it('lista renderöi ryhmät + yhteensä-rivin', () => {
    const el = buildPileContentsList(contents)
    const rows = el.querySelectorAll('.pile-contents-row')
    expect(rows.length).toBe(2)
    expect(rows[0].querySelector('.pile-contents-label')!.textContent).toBe('Nuoli vasen')
    expect(rows[0].querySelector('.pile-contents-count')!.textContent).toBe('×3')
    expect(el.querySelector('.pile-contents-total')!.textContent).toBe('Yhteensä 4 merkkiä')
  })

  it('tyhjä kasa sanotaan ääneen (tyhjä laatikko luetaan rikkinäiseksi, V21)', () => {
    const el = buildPileContentsList([])
    expect(el.querySelector('.pile-contents-empty')).not.toBeNull()
  })
})

describe('T450a — ohjelaatikko place-modessa', () => {
  it('iso laatikko ohjeteksteineen + Peruuta samassa paikassa', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    showPilePlaceHint(host, () => {})
    const box = host.querySelector('.pile-place-hint')!
    expect(box.querySelector('.pile-place-hint-text')!.textContent).toContain('hakea autolla')
    // Autolla-saavutettavuus on OHJAUS ⊥ portti (§C) — teksti ehdottaa, ⊥ estä mitään.
    expect(box.querySelector('.pile-place-hint-cancel')!.textContent).toBe('Peruuta')
  })

  it('Peruuta purkaa laatikon & kutsuu käsittelijää', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const onCancel = vi.fn()
    showPilePlaceHint(host, onCancel)
    ;(host.querySelector('.pile-place-hint-cancel') as HTMLButtonElement).click()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(host.querySelector('.pile-place-hint')).toBeNull()
  })

  it('laatikkoa ⊥ synny kahta (uusi viritys korvaa vanhan)', () => {
    const host = document.createElement('div')
    showPilePlaceHint(host, () => {})
    showPilePlaceHint(host, () => {})
    expect(host.querySelectorAll('.pile-place-hint').length).toBe(1)
    removePilePlaceHint(host)
    expect(host.querySelector('.pile-place-hint')).toBeNull()
  })
})
