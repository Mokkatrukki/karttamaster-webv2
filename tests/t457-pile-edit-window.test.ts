// @vitest-environment jsdom
//
// T457/V342 — juuri jätetty kasa on vielä kesken: korjausikkuna sulkeutuu KÄYTTÄJÄN seuraavasta
// teosta, ⊥ ajastimesta. Käyttäjä 2026-07-31: "voin muokata ja siirtää sitä siihen asti kun
// painan seuraavaa merkkiä, tai kun painan jotain muuta nappia."

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openPileEditWindow } from '../src/app/pile-edit-window'
import { showPileDoneRow } from '../src/ui/pile-drop'

function setup(): { host: HTMLElement; setEditable: ReturnType<typeof vi.fn> } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  showPileDoneRow(host, 3, '/kasat', 'Voit vielä siirtää kasaa raahaamalla.')
  return { host, setEditable: vi.fn() }
}

function otherButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = 'Seuraava merkki'
  document.body.appendChild(btn)
  return btn
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T457/V342 — ikkuna avautuu luonnista & sulkeutuu teosta', () => {
  it('avaus tekee kasasta raahattavan', () => {
    const { host, setEditable } = setup()
    openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    expect(setEditable).toHaveBeenCalledWith('kasa-1')
  })

  it('mikä tahansa muu nappi sulkee: raahattavuus pois & rivi katoaa', () => {
    const { host, setEditable } = setup()
    openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    otherButton().click()
    expect(setEditable).toHaveBeenLastCalledWith(null)
    expect(host.querySelector('.pile-done-row')).toBeNull()
  })

  it('linkki sulkee myös (poistuminen on teko)', () => {
    const { host, setEditable } = setup()
    openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    const link = document.createElement('a')
    link.href = '#'
    document.body.appendChild(link)
    link.click()
    expect(setEditable).toHaveBeenLastCalledWith(null)
  })

  it('napin ULKOPUOLINEN klikki (kartta, tausta) ⊥ sulje — se on ikkunan KÄYTTÖÄ', () => {
    const { host, setEditable } = setup()
    openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    const map = document.createElement('div')
    document.body.appendChild(map)
    map.click()
    expect(setEditable).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.pile-done-row')).not.toBeNull()
  })

  it('suljettu ikkuna ⊥ sulkeudu toista kertaa & ⊥ jää kuuntelemaan', () => {
    const { host, setEditable } = setup()
    const win = openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    win.close()
    const calls = setEditable.mock.calls.length
    otherButton().click()
    win.close()
    expect(setEditable.mock.calls.length).toBe(calls)
  })

  it('kuittausrivin oma ✕ sulkee ikkunan (rivi & tila ovat sama asia)', () => {
    const { host, setEditable } = setup()
    openPileEditWindow({ markerId: 'kasa-1', host, setEditable })
    ;(host.querySelector('.pile-done-row-close') as HTMLButtonElement).click()
    expect(setEditable).toHaveBeenLastCalledWith(null)
    expect(host.querySelector('.pile-done-row')).toBeNull()
  })

  it('vihje kertoo ikkunan olemassaolon — tila jota ⊥ näy on tila jota ⊥ ole', () => {
    const { host } = setup()
    expect(host.querySelector('.pile-done-row-hint')!.textContent).toContain('siirtää')
  })
})
