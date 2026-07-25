import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// T203/V133: tilivalikko — display_name + teemavalitsin (V132) + Kirjaudu ulos.
// localStorage-mock: vi.stubGlobal (natiivi konfliktoi Node v26:ssa).

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

describe('T203 — AccountMenu', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renderöi käyttäjän display_name', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: 'Matti Meikäläinen', onLoggedOut: () => {} })
    expect(container.querySelector('.account-menu-name')?.textContent).toBe('Matti Meikäläinen')
  })

  it('tyhjä display_name → fallback "Käyttäjä"', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: '', onLoggedOut: () => {} })
    expect(container.querySelector('.account-menu-name')?.textContent).toBe('Käyttäjä')
  })

  it('teemavalitsin: klikki "Kaamos-tumma" asettaa data-theme=dark ja persistoi', async () => {
    const store = mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: 'X', onLoggedOut: () => {} })
    const darkOpt = container.querySelector<HTMLButtonElement>('.account-menu-theme-opt[data-theme="dark"]')!
    darkOpt.click()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(store['karttamaster-theme']).toBe('dark')
    expect(darkOpt.classList.contains('active')).toBe(true)
  })

  it('teemavalitsin heijastaa nykyisen teeman (light aktiivinen oletuksena)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: 'X', onLoggedOut: () => {} })
    const lightOpt = container.querySelector<HTMLButtonElement>('.account-menu-theme-opt[data-theme="light"]')!
    expect(lightOpt.classList.contains('active')).toBe(true)
    expect(lightOpt.getAttribute('aria-pressed')).toBe('true')
  })

  it('Kirjaudu ulos -klikki kutsuu POST /api/auth/logout ja onLoggedOut', async () => {
    mockLocalStorage()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const onLoggedOut = vi.fn()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: 'X', onLoggedOut })
    container.querySelector<HTMLButtonElement>('#btn-logout')!.click()
    await vi.waitFor(() => expect(onLoggedOut).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })

  it('logout kutsuu onLoggedOut myös verkkovirheessä (ei jää haamutilaan)', async () => {
    mockLocalStorage()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const onLoggedOut = vi.fn()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const container = document.createElement('div')
    new AccountMenu(container, { displayName: 'X', onLoggedOut })
    container.querySelector<HTMLButtonElement>('#btn-logout')!.click()
    await vi.waitFor(() => expect(onLoggedOut).toHaveBeenCalled())
  })
})

describe('T274/V189 + T310/V222 — hub-linkki (/patkat)', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('järjestäjä näkee "Pätkät-sivu"-linkin → /patkat (teksti ennallaan T310:n jälkeen)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Järkkäri', role: 'järjestäjä', onLoggedOut: vi.fn() })
    const link = c.querySelector('.account-menu-patkat') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/patkat')
    expect(link.textContent).toBe('🔧 Pätkät-sivu (tee pätkä)')
  })

  it('admin näkee linkin (⊃ järjestäjä)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Admin', role: 'admin', onLoggedOut: vi.fn() })
    expect(c.querySelector('.account-menu-patkat')).not.toBeNull()
  })

  // T310/B122/V222: aiemmin talkoolaiselta gatettiin linkki pois → umpikuja. Nyt näkyy,
  // omalla tekstillä (hubi = Model B:n koti, V188).
  it('V222: talkoolainen näkee "🧭 Kaikki pätkät" -linkin → /patkat', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Talkoolainen', role: 'talkoolainen', onLoggedOut: vi.fn() })
    const link = c.querySelector('.account-menu-patkat') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/patkat')
    expect(link.textContent).toBe('🧭 Kaikki pätkät')
  })

  it('V222: talkoolaisen hub-linkki ⊥ ole sama kuin 🏠 moodinvaihto (eri label, ei kahta kotia)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Talkoolainen', role: 'talkoolainen', onLoggedOut: vi.fn() })
    const link = c.querySelector('.account-menu-patkat') as HTMLAnchorElement
    // 🏠 (#btn-home-view) = moodinvaihto saman pätkän sisällä → hub-linkki ei saa lukea "koti"
    expect(link.textContent?.toLowerCase()).not.toContain('koti')
    expect(link.textContent).not.toContain('🏠')
    // Linkki on <a href> (sivunvaihto), ei <button> (moodikytkin)
    expect(link.tagName).toBe('A')
  })

  it('V222: linkki on ⋯-valikon DOM:issa view-moodista riippumatta (koti JA kartta)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    for (const mode of ['koti', 'kartta']) {
      document.body.innerHTML = `<div id="app" data-view-mode="${mode}">
        <div id="toolbar-actions"><button id="btn-menu">⋯</button></div>
        <div id="toolbar-menu"><div id="account-menu-section"></div></div>
      </div>`
      const section = document.getElementById('account-menu-section')!
      new AccountMenu(section, {
        displayName: 'Talkoolainen',
        role: 'talkoolainen',
        onLoggedOut: vi.fn(),
      })
      const link = document.querySelector('#toolbar-menu .account-menu-patkat')
      expect(link, `moodi=${mode}`).not.toBeNull()
      // ⋯-nappi on olemassa molemmissa moodeissa (näkyvyys = CSS; ei piiloteta moodilla)
      expect(document.getElementById('btn-menu')).not.toBeNull()
    }
  })

  it('ilman roolia ei linkkiä (taaksepäin-yhteensopiva)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'X', onLoggedOut: vi.fn() })
    expect(c.querySelector('.account-menu-patkat')).toBeNull()
  })
})
