import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthScreen, extractSegmentCode } from '../src/ui/auth-screen'

function mockFetch401() {
  return vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response)
}

function mockFetchOk(role = 'talkoolainen', displayName = 'Talkoolainen 1') {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ role, display_name: displayName }),
  } as Response)
}

function mockFetchCodeLogin(role = 'talkoolainen', displayName = 'Talkoolainen 1') {
  return vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // /api/auth/me
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ role, display_name: displayName }),
    } as Response) // /api/auth/code-login
}

describe('T53 — extractSegmentCode (URL-parsinta, V27)', () => {
  it('poimii koodin /s/<koodi>-polusta', () => {
    expect(extractSegmentCode('/s/matti123')).toBe('MATTI123')
  })

  it('poimii koodin jossa on viiva ja alaviiva', () => {
    expect(extractSegmentCode('/s/matti-123_abc')).toBe('MATTI-123_ABC')
  })

  it('palauttaa null juuripolusta', () => {
    expect(extractSegmentCode('/')).toBeNull()
  })

  it('palauttaa null /s/-polusta (tyhjä koodi)', () => {
    expect(extractSegmentCode('/s/')).toBeNull()
  })

  it('palauttaa null muusta polusta', () => {
    expect(extractSegmentCode('/api/auth/me')).toBeNull()
  })

  it('case-insensitive', () => {
    expect(extractSegmentCode('/s/MATTI123')).toBe('MATTI123')
  })
})

describe('T53 — AuthScreen URL-reititys', () => {
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

  it('401 + /s/<koodi> → kytkee talkoolainen-tab ja täyttää koodin', async () => {
    vi.stubGlobal('location', { pathname: '/s/matti123' })
    vi.stubGlobal('fetch', mockFetchCodeLogin())

    const screen = new AuthScreen(onAuthenticated)
    await screen.start()
    await new Promise(r => setTimeout(r, 20))

    const codeInput = document.querySelector('#auth-code') as HTMLInputElement
    expect(codeInput.value).toBe('MATTI123')
  })

  it('401 + /s/<koodi> → kutsuu code-login automaattisesti', async () => {
    vi.stubGlobal('location', { pathname: '/s/matti123' })
    const fetchMock = mockFetchCodeLogin()
    vi.stubGlobal('fetch', fetchMock)

    const screen = new AuthScreen(onAuthenticated)
    await screen.start()
    await new Promise(r => setTimeout(r, 20))

    expect(onAuthenticated).toHaveBeenCalledWith({
      role: 'talkoolainen',
      displayName: 'Talkoolainen 1',
      code: 'MATTI123',
    })
  })

  it('jo kirjautuneena + /s/<koodi> → onAuthenticated sisältää koodin', async () => {
    vi.stubGlobal('location', { pathname: '/s/pekkanen' })
    vi.stubGlobal('fetch', mockFetchOk('talkoolainen', 'Pekka'))

    const screen = new AuthScreen(onAuthenticated)
    await screen.start()
    await new Promise(r => setTimeout(r, 10))

    expect(onAuthenticated).toHaveBeenCalledWith({
      role: 'talkoolainen',
      displayName: 'Pekka',
      code: 'PEKKANEN',
    })
  })

  it('401 + juuripolku → normaali lomake näkyy', async () => {
    vi.stubGlobal('location', { pathname: '/' })
    vi.stubGlobal('fetch', mockFetch401())

    const screen = new AuthScreen(onAuthenticated)
    await screen.start()
    await new Promise(r => setTimeout(r, 10))

    expect(onAuthenticated).not.toHaveBeenCalled()
    const authScreen = document.querySelector('#auth-screen')
    expect(authScreen?.classList.contains('open')).toBe(true)
  })

  it('verkkovirhe + /s/<koodi> → lomake auki talkoolainen-välilehti, koodi pre-täytetty (V29)', async () => {
    vi.stubGlobal('location', { pathname: '/s/matti123' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const screen = new AuthScreen(onAuthenticated)
    await screen.start()
    await new Promise(r => setTimeout(r, 10))

    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(document.getElementById('auth-screen')?.classList.contains('open')).toBe(true)
  })
})
