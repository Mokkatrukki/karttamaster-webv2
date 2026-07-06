import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { signCatalog, placeSignIds } from '../src/logic/sign-catalog'

afterEach(() => { document.body.innerHTML = '' })

function setup() {
  const c = document.createElement('div')
  document.body.appendChild(c)
  return c
}

describe('T161-kuratointi: kertakäyttöiset paikkamerkit', () => {
  it('katalogi merkitsee paikannimet category=place, palvelut=sign', () => {
    const byId = Object.fromEntries(signCatalog().map(e => [e.id, e.category]))
    expect(byId['iso-syote-430']).toBe('place')
    expect(byId['pitamavaara-262']).toBe('place')
    expect(byId['wc']).toBe('sign')
    expect(byId['huolto-service']).toBe('sign')
  })

  it('placeSignIds sisältää paikannimet, ei palveluita', () => {
    const ids = placeSignIds()
    expect(ids.has('iso-syote-430')).toBe(true)
    expect(ids.has('wc')).toBe(false)
  })

  it('paikkaosio on piilossa oletuksena, pääosio ei sisällä paikkamerkkejä', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    const placeHeader = c.querySelector('.sign-lib-place-header')!
    expect(placeHeader.textContent).toContain('Paikkamerkit')
    // collapsed → ei hakua, ei paikkalistaa
    expect(c.querySelector('.sign-lib-place-search')).toBeNull()
    expect(c.querySelector('.sign-lib-place-list')).toBeNull()
    // päälistan napit eivät sisällä paikkamerkkiä
    const mainIds = [...c.querySelectorAll<HTMLElement>('.sign-lib-list .sign-lib-place-btn')].map(b => b.dataset.id)
    expect(mainIds).not.toContain('iso-syote-430')
  })

  it('paikkaosion avaus näyttää haun + paikkarivit, haku suodattaa', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    c.querySelector<HTMLElement>('.sign-lib-place-header')!.click() // expand
    const search = c.querySelector<HTMLInputElement>('.sign-lib-place-search')!
    expect(search).toBeTruthy()
    const rows = c.querySelectorAll<HTMLElement>('.sign-lib-place-list .sign-lib-row')
    expect(rows.length).toBeGreaterThan(10)

    search.value = 'pitämä'
    search.dispatchEvent(new Event('input'))
    const visible = [...rows].filter(r => r.style.display !== 'none')
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThan(rows.length)
  })
})
