// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { renderAdminPhase } from '../src/ui/admin-page'
import { PHASE_ORDER, phaseChangeWarning, phaseChangeErrorMessage } from '../src/logic/phase-labels'
import type { Segment } from '../src/logic/segments'

function mount(phase: Segment['phase'], onChangePhase = vi.fn(async () => null)) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  renderAdminPhase(el, { phase, onChangePhase })
  return { el, onChangePhase }
}

const $ = <T extends HTMLElement>(el: HTMLElement, sel: string) => el.querySelector<T>(sel)!

describe('T433/V321 — vaihehallinta admin-paneelissa', () => {
  test('nykytila renderöityy ENNEN valitsinta — admin ei vaihda vaihetta tietämättä mistä lähtee', () => {
    const { el } = mount('tarkastus')
    const current = $(el, '.admin-phase-current')
    expect(current.textContent).toBe('Käynnissä: Tarkastusvaihe')
    // Järjestys DOM:ssa: nykytila ennen valitsinta.
    const select = $(el, '.admin-phase-select')
    expect(current.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect((select as HTMLSelectElement).value).toBe('tarkastus')
  })

  test('vahvistus näyttää KOHDEVAIHEEN seurauksen, ei geneeristä kysymystä', () => {
    const { el } = mount('asettaminen')
    const select = $<HTMLSelectElement>(el, '.admin-phase-select')
    expect($(el, '.admin-phase-confirm').hidden).toBe(true)

    select.value = 'purku'
    select.dispatchEvent(new Event('change'))

    expect($(el, '.admin-phase-confirm').hidden).toBe(false)
    const warning = $(el, '.admin-phase-warning').textContent ?? ''
    expect(warning).toBe(phaseChangeWarning('purku'))
    expect(warning).toContain('Purku alkaa kaikille')
    expect(warning).not.toBe('Oletko varma?')
    expect($(el, '.admin-phase-apply').textContent).toBe('Käynnistä: Purku')
  })

  test('peruutus EI kutsu serveriä & palauttaa valitsimen nykytilaan', () => {
    const { el, onChangePhase } = mount('asettaminen')
    const select = $<HTMLSelectElement>(el, '.admin-phase-select')
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))

    $<HTMLButtonElement>(el, '.admin-phase-cancel').click()

    expect(onChangePhase).not.toHaveBeenCalled()
    expect($(el, '.admin-phase-confirm').hidden).toBe(true)
    expect(select.value).toBe('asettaminen')
  })

  test('onnistunut vaihto päivittää nykytila-rivin ilman reloadia', async () => {
    const { el, onChangePhase } = mount('asettaminen')
    const select = $<HTMLSelectElement>(el, '.admin-phase-select')
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))
    $<HTMLButtonElement>(el, '.admin-phase-apply').click()
    await vi.waitFor(() => expect($(el, '.admin-phase-current').textContent).toBe('Käynnissä: Purkuvaihe'))

    expect(onChangePhase).toHaveBeenCalledWith('purku')
    expect($(el, '.admin-phase-confirm').hidden).toBe(true)
    expect($(el, '.admin-phase-error').hidden).toBe(true)
  })

  test('epäonnistunut vaihto EI väitä vaihtaneensa — nykytila ennallaan & virhe näkyy', async () => {
    const failing = vi.fn(async () => 'Vain admin voi vaihtaa vaihetta.')
    const { el } = mount('asettaminen', failing)
    const select = $<HTMLSelectElement>(el, '.admin-phase-select')
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))
    $<HTMLButtonElement>(el, '.admin-phase-apply').click()

    await vi.waitFor(() => expect($(el, '.admin-phase-error').hidden).toBe(false))
    expect($(el, '.admin-phase-error').textContent).toBe('Vain admin voi vaihtaa vaihetta.')
    expect($(el, '.admin-phase-current').textContent).toBe('Käynnissä: Asetusvaihe')
    expect(select.value).toBe('asettaminen')
  })

  test('nykyisen vaiheen uudelleenvalinta ei avaa vahvistusta', () => {
    const { el } = mount('purku')
    const select = $<HTMLSelectElement>(el, '.admin-phase-select')
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))
    expect($(el, '.admin-phase-confirm').hidden).toBe(true)
  })

  test('∀ vaiheella on seurauslause — uusi vaihe ei putoa hiljaa vahvistuksesta', () => {
    for (const phase of PHASE_ORDER) {
      const w = phaseChangeWarning(phase)
      expect(w.length).toBeGreaterThan(20)
      expect(w).toContain('kaikille')
    }
  })
})

describe('T435/V322 — virheviesti on toimenpide, ei toteamus', () => {
  test('jokainen syy saa OMAN viestinsä', () => {
    const msgs = [null, 401, 403, 404, 500, 503].map(phaseChangeErrorMessage)
    expect(new Set(msgs.slice(0, 5)).size).toBe(5)
    expect(phaseChangeErrorMessage(403)).toContain('admin')
    expect(phaseChangeErrorMessage(404)).toContain('backend')
    expect(phaseChangeErrorMessage(null)).toContain('yhteyttä')
    expect(phaseChangeErrorMessage(500)).toContain('Serverivirhe')
    expect(phaseChangeErrorMessage(503)).toContain('Serverivirhe')
  })

  test('403 ja 404 eivät saa samaa lausetta — juuri se sekaannus maksoi tunnin 2026-07-31', () => {
    expect(phaseChangeErrorMessage(403)).not.toBe(phaseChangeErrorMessage(404))
  })
})
