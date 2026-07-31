// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { groupPileContents, resolvePileContents } from '../src/logic/pile-list'
import { buildPileContentsList } from '../src/ui/pile-contents'
import { showPilePlaceHint, removePilePlaceHint, openPileConfirm } from '../src/ui/pile-drop'
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

describe('T450b — vahvistus ennen kasan syntymistä', () => {
  const contents = [marker('a'), marker('b')]

  function open() {
    const onConfirm = vi.fn()
    const onRelocate = vi.fn()
    const onCancel = vi.fn()
    openPileConfirm(contents, { onConfirm, onRelocate, onCancel })
    return { onConfirm, onRelocate, onCancel }
  }

  it('modaali kysyy & näyttää mitä ollaan jättämässä', () => {
    open()
    expect(document.querySelector('.pile-confirm-title')!.textContent).toBe('Jätetäänkö kasa tähän?')
    expect(document.querySelector('.pile-confirm .pile-contents-total')!.textContent).toContain('2 merkkiä')
  })

  it('Vahvista luo kasan', () => {
    const { onConfirm, onCancel } = open()
    ;(document.querySelector('.pile-confirm-ok') as HTMLButtonElement).click()
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    expect(document.querySelector('.pile-confirm')).toBeNull()
  })

  it('Peruuta ⊥ luo kasaa — merkit jäävät keräyslistalle', () => {
    const { onConfirm, onCancel } = open()
    ;(document.querySelector('.pile-confirm-cancel') as HTMLButtonElement).click()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('Siirrä sijaintia palaa place-modeen eikä luo kasaa', () => {
    const { onConfirm, onRelocate } = open()
    ;(document.querySelector('.pile-confirm-relocate') as HTMLButtonElement).click()
    expect(onRelocate).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(document.querySelector('.pile-confirm')).toBeNull()
  })

  it('Esc = peruutus (puoliksi tehty kasa olisi tila jota kukaan ⊥ ole valinnut)', () => {
    const { onCancel, onConfirm } = open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('sulkeutunut modaali ⊥ laukaise toista callbackia (⊥ tuplakasaa)', () => {
    const { onConfirm, onCancel } = open()
    const ok = document.querySelector('.pile-confirm-ok') as HTMLButtonElement
    ok.click()
    ok.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
