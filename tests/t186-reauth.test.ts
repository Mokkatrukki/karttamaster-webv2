import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthScreen } from '../src/ui/auth-screen'

// T186/V119: kesken session vanhentunut sessio (401) → promptReauth näyttää overlayn,
// ja onnistunut uudelleenkirjautuminen jatkaa (onSuccess) käynnistämättä sovellusta uudelleen.
describe('T186 — mid-session re-auth (V119)', () => {
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

  async function submitJärjestäjäLogin(screen: AuthScreen) {
    const overlay = document.getElementById('auth-screen')!
    ;(overlay.querySelector('#auth-username') as HTMLInputElement).value = 'admin'
    ;(overlay.querySelector('#auth-password') as HTMLInputElement).value = 'pw'
    const form = overlay.querySelector('#auth-form-jarjestaja') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    // flush login fetch microtasks
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    void screen
  }

  it('promptReauth → overlay auki + virheteksti', () => {
    const screen = new AuthScreen(onAuthenticated)
    screen.promptReauth(vi.fn())
    const overlay = document.getElementById('auth-screen')!
    expect(overlay.classList.contains('open')).toBe(true)
    expect(overlay.querySelector('#auth-error')?.textContent).toContain('Istunto vanhentui')
  })

  it('onnistunut re-auth → onSuccess kutsutaan, onAuthenticated EI, overlay piiloon', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ role: 'järjestäjä', display_name: 'Admin' }),
    }))
    const screen = new AuthScreen(onAuthenticated)
    const onSuccess = vi.fn()
    screen.promptReauth(onSuccess)
    await submitJärjestäjäLogin(screen)

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(false)
  })

  it('päällekkäinen promptReauth on no-op — vain ensimmäinen onSuccess ajetaan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ role: 'järjestäjä', display_name: 'Admin' }),
    }))
    const screen = new AuthScreen(onAuthenticated)
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    screen.promptReauth(cb1)
    screen.promptReauth(cb2) // ohitetaan (reauthActive)
    await submitJärjestäjäLogin(screen)

    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).not.toHaveBeenCalled()
  })

  it('epäonnistunut re-auth → onSuccess ei kutsuta, overlay pysyy auki', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    const screen = new AuthScreen(onAuthenticated)
    const onSuccess = vi.fn()
    screen.promptReauth(onSuccess)
    await submitJärjestäjäLogin(screen)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
  })
})
