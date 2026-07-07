import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthScreen, extractInviteToken } from '../src/ui/auth-screen'

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
    window.history.pushState({}, '', '/')
  })

  describe('start() — /api/auth/me', () => {
    it('200 → onAuthenticated called, overlay hidden after auth resolves', async () => {
      vi.stubGlobal('fetch', mockFetchMe(200, { role: 'järjestäjä', display_name: 'Admin' }))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'järjestäjä', displayName: 'Admin' })
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(false)
    })

    it('T68/V40: overlay näkyy ennen kuin fetch resolvoituu', async () => {
      let resolveFetch!: (v: Response) => void
      const pendingFetch = new Promise<Response>(r => { resolveFetch = r })
      vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pendingFetch))
      const screen = new AuthScreen(onAuthenticated)
      const startPromise = screen.start()
      // overlay must be open before fetch resolves
      expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
      resolveFetch({ ok: false, status: 401, json: async () => ({}) } as Response)
      await startPromise
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

  describe('T177/V110 — extractInviteToken', () => {
    it('matches /auth/invite/<token>', () => {
      expect(extractInviteToken('/auth/invite/abc123-def')).toBe('abc123-def')
    })

    it('no match on other paths', () => {
      expect(extractInviteToken('/s/ABC123')).toBeNull()
      expect(extractInviteToken('/')).toBeNull()
    })
  })

  describe('T177/V110 — invite/reset flow', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/auth/invite/tok-123')
    })

    it('valid token → shows invite form, hides tabs, no /api/auth/me call needed for form to appear', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ valid: true }) } as Response))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(document.querySelector('#auth-form-invite.active')).not.toBeNull()
      expect((document.getElementById('auth-tabs') as HTMLElement).style.display).toBe('none')
    })

    it('invalid/expired token → error shown, no silent fallback to login form', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'invalid_token' }) } as Response))
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      expect(document.getElementById('auth-error')?.textContent).toContain('vanhentunut')
      expect(document.querySelector('#auth-form-invite.active')).toBeNull()
      expect(document.querySelector('#auth-form-jarjestaja.active')).toBeNull()
    })

    it('password mismatch → client error, no register fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ valid: true }) } as Response)
      vi.stubGlobal('fetch', fetchMock)
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      ;(document.getElementById('invite-username') as HTMLInputElement).value = 'uusi'
      ;(document.getElementById('invite-password') as HTMLInputElement).value = 'salasana1'
      ;(document.getElementById('invite-password-confirm') as HTMLInputElement).value = 'salasana2'
      const form = document.querySelector('#auth-form-invite') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(document.getElementById('auth-error')?.textContent).toContain('täsmää')
      expect(fetchMock).toHaveBeenCalledTimes(1) // only the initial invite-validate call
    })

    it('successful register → auto-login → onAuthenticated', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ valid: true }) } as Response) // invite validate
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response) // register
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ role: 'järjestäjä', display_name: 'Uusi' }) } as Response) // login
      vi.stubGlobal('fetch', fetchMock)
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      ;(document.getElementById('invite-username') as HTMLInputElement).value = 'uusi'
      ;(document.getElementById('invite-password') as HTMLInputElement).value = 'salasana1'
      ;(document.getElementById('invite-password-confirm') as HTMLInputElement).value = 'salasana1'
      const form = document.querySelector('#auth-form-invite') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(onAuthenticated).toHaveBeenCalledWith({ role: 'järjestäjä', displayName: 'Uusi' })
    })

    it('username taken → error message', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ valid: true }) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'username_taken' }) } as Response)
      vi.stubGlobal('fetch', fetchMock)
      const screen = new AuthScreen(onAuthenticated)
      await screen.start()
      ;(document.getElementById('invite-username') as HTMLInputElement).value = 'admin'
      ;(document.getElementById('invite-password') as HTMLInputElement).value = 'salasana1'
      ;(document.getElementById('invite-password-confirm') as HTMLInputElement).value = 'salasana1'
      const form = document.querySelector('#auth-form-invite') as HTMLFormElement
      form.dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise(r => setTimeout(r, 10))
      expect(document.getElementById('auth-error')?.textContent).toContain('käytössä')
    })
  })
})
