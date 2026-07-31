// @vitest-environment jsdom
//
// T455/V340 — kasan luonti päättyy NÄKYVÄÄN kasaan (B188).
// Käyttäjä 2026-07-31: "se on kerättävissä kun refreshaan sivun" — 3 s toast katosi ennen kuin
// katse ehti kartalta takaisin ∴ ainoa todiste teosta oli sivun uudelleenlataus.

import { describe, it, expect, beforeEach } from 'vitest'
import { showPileDoneRow, removePileDoneRow } from '../src/ui/pile-drop'

function host(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T455/V340 — tulos jää ruudulle & kantaa tien eteenpäin', () => {
  it('rivi kertoo määrän & linkittää kasalistaan', () => {
    const h = host()
    showPileDoneRow(h, 7)
    const row = h.querySelector('.pile-done-row')!
    expect(row.querySelector('.pile-done-row-text')!.textContent).toContain('7 merkkiä')
    const link = row.querySelector('.pile-done-row-link') as HTMLAnchorElement
    // Oikea navigaatio ⊥ nappi: uusi välilehti & selaimen paluu toimivat ilmaiseksi.
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/kasat')
  })

  it('rivi EI katoa itsestään — vain kuittaus poistaa sen', () => {
    const h = host()
    showPileDoneRow(h, 2)
    expect(h.querySelector('.pile-done-row')).not.toBeNull()
    ;(h.querySelector('.pile-done-row-close') as HTMLButtonElement).click()
    expect(h.querySelector('.pile-done-row')).toBeNull()
  })

  it('yksi kasa = yksi rivi (uusi korvaa vanhan, ⊥ pinoa)', () => {
    const h = host()
    showPileDoneRow(h, 1)
    showPileDoneRow(h, 3)
    expect(h.querySelectorAll('.pile-done-row').length).toBe(1)
    expect(h.querySelector('.pile-done-row-text')!.textContent).toContain('3 merkkiä')
  })

  it('palautettu funktio & `removePileDoneRow` purkavat rivin (kaksi sisääntuloa, sama tulos)', () => {
    const h = host()
    const remove = showPileDoneRow(h, 1)
    remove()
    expect(h.querySelector('.pile-done-row')).toBeNull()
    showPileDoneRow(h, 1)
    removePileDoneRow(h)
    expect(h.querySelector('.pile-done-row')).toBeNull()
  })

  it('rivi on heron ALUSSA — tulos ⊥ jää listan alle piiloon', () => {
    const h = host()
    h.appendChild(document.createElement('ul'))
    showPileDoneRow(h, 1)
    expect(h.firstElementChild!.className).toBe('pile-done-row')
  })
})
