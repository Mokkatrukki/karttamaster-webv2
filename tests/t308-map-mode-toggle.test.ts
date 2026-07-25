// T308/V219: muokkaustilan UI — toggle-napit + pysyvä "Muokkaustila"-pilleri.
// Taso 2 (Vitest-jsdom): komponentti on pure-DOM, tila injektoidaan (createMapModeState).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { initMapModeToggle, mapModeToggleLabel, MAP_MODE_PILL_TEXT } from '../src/ui/map-mode-toggle'
import { createMapModeState } from '../src/logic/map-mode'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function mountDom(): { jarj: HTMLButtonElement; tk: HTMLButtonElement; pill: HTMLElement } {
  document.body.innerHTML = `
    <button id="btn-map-mode" class="map-mode-toggle" aria-pressed="false">✎ Muokkaa</button>
    <button id="btn-tk-map-mode" class="map-mode-toggle" aria-pressed="false">✎ Muokkaa</button>
    <div id="map-area">
      <div id="map-mode-pill" class="map-mode-pill" role="status" hidden>✎ Muokkaustila</div>
    </div>`
  return {
    jarj: document.getElementById('btn-map-mode') as HTMLButtonElement,
    tk: document.getElementById('btn-tk-map-mode') as HTMLButtonElement,
    pill: document.getElementById('map-mode-pill')!,
  }
}

describe('T308/V219 — mapModeToggleLabel kertoo KOHDETILAN', () => {
  it('katselussa "✎ Muokkaa", muokkauksessa "✓ Valmis"', () => {
    expect(mapModeToggleLabel('katselu')).toBe('✎ Muokkaa')
    expect(mapModeToggleLabel('muokkaus')).toBe('✓ Valmis')
  })
})

describe('T308/V219 — toggle vaihtaa tilan ja labelin', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('löytää oletusselektorien napit + pillerin', () => {
    mountDom()
    const h = initMapModeToggle({ state: createMapModeState() })
    expect(h.buttons).toHaveLength(2)
    h.destroy()
  })

  it('klikki vaihtaa tilan katselu→muokkaus→katselu (ei omaa tilamuuttujaa)', () => {
    const { jarj } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })

    expect(state.get()).toBe('katselu')
    jarj.click()
    expect(state.get()).toBe('muokkaus')
    jarj.click()
    expect(state.get()).toBe('katselu')
    h.destroy()
  })

  it('label + aria-pressed + .active seuraavat tilaa', () => {
    const { jarj } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })

    expect(jarj.textContent).toBe('✎ Muokkaa')
    expect(jarj.getAttribute('aria-pressed')).toBe('false')
    expect(jarj.classList.contains('active')).toBe(false)

    jarj.click()
    expect(jarj.textContent).toBe('✓ Valmis')
    expect(jarj.getAttribute('aria-pressed')).toBe('true')
    expect(jarj.classList.contains('active')).toBe(true)

    jarj.click()
    expect(jarj.textContent).toBe('✎ Muokkaa')
    expect(jarj.getAttribute('aria-pressed')).toBe('false')
    expect(jarj.classList.contains('active')).toBe(false)
    h.destroy()
  })

  it('molemmat roolinapit ohjaavat SAMAA tilaa ja pysyvät synkassa (ei rooli-logiikkaa)', () => {
    const { jarj, tk } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })

    // Talkoolaisen ⋯-valikon nappi avaa muokkaustilan → järjestäjän nappi näyttää saman tilan.
    tk.click()
    expect(state.get()).toBe('muokkaus')
    expect(jarj.textContent).toBe('✓ Valmis')
    expect(tk.textContent).toBe('✓ Valmis')

    // ...ja päinvastoin.
    jarj.click()
    expect(state.get()).toBe('katselu')
    expect(tk.textContent).toBe('✎ Muokkaa')
    h.destroy()
  })

  it('ulkopuolinen state.set (esim. "+ Merkki" avaa muokkaustilan) päivittää napin', () => {
    const { jarj } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })

    state.set('muokkaus')
    expect(jarj.textContent).toBe('✓ Valmis')
    expect(jarj.getAttribute('aria-pressed')).toBe('true')
    h.destroy()
  })

  it('nappi lähtee tilan mukaisesta labelista jos tila on jo muokkaus initissä', () => {
    const { jarj, pill } = mountDom()
    const h = initMapModeToggle({ state: createMapModeState('muokkaus') })
    expect(jarj.textContent).toBe('✓ Valmis')
    expect(pill.hidden).toBe(false)
    h.destroy()
  })

  it('destroy irrottaa kuuntelijat — klikki ei enää vaihda tilaa eikä labelia', () => {
    const { jarj } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })
    h.destroy()

    jarj.click()
    expect(state.get()).toBe('katselu')
    state.set('muokkaus')
    expect(jarj.textContent).toBe('✎ Muokkaa')
  })
})

describe('T308/V219 — pilleri näkyy VAIN muokkaustilassa', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('katselussa piilossa, muokkauksessa näkyvissä, takaisin katseluun → piilossa', () => {
    const { jarj, pill } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state })

    expect(pill.hidden).toBe(true)
    jarj.click()
    expect(pill.hidden).toBe(false)
    jarj.click()
    expect(pill.hidden).toBe(true)
    h.destroy()
  })

  it('pilleri kertoo tilan SANOIN (ei pelkkä ikoni/väri, V197-linja)', () => {
    const { jarj, pill } = mountDom()
    const h = initMapModeToggle({ state: createMapModeState() })
    jarj.click()
    expect(pill.textContent).toBe(MAP_MODE_PILL_TEXT)
    expect(pill.textContent).toContain('Muokkaustila')
    // role=status → ruudunlukija ilmoittaa tilanvaihdon (pysyvä, ei ajastettu toast)
    expect(pill.getAttribute('role')).toBe('status')
    h.destroy()
  })

  it('pilleri on valinnainen — pill:null ei kaadu', () => {
    const { jarj } = mountDom()
    const state = createMapModeState()
    const h = initMapModeToggle({ state, pill: null })
    expect(() => jarj.click()).not.toThrow()
    expect(state.get()).toBe('muokkaus')
    h.destroy()
  })
})

describe('T308/V219 — index.html tarjoaa napit ja pillerin', () => {
  it('molemmat toggle-napit + pilleri ovat merkkauksessa (ei JS-injektiota)', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8')
    expect(html).toContain('id="btn-map-mode"')
    // Järjestäjän nappi piilotetaan talkoolaiselta (⋯-valikon nappi tilalle) — CSS/attr, ei logiikka
    expect(html).toMatch(/id="btn-map-mode"[^>]*data-role-hide="talkoolainen"/)
    expect(html).toContain('id="btn-tk-map-mode"')
    expect(html).toContain('id="map-mode-pill"')
    // Pilleri on piilossa lähtökohtaisesti (default katselu, V218)
    expect(html).toMatch(/id="map-mode-pill"[\s\S]*?hidden/)
  })

  it('CSS hookkaa body[data-map-mode="muokkaus"]iin (⊥ oma attribuutinkirjoitus)', () => {
    const css = readFileSync(resolve(__dirname, '../src/style.css'), 'utf8')
    expect(css).toContain('body[data-map-mode="muokkaus"] #map-area::after')
    expect(css).toContain('.map-mode-pill[hidden]')
    // Komponentti ei kirjoita body-attribuuttia itse (yksi totuus = syncMapModeToBody, V218).
    // Kommentit strippaava lähdekoodiassertio (kommenteissa attribuutti mainitaan).
    const src = readFileSync(resolve(__dirname, '../src/ui/map-mode-toggle.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(src).not.toContain('dataset.mapMode')
    expect(src).not.toContain('data-map-mode')
  })
})
