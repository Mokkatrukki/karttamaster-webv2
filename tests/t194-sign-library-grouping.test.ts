import { describe, it, expect, afterEach, vi } from 'vitest'
import { SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createLibrary, createTemplate, type SignLibrary } from '../src/logic/sign-library'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

function lib(): SignLibrary {
  return createLibrary()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T194/V126 — SignLibraryPanel ryhmittely (Suosikit/Muut)', () => {
  it('renderöi "Suosikit"- ja "Muut"-väliotsikot', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Fav', color: '#000', description: '', favorite: true }, 'fav')
    createTemplate(l, { label: 'Other', color: '#000', description: '', favorite: false }, 'other')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const heads = [...c.querySelectorAll('.sign-lib-subhead')].map(e => e.textContent)
    expect(heads).toEqual(['Suosikit', 'Muut'])
  })

  it('suosikit renderöityvät ennen muita (DOM-järjestys)', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Zeta muu', color: '#000', description: '', favorite: false }, 'z')
    createTemplate(l, { label: 'Alfa suosikki', color: '#000', description: '', favorite: true }, 'a')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const groups = [...c.querySelectorAll('.sign-lib-group')]
    expect(groups[0].getAttribute('data-group')).toBe('suosikit')
    expect(groups[1].getAttribute('data-group')).toBe('muut')
  })

  it('"Muut" on label-aakkosjärjestyksessä (localeCompare fi)', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Öljy', color: '#000', description: '', favorite: false }, 'o')
    createTemplate(l, { label: 'Alfa', color: '#000', description: '', favorite: false }, 'a')
    createTemplate(l, { label: 'Beeta', color: '#000', description: '', favorite: false }, 'b')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const muut = c.querySelector('.sign-lib-group[data-group="muut"]')!
    const labels = [...muut.querySelectorAll('.sign-lib-row')].map(r => r.getAttribute('data-label'))
    expect(labels).toEqual(['alfa', 'beeta', 'öljy'])
  })

  it('suosikit myös aakkosjärjestyksessä', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Gamma', color: '#000', description: '', favorite: true }, 'g')
    createTemplate(l, { label: 'Beeta', color: '#000', description: '', favorite: true }, 'b')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const fav = c.querySelector('.sign-lib-group[data-group="suosikit"]')!
    const labels = [...fav.querySelectorAll('.sign-lib-row')].map(r => r.getAttribute('data-label'))
    expect(labels).toEqual(['beeta', 'gamma'])
  })

  it('tyhjä ryhmä ei renderöi väliotsikkoa (vain suosikkeja)', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Fav', color: '#000', description: '', favorite: true }, 'fav')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const heads = [...c.querySelectorAll('.sign-lib-subhead')].map(e => e.textContent)
    expect(heads).toEqual(['Suosikit'])
  })

  it('koko description renderöityy rivillä', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Huolto', color: '#000', description: 'Huoltopiste 25km, vesi ja banaanit', favorite: true }, 'huolto')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const desc = c.querySelector('.sign-lib-desc')
    expect(desc?.textContent).toBe('Huoltopiste 25km, vesi ja banaanit')
  })

  it('tyhjä description ei renderöi desc-elementtiä', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'Nuoli', color: '#000', description: '', favorite: true }, 'nuoli')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    expect(c.querySelector('.sign-lib-desc')).toBeNull()
  })

  it('XSS-safe: description ei interpoloi HTML:ää (V44)', () => {
    const c = setup()
    const l = lib()
    createTemplate(l, { label: 'X', color: '#000', description: '<img src=x onerror=alert(1)>', favorite: true }, 'x')
    new SignLibraryPanel(c, l, vi.fn(), vi.fn())

    const desc = c.querySelector('.sign-lib-desc')!
    expect(desc.querySelector('img')).toBeNull()
    expect(desc.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
