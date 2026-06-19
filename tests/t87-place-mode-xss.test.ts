import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PlaceMode } from '../src/ui/place-mode'
import { createLibrary, createTemplate } from '../src/logic/sign-library'
import type { SignLibrary } from '../src/logic/sign-library'

function makeMarkerManagerStub() {
  return { add: vi.fn() } as any
}

function setupDom() {
  document.body.innerHTML = `<div id="floating-picker"></div>`
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T87 PlaceMode XSS-suojaus (B21/V44)', () => {
  let lib: SignLibrary

  beforeEach(() => {
    setupDom()
    lib = createLibrary()
  })

  it('label jossa HTML-tagi ei luo DOM-elementtiä pickerissä', () => {
    createTemplate(lib, { label: '<img src=x id="xss-pm-label">', shortLabel: 'X', color: '#000', description: '', favorite: true })
    new PlaceMode(makeMarkerManagerStub(), lib)
    const picker = document.getElementById('floating-picker')!
    picker.dispatchEvent(Object.assign(new MouseEvent('mousedown'), {}))
    // simuloi openPicker kutsumalla suoraan
    const pm = new PlaceMode(makeMarkerManagerStub(), lib)
    ;(pm as any).openPicker(0, 0, 10, 10)
    expect(document.getElementById('xss-pm-label')).toBeNull()
  })

  it('shortLabel jossa HTML-tagi ei luo DOM-elementtiä pickerissä', () => {
    createTemplate(lib, { label: 'Ok', shortLabel: '<img src=x id="xss-pm-short">', color: '#000', description: '', favorite: true })
    const pm = new PlaceMode(makeMarkerManagerStub(), lib)
    ;(pm as any).openPicker(0, 0, 10, 10)
    expect(document.getElementById('xss-pm-short')).toBeNull()
  })

  it('color jossa HTML-attribuutti ei injektoidu pickerissä', () => {
    createTemplate(lib, { label: 'Ok', shortLabel: 'O', color: '#000" onmouseover="alert(1)', description: '', favorite: true })
    const pm = new PlaceMode(makeMarkerManagerStub(), lib)
    ;(pm as any).openPicker(0, 0, 10, 10)
    const picker = document.getElementById('floating-picker')!
    // väri-arvo ei saa luoda scripti-elementtiä tai rikkoa attribuuttia
    const btn = picker.querySelector<HTMLElement>('.sign-type-btn')
    expect(btn).toBeTruthy()
    // onmouseover ei saa olla DOM-attribuuttina
    expect(btn?.getAttribute('onmouseover')).toBeNull()
  })

  it('normaali template renderöityy oikein pickerin kautta', () => {
    createTemplate(lib, { label: 'Vasemmalle', shortLabel: 'V', color: '#2563eb', description: '', favorite: true }, 'left')
    const pm = new PlaceMode(makeMarkerManagerStub(), lib)
    ;(pm as any).openPicker(0, 0, 10, 10)
    const picker = document.getElementById('floating-picker')!
    const btn = picker.querySelector<HTMLElement>('.sign-type-btn[data-type="left"]')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toContain('Vasemmalle')
  })
})
