// T317/V228: nimi hub-kirjautumisessa. Taso 1 (talkoo-identity) + Taso 2 (AuthScreen-lomake).
// localStorage aina vi.stubGlobal-mockilla — natiivi konfliktoi Node v26:ssa (CLAUDE.md).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isValidTalkooName,
  readRememberedName,
  rememberName,
  TALKOO_NAME_KEY,
  NAME_MIN,
  NAME_MAX,
} from '../src/logic/talkoo-identity'
import { AuthScreen } from '../src/ui/auth-screen'

function mockStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
    _store: store,
  }
}

describe('isValidTalkooName', () => {
  it('hyväksyy tavallisen nimen', () => {
    expect(isValidTalkooName('Liisa')).toBe(true)
    expect(isValidTalkooName('Matti Meikäläinen')).toBe(true)
  })
  it('hylkää liian lyhyen ja tyhjän', () => {
    expect(isValidTalkooName('')).toBe(false)
    expect(isValidTalkooName('   ')).toBe(false)
    expect(isValidTalkooName('L')).toBe(false)
  })
  it('hylkää liian pitkän', () => {
    expect(isValidTalkooName('x'.repeat(NAME_MAX + 1))).toBe(false)
  })
  it('rajat mukaan lukien', () => {
    expect(isValidTalkooName('x'.repeat(NAME_MIN))).toBe(true)
    expect(isValidTalkooName('x'.repeat(NAME_MAX))).toBe(true)
  })
  it('välilyönnit trimmataan ennen mittausta', () => {
    expect(isValidTalkooName('  Li  ')).toBe(true)
    expect(isValidTalkooName('  L  ')).toBe(false)
  })
})

describe('nimen muistaminen laitteessa', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lukee tallennetun nimen', () => {
    vi.stubGlobal('localStorage', mockStorage({ [TALKOO_NAME_KEY]: 'Liisa' }))
    expect(readRememberedName()).toBe('Liisa')
  })

  it('puuttuva avain → tyhjä, ei heitä', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(readRememberedName()).toBe('')
  })

  it('tallentaa trimmatun nimen', () => {
    const ls = mockStorage()
    vi.stubGlobal('localStorage', ls)
    rememberName('  Kalle  ')
    expect(ls._store.get(TALKOO_NAME_KEY)).toBe('Kalle')
  })

  it('ei tallenna kelvotonta nimeä', () => {
    const ls = mockStorage()
    vi.stubGlobal('localStorage', ls)
    rememberName('L')
    expect(ls._store.has(TALKOO_NAME_KEY)).toBe(false)
  })

  it('estetty localStorage ei kaada kirjautumista', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(readRememberedName()).toBe('')
    expect(() => rememberName('Liisa')).not.toThrow()
  })
})

describe('AuthScreen — talkoo-lomakkeen nimikenttä', () => {
  let onAuth: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.stubGlobal('localStorage', mockStorage())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    onAuth = vi.fn()
    const screen = new AuthScreen(onAuth)
    await screen.start()
    ;(document.querySelector('[data-tab="talkoolainen"]') as HTMLElement).click()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('nimikenttä on salasanan vierellä samassa lomakkeessa (yksi lähetys)', () => {
    const form = document.querySelector('#auth-form-talkoolainen')!
    expect(form.querySelector('#auth-talkoo-name')).not.toBeNull()
    expect(form.querySelector('#auth-talkoo-password')).not.toBeNull()
  })

  it('tyhjä nimi estää lähetyksen ja kertoo syyn', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    ;(document.querySelector('#auth-talkoo-password') as HTMLInputElement).value = 'syote2026'
    ;(document.querySelector('#auth-form-talkoolainen') as HTMLFormElement).dispatchEvent(new Event('submit'))
    await Promise.resolve()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('.auth-error')?.textContent).toContain('nimesi')
  })

  it('nimi lähtee pyynnön mukana ja jää muistiin', async () => {
    const ls = mockStorage()
    vi.stubGlobal('localStorage', ls)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'talkoolainen', display_name: 'Liisa' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    ;(document.querySelector('#auth-talkoo-name') as HTMLInputElement).value = '  Liisa  '
    ;(document.querySelector('#auth-talkoo-password') as HTMLInputElement).value = 'syote2026'
    ;(document.querySelector('#auth-form-talkoolainen') as HTMLFormElement).dispatchEvent(new Event('submit'))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as { name: string }
    expect(body.name).toBe('Liisa')
    await vi.waitFor(() => expect(ls._store.get(TALKOO_NAME_KEY)).toBe('Liisa'))
  })

  it('muistettu nimi esitäyttyy välilehteä vaihdettaessa', async () => {
    document.body.innerHTML = ''
    vi.stubGlobal('localStorage', mockStorage({ [TALKOO_NAME_KEY]: 'Kalle' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    const screen = new AuthScreen(vi.fn())
    await screen.start()
    ;(document.querySelector('[data-tab="talkoolainen"]') as HTMLElement).click()
    expect((document.querySelector('#auth-talkoo-name') as HTMLInputElement).value).toBe('Kalle')
  })
})
