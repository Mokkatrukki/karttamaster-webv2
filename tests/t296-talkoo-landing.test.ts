import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthScreen } from '../src/ui/auth-screen'

// T296/V208/B112: talkoo-login ilman deep-link-koodia → landing /patkat (hubi), ei /-kartta.
function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

const TALKOO_OK = { role: 'talkoolainen', display_name: 'Talkoolainen' }

describe('T296 — talkoo-login landing (V208)', () => {
  let onAuthenticated: ReturnType<typeof vi.fn>
  let navigate: ReturnType<typeof vi.fn>

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
    navigate = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  async function submitTalkooPassword(): Promise<void> {
    ;(document.querySelector('#auth-talkoo-name') as HTMLInputElement).value = 'Testi Talkoolainen'
    ;(document.querySelector('#auth-talkoo-password') as HTMLInputElement).value = 'syote2026'
    const form = document.querySelector('#auth-form-talkoolainen') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await new Promise(r => setTimeout(r, 10))
  }

  it('ilman deep-link-koodia → navigoi /patkat, EI onAuthenticated', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}))
    const screen = new AuthScreen(onAuthenticated, navigate)
    await screen.start()

    vi.stubGlobal('fetch', mockFetch(200, TALKOO_OK))
    await submitTalkooPassword()

    expect(navigate).toHaveBeenCalledWith('/patkat')
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(false)
  })

  it('deep-link /s/<slug> → EI navigointia, onAuthenticated saa koodin (T272 ennallaan)', async () => {
    window.history.pushState({}, '', '/s/patka-1')
    vi.stubGlobal('fetch', mockFetch(401, {}))
    const screen = new AuthScreen(onAuthenticated, navigate)
    await screen.start()

    vi.stubGlobal('fetch', mockFetch(200, TALKOO_OK))
    await submitTalkooPassword()

    expect(navigate).not.toHaveBeenCalled()
    expect(onAuthenticated).toHaveBeenCalledWith({
      role: 'talkoolainen',
      displayName: 'Talkoolainen',
      code: 'PATKA-1',
    })
  })

  it('re-auth kesken session → EI navigointia, jatketaan callbackilla (V119)', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}))
    const screen = new AuthScreen(onAuthenticated, navigate)
    await screen.start()

    const onSuccess = vi.fn()
    screen.promptReauth(onSuccess)

    vi.stubGlobal('fetch', mockFetch(200, TALKOO_OK))
    await submitTalkooPassword()

    expect(navigate).not.toHaveBeenCalled()
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
  })

  it('olemassa oleva sessio (/api/auth/me 200) → EI redirectiä (⊥ silmukka Kartalle-napista)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, TALKOO_OK))
    const screen = new AuthScreen(onAuthenticated, navigate)
    await screen.start()

    expect(navigate).not.toHaveBeenCalled()
    expect(onAuthenticated).toHaveBeenCalledWith({
      role: 'talkoolainen',
      displayName: 'Talkoolainen',
      code: undefined,
    })
  })
})
