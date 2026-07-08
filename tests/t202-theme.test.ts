import { describe, it, expect, beforeEach, vi } from 'vitest'

// V132/T202: teema on käyttäjän valittavissa, persistoituu localStorageen (V5-pattern),
// palautuu latauksessa. localStorage-mock: vi.stubGlobal (natiivi konfliktoi Node v26:ssa).

function mockLocalStorage() {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
  })
  return store
}

describe('T202 — teemapersistenssi (theme.ts)', () => {
  beforeEach(() => {
    vi.resetModules()
    document.documentElement.removeAttribute('data-theme')
  })

  it('getTheme palauttaa oletuksena "light" (Reittimerkki-vaalea)', async () => {
    mockLocalStorage()
    const { getTheme } = await import('../src/logic/theme')
    expect(getTheme()).toBe('light')
  })

  it('setTheme("dark") persistoi localStorageen ja asettaa data-theme', async () => {
    const store = mockLocalStorage()
    const { setTheme } = await import('../src/logic/theme')
    setTheme('dark')
    expect(store['karttamaster-theme']).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('initTheme palauttaa tallennetun teeman ja soveltaa sen (latausrestore)', async () => {
    mockLocalStorage()
    localStorage.setItem('karttamaster-theme', 'dark')
    const { initTheme } = await import('../src/logic/theme')
    expect(initTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggleTheme vaihtaa light↔dark ja persistoi', async () => {
    const store = mockLocalStorage()
    const { toggleTheme } = await import('../src/logic/theme')
    expect(toggleTheme()).toBe('dark')
    expect(store['karttamaster-theme']).toBe('dark')
    expect(toggleTheme()).toBe('light')
    expect(store['karttamaster-theme']).toBe('light')
  })

  it('tuntematon localStorage-arvo → fallback "light"', async () => {
    mockLocalStorage()
    localStorage.setItem('karttamaster-theme', 'roska')
    const { getTheme } = await import('../src/logic/theme')
    expect(getTheme()).toBe('light')
  })
})
