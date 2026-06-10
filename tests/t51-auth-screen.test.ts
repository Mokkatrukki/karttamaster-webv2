import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthScreen } from '../src/ui/auth-screen'

function mockFetchMe(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

describe('T51 — AuthScreen', () => {
  let onAuthenticated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
    document.body.innerHTML = ''
    onAuthenticated = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('start() — /api/auth/me', () => {
    it('200 → onAuthenticated called immediately, overlay not shown', async () => {
      vi.stubGlobal('fetch', mockFetchMe(200, { role: 'järjestäjä', display_name: 'Admin' }))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'järjestäjä', displayName: 'Admin' })
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(false)
    })

    it('401 → overlay shown, onAuthenticated not called yet', async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, { error: 'unauthorized' }))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).not.toHaveBeenCalled()
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
    })

    it('network error → login form shown, onAuthenticated not called (V29)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).not.toHaveBeenCalled()
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
    })

    it('404 (no backend) → login form shown, onAuthenticated not called (V29)', async () => {
      vi.stubGlobal('fetch', mockFetchMe(404, {}))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).not.toHaveBeenCalled()
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
    })

    it('200 with talkoolainen role → onAuthenticated with talkoolainen', async () => {
      vi.stubGlobal('fetch', mockFetchMe(200, { role: 'talkoolainen', display_name: 'Talkoolainen 1' }))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'talkoolainen', displayName: 'Talkoolainen 1' })
    })
  })

  describe('login form rendering', () => {
    beforeEach(async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, {}))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
    })

    it('järjestäjä tab active by default', () => {
      const activeTab = document.querySelector('.auth-tab.active') as HTMLElement
      expect(activeTab?.dataset.tab).toBe('järjestäjä')
    })

    it('two tabs exist', () => {
      expect(document.querySelectorAll('.auth-tab').length).toBe(2)
    })

    it('järjestäjä form visible, talkoolainen form hidden by default', () => {
      expect(document.querySelector('#auth-form-jarjestaja.active')).not.toBeNull()
      expect(document.querySelector('#auth-form-talkoolainen.active')).toBeNull()
    })

    it('toggle to talkoolainen shows code field', () => {
      const tab = document.querySelector('[data-tab="talkoolainen"]') as HTMLElement
      tab.click()
      expect(document.querySelector('#auth-form-talkoolainen.active')).not.toBeNull()
      expect(document.querySelector('#auth-form-jarjestaja.active')).toBeNull()
      expect(document.getElementById('auth-code')).not.toBeNull()
    })

    it('toggle back to järjestäjä restores form', () => {
      const talkoolainenTab = document.querySelector('[data-tab="talkoolainen"]') as HTMLElement
      talkoolainenTab.click()
      const järjestäjäTab = document.querySelector('[data-tab="järjestäjä"]') as HTMLElement
      järjestäjäTab.click()
      expect(document.querySelector('#auth-form-jarjestaja.active')).not.toBeNull()
      expect(document.querySelector('#auth-form-talkoolainen.active')).toBeNull()
    })

    it('error cleared when switching tabs', async () => {
      // Trigger error first
      vi.stubGlobal('fetch', mockFetchMe(401, {}))
      const form = document.querySelector('#auth-form-jarjestaja') as HTMLFormElement
      ;(document.querySelector('#auth-username') as HTMLInputElement).value = 'x'
      ;(document.querySelector('#auth-password') as HTMLInputElement).value = 'y'
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(document.getElementById('auth-error')?.textContent).toBeTruthy()

      // Switch tab → error clears
      const tab = document.querySelector('[data-tab="talkoolainen"]') as HTMLElement
      tab.click()
      expect(document.getElementById('auth-error')?.textContent).toBe('')
    })
  })

  describe('järjestäjä login', () => {
    beforeEach(async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, {}))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
    })

    it('successful login → onAuthenticated + overlay hidden', async () => {
      vi.stubGlobal('fetch', mockFetchMe(200, { role: 'järjestäjä', display_name: 'Admin' }))
      ;(document.querySelector('#auth-username') as HTMLInputElement).value = 'admin'
      ;(document.querySelector('#auth-password') as HTMLInputElement).value = 'password'
      const form = document.querySelector('#auth-form-jarjestaja') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'järjestäjä', displayName: 'Admin' })
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(false)
    })

    it('wrong credentials → error message shown', async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, { error: 'invalid_credentials' }))
      ;(document.querySelector('#auth-username') as HTMLInputElement).value = 'wrong'
      ;(document.querySelector('#auth-password') as HTMLInputElement).value = 'wrong'
      const form = document.querySelector('#auth-form-jarjestaja') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(onAuthenticated).not.toHaveBeenCalled()
      const error = document.getElementById('auth-error')?.textContent
      expect(error).toBeTruthy()
      expect(error).toContain('Väärä')
    })

    it('empty fields → no fetch called', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      ;(document.querySelector('#auth-username') as HTMLInputElement).value = ''
      ;(document.querySelector('#auth-password') as HTMLInputElement).value = ''
      const form = document.querySelector('#auth-form-jarjestaja') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('network error during login → error message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')))
      ;(document.querySelector('#auth-username') as HTMLInputElement).value = 'admin'
      ;(document.querySelector('#auth-password') as HTMLInputElement).value = 'pw'
      const form = document.querySelector('#auth-form-jarjestaja') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(document.getElementById('auth-error')?.textContent).toContain('Yhteysvirhe')
    })
  })

  describe('talkoolainen login', () => {
    beforeEach(async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, {}))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      const tab = document.querySelector('[data-tab="talkoolainen"]') as HTMLElement
      tab.click()
    })

    it('valid code → onAuthenticated with talkoolainen', async () => {
      vi.stubGlobal('fetch', mockFetchMe(200, { role: 'talkoolainen', display_name: 'Talkoolainen 1' }))
      ;(document.querySelector('#auth-code') as HTMLInputElement).value = 'ABC123'
      const form = document.querySelector('#auth-form-talkoolainen') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'talkoolainen', displayName: 'Talkoolainen 1', code: 'ABC123' })
    })

    it('invalid code → error message', async () => {
      vi.stubGlobal('fetch', mockFetchMe(401, { error: 'invalid_code' }))
      ;(document.querySelector('#auth-code') as HTMLInputElement).value = 'WRONG'
      const form = document.querySelector('#auth-form-talkoolainen') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(onAuthenticated).not.toHaveBeenCalled()
      const error = document.getElementById('auth-error')?.textContent
      expect(error).toContain('Väärä koodi')
    })

    it('empty code → no fetch', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      ;(document.querySelector('#auth-code') as HTMLInputElement).value = ''
      const form = document.querySelector('#auth-form-talkoolainen') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
