// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

// T313/V225: sessionStorage AINA vi.stubGlobal-mockina — natiivi konfliktoi Node v26:ssa.
function mockSessionStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  })
  return store
}

function gotoSlug(slug: string): void {
  window.history.replaceState({}, '', `/s/${slug}`)
}

beforeEach(() => {
  mockSessionStorage()
  window.history.replaceState({}, '', '/')
  // Nollaa moodi jokaisen testin väliin (moduulitason state).
  setViewMode('koti')
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
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

describe('T313/V225 — moodi säilyy saman session refreshissä', () => {
  it('tuore /s/<slug>-avaus (ei tallennettua moodia) → koti (V174 ennallaan)', () => {
    mockSessionStorage()
    gotoSlug('patka-a')
    const { app, btnToMap, btnHome } = setupDom()
    initTalkoolainenMode({ btnToMap, btnHome })
    expect(getViewMode()).toBe('koti')
    expect(app.getAttribute('data-view-mode')).toBe('koti')
  })

  it('tallennettu "kartta" samalle slugille → kartta + onEnterKartta (invalidateSize, V176)', () => {
    mockSessionStorage({ 'km:viewmode:patka-a': 'kartta' })
    gotoSlug('patka-a')
    const { app, btnToMap, btnHome } = setupDom()
    const onEnterKartta = vi.fn()
    initTalkoolainenMode({ btnToMap, btnHome, onEnterKartta })
    expect(getViewMode()).toBe('kartta')
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
    expect(onEnterKartta).toHaveBeenCalledTimes(1)
  })

  it('eri slug → koti (moodimuisti on pätkäkohtainen)', () => {
    mockSessionStorage({ 'km:viewmode:patka-a': 'kartta' })
    gotoSlug('patka-b')
    const { btnToMap, btnHome } = setupDom()
    const onEnterKartta = vi.fn()
    initTalkoolainenMode({ btnToMap, btnHome, onEnterKartta })
    expect(getViewMode()).toBe('koti')
    expect(onEnterKartta).not.toHaveBeenCalled()
  })

  it('setViewMode kirjoittaa avaimen jokaisella vaihdolla (slug-kohtaisesti)', () => {
    const store = mockSessionStorage()
    gotoSlug('patka-a')
    const { btnToMap, btnHome } = setupDom()
    initTalkoolainenMode({ btnToMap, btnHome })
    expect(store.get('km:viewmode:patka-a')).toBe('koti')
    btnToMap.click()
    expect(store.get('km:viewmode:patka-a')).toBe('kartta')
    btnHome.click()
    expect(store.get('km:viewmode:patka-a')).toBe('koti')
    // Vain oman slugin avain kirjoitetaan
    expect([...store.keys()]).toEqual(['km:viewmode:patka-a'])
  })

  it('roskadata tallennuksessa → koti (ei kaadu, ei outoa moodia)', () => {
    mockSessionStorage({ 'km:viewmode:patka-a': 'xyzzy' })
    gotoSlug('patka-a')
    const { btnToMap, btnHome } = setupDom()
    initTalkoolainenMode({ btnToMap, btnHome })
    expect(getViewMode()).toBe('koti')
  })

  it('ei slugia URL:ssa (esim. juuri) → ei muistia, ei kirjoitusta, koti', () => {
    const store = mockSessionStorage()
    window.history.replaceState({}, '', '/')
    const { btnToMap, btnHome } = setupDom()
    initTalkoolainenMode({ btnToMap, btnHome })
    btnToMap.click()
    expect(getViewMode()).toBe('kartta')
    expect(store.size).toBe(0)
  })

  it('heittävä sessionStorage (privaattitila) ei kaada initiä eikä moodivaihtoa', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    gotoSlug('patka-a')
    const { btnToMap, btnHome } = setupDom()
    expect(() => initTalkoolainenMode({ btnToMap, btnHome })).not.toThrow()
    expect(getViewMode()).toBe('koti')
    expect(() => btnToMap.click()).not.toThrow()
    expect(getViewMode()).toBe('kartta')
  })

  it('V176: refresh-palautus ei kosketa segment-DOM:ia (pelkkä attribuutti + invalidateSize)', () => {
    mockSessionStorage({ 'km:viewmode:patka-a': 'kartta' })
    gotoSlug('patka-a')
    const { btnToMap, btnHome } = setupDom()
    const seg = document.getElementById('segment-view')!
    seg.dataset.marker = 'säilyy'
    initTalkoolainenMode({ btnToMap, btnHome, onEnterKartta: vi.fn() })
    expect(seg.dataset.marker).toBe('säilyy')
  })
})
