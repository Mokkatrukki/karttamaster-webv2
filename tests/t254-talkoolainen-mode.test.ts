import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getViewMode,
  setViewMode,
  initTalkoolainenMode,
  type ViewMode,
} from '../src/app/talkoolainen-mode'

// T254/V174–176 (R1 keystone): talkoolaisen kaksi-moodi-kehys. Vitest-jsdom — puhdas DOM,
// kartan invalidateSize injektoidaan onEnterKartta-callbackina.

function setupDom(): { app: HTMLElement; btnToMap: HTMLElement; btnHome: HTMLElement } {
  document.body.innerHTML = `
    <div id="app">
      <button id="btn-home-view">🏠</button>
      <button id="btn-to-map">Kartalle →</button>
      <div id="map"></div>
      <div id="segment-view-container"><div id="segment-view"></div></div>
    </div>`
  return {
    app: document.getElementById('app')!,
    btnToMap: document.getElementById('btn-to-map')!,
    btnHome: document.getElementById('btn-home-view')!,
  }
}

beforeEach(() => {
  // Nollaa moodi jokaisen testin väliin (moduulitason state).
  setViewMode('koti')
  document.body.innerHTML = ''
})

describe('T254 — talkoolaisen moodikehys', () => {
  it('V174: init asettaa oletusmoodiksi koti + #app data-view-mode="koti"', () => {
    const { app, btnToMap, btnHome } = setupDom()
    initTalkoolainenMode({ btnToMap, btnHome })
    expect(getViewMode()).toBe<ViewMode>('koti')
    expect(app.getAttribute('data-view-mode')).toBe('koti')
  })

  it('"Kartalle →" -klikki → kartta-moodi + onEnterKartta kutsutaan (invalidateSize)', () => {
    const { app, btnToMap, btnHome } = setupDom()
    const onEnterKartta = vi.fn()
    initTalkoolainenMode({ btnToMap, btnHome, onEnterKartta })

    btnToMap.click()
    expect(getViewMode()).toBe('kartta')
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
    expect(onEnterKartta).toHaveBeenCalledTimes(1)
  })

  it('"🏠" -klikki karttamoodista → koti-moodi (ei onEnterKartta)', () => {
    const { app, btnToMap, btnHome } = setupDom()
    const onEnterKartta = vi.fn()
    initTalkoolainenMode({ btnToMap, btnHome, onEnterKartta })

    btnToMap.click() // koti → kartta
    onEnterKartta.mockClear()
    btnHome.click() // kartta → koti
    expect(getViewMode()).toBe('koti')
    expect(app.getAttribute('data-view-mode')).toBe('koti')
    expect(onEnterKartta).not.toHaveBeenCalled()
  })

  it('setViewMode kutsuu onEnterKartta VAIN karttamoodissa', () => {
    setupDom()
    const onEnterKartta = vi.fn()
    setViewMode('kartta', onEnterKartta)
    expect(onEnterKartta).toHaveBeenCalledTimes(1)
    setViewMode('koti', onEnterKartta)
    expect(onEnterKartta).toHaveBeenCalledTimes(1) // ei lisäkutsua kotiin
  })

  it('V176: moodivaihto ei kosketa segment-/marker-DOM:ia (pelkkä data-attribuutti)', () => {
    const { app } = setupDom()
    const seg = document.getElementById('segment-view')!
    seg.dataset.marker = 'säilyy'
    setViewMode('kartta')
    setViewMode('koti')
    // Segment-DOM ennallaan — moodi vaihtaa vain #app-attribuutin.
    expect(seg.dataset.marker).toBe('säilyy')
    expect(app.getAttribute('data-view-mode')).toBe('koti')
  })

  it('null-napit eivät kaada initiä (defensiivinen wiring)', () => {
    setupDom()
    expect(() => initTalkoolainenMode({ btnToMap: null, btnHome: null })).not.toThrow()
    expect(getViewMode()).toBe('koti')
  })
})
