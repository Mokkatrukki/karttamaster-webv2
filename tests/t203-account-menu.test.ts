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

describe('T274/V189 — järjestäjä-crossover linkki', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('järjestäjä näkee "Pätkät-sivu"-linkin → /patkat', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Järkkäri', role: 'järjestäjä', onLoggedOut: vi.fn() })
    const link = c.querySelector('.account-menu-patkat') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/patkat')
  })

  it('admin näkee linkin (⊃ järjestäjä)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Admin', role: 'admin', onLoggedOut: vi.fn() })
    expect(c.querySelector('.account-menu-patkat')).not.toBeNull()
  })

  it('talkoolainen EI näe crossover-linkkiä', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'Talkoolainen', role: 'talkoolainen', onLoggedOut: vi.fn() })
    expect(c.querySelector('.account-menu-patkat')).toBeNull()
  })

  it('ilman roolia ei linkkiä (taaksepäin-yhteensopiva)', async () => {
    mockLocalStorage()
    const { AccountMenu } = await import('../src/ui/account-menu')
    const c = document.createElement('div')
    new AccountMenu(c, { displayName: 'X', onLoggedOut: vi.fn() })
    expect(c.querySelector('.account-menu-patkat')).toBeNull()
  })
})
