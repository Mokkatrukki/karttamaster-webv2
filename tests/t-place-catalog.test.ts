import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { listTemplates } from '../src/logic/sign-library'
import { signCatalog } from '../src/logic/sign-catalog'

afterEach(() => { document.body.innerHTML = '' })

function setup() {
  const c = document.createElement('div')
  document.body.appendChild(c)
  return c
}

describe('T161-kuratointi: yksi lista + haku + suosikit ekana', () => {
  it('kaikki merkit yhdessä listassa (myös paikannimet)', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    const rows = c.querySelectorAll('.sign-lib-list .sign-lib-row')
    expect(rows.length).toBe(listTemplates(createSignLibrary()).length)
    const ids = [...c.querySelectorAll<HTMLElement>('.sign-lib-place-btn')].map(b => b.dataset.id)
    expect(ids).toContain('iso-syote-430') // paikannimi mukana samassa listassa
    expect(ids).toContain('wc')
  })

  it('suosikit (suosituimmat) ovat listan alussa', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    const ids = [...c.querySelectorAll<HTMLElement>('.sign-lib-place-btn')].map(b => b.dataset.id!)
    const favs = listTemplates(createSignLibrary()).filter(t => t.favorite).map(t => t.id)
    // ensimmäiset N riviä = suosikkijoukko (järjestyksestä riippumatta)
    expect(new Set(ids.slice(0, favs.length))).toEqual(new Set(favs))
  })

  it('lista on scrollattava (max-height + overflow)', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    const list = c.querySelector<HTMLElement>('.sign-lib-list')!
    expect(list.style.overflowY).toBe('auto')
    expect(list.style.maxHeight).toContain('vh')
  })

  it('haku suodattaa koko listaa DOM:ssa', () => {
    const c = setup()
    new SignLibraryPanel(c, createSignLibrary(), vi.fn(), vi.fn())
    const search = c.querySelector<HTMLInputElement>('.sign-lib-search')!
    expect(search).toBeTruthy()
    const rows = c.querySelectorAll<HTMLElement>('.sign-lib-list .sign-lib-row')
    search.value = 'pitämä'
    search.dispatchEvent(new Event('input'))
    const visible = [...rows].filter(r => r.style.display !== 'none')
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThan(rows.length)
  })

  it('katalogi säilyttää category-datan (paikka vs merkki)', () => {
    const byId = Object.fromEntries(signCatalog().map(e => [e.id, e.category]))
    expect(byId['iso-syote-430']).toBe('place')
    expect(byId['wc']).toBe('sign')
  })
})
