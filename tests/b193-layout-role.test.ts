// @vitest-environment jsdom
//
// B193/V346: admin-tili sai `body[data-role="admin"]` ∴ jokainen
// `[data-role="järjestäjä"]`-CSS-sääntö ohitti hänet HILJAA. Näkyvin seuraus: kapealla
// ruudulla `#map-filter-bar` menetti 48px sisennyksensä & "Suodata" asettui
// `#left-panel-toggle`in päälle nappaamaan klikin ⇒ suunnittelupaneelia ⊥ saanut auki.
//
// Vahti on TÄÄLLÄ eikä pelkässä E2E:ssä: kartta rooli→layout on puhdas funktio, ja se on
// se asia joka uuden roolin tullessa unohtuu. E2E vahtii lisäksi geometrian.
import { describe, it, expect, beforeEach } from 'vitest'
import { layoutRole, applyRoleView, applyRoleHide } from '../src/app/role-view'

describe('B193/V346 — layout-rooli ⊥ tilirooli', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete document.body.dataset.role
  })

  it('admin saa järjestäjän layoutin (VISION §Roolihierarkia: admin ⊇ järjestäjä)', () => {
    expect(layoutRole('admin')).toBe('järjestäjä')
  })

  it('järjestäjä pysyy järjestäjänä, talkoolainen talkoolaisena', () => {
    expect(layoutRole('järjestäjä')).toBe('järjestäjä')
    expect(layoutRole('talkoolainen')).toBe('talkoolainen')
  })

  it('tuntematon rooli EI putoa talkoolaiseksi — oletus on rajoittavampi layout', () => {
    // Tuntematon = uusi tilirooli jota ⊥ ole vielä kartoitettu. Järjestäjä-layout on se
    // jossa kaikki kontrollit ovat paikoillaan; talkoolais-layout piilottaa sivupaneelin
    // ∴ väärä arvaus siihen suuntaan poistaisi toimintoja näkymättömiin.
    expect(layoutRole('joku-uusi')).toBe('järjestäjä')
  })

  it('applyRoleView kirjoittaa LAYOUT-roolin, ei tiliroolia', () => {
    applyRoleView('admin')
    expect(document.body.dataset.role).toBe('järjestäjä')
  })

  it('applyRoleHide piilottaa talkoolaislohkon myös adminilta', () => {
    const tk = document.createElement('div')
    tk.dataset.roleHide = 'järjestäjä'
    const jr = document.createElement('div')
    jr.dataset.roleHide = 'talkoolainen'
    document.body.append(tk, jr)

    applyRoleHide('admin')

    expect(tk.hidden).toBe(true)   // talkoolaisen ⋯-lohko pois adminilta
    expect(jr.hidden).toBe(false)  // järjestäjän omat jäävät
  })

  it('talkoolainen piilottaa järjestäjälohkot, ei omiaan', () => {
    const tk = document.createElement('div')
    tk.dataset.roleHide = 'järjestäjä'
    const jr = document.createElement('div')
    jr.dataset.roleHide = 'talkoolainen'
    document.body.append(tk, jr)

    applyRoleHide('talkoolainen')

    expect(tk.hidden).toBe(false)
    expect(jr.hidden).toBe(true)
  })
})
