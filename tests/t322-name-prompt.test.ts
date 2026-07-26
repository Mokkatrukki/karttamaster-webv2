// T322/V228: nimipyyntö kesken session. Kenttätyö oli jo käynnissä kun nimi tuli pakolliseksi
// kirjautumisessa (T317) → vanhat sessiot ovat nimettömiä 7 vrk. Taso 2 Vitest-jsdom.
// localStorage aina vi.stubGlobal-mockilla (CLAUDE.md, Node v26 -konflikti).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildNamePrompt, needsNamePrompt, LEGACY_NAME } from '../src/ui/name-prompt'
import { TALKOO_NAME_KEY } from '../src/logic/talkoo-identity'

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

beforeEach(() => {
  document.body.innerHTML = ''
  vi.stubGlobal('localStorage', mockStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('needsNamePrompt', () => {
  it('geneerinen vanha nimi → kysytään', () => {
    expect(needsNamePrompt(LEGACY_NAME)).toBe(true)
    expect(needsNamePrompt('  Talkoolainen  ')).toBe(true)
  })
  it('tyhjä/puuttuva → kysytään', () => {
    expect(needsNamePrompt(null)).toBe(true)
    expect(needsNamePrompt(undefined)).toBe(true)
    expect(needsNamePrompt('')).toBe(true)
  })
  it('oikea nimi → ei kysytä', () => {
    expect(needsNamePrompt('Liisa')).toBe(false)
  })
})

describe('buildNamePrompt', () => {
  it('nimetty sessio ei saa palkkia', () => {
    expect(buildNamePrompt('Liisa', { onNamed: vi.fn() })).toBeNull()
  })

  it('nimetön sessio saa palkin jossa kenttä ja molemmat napit', () => {
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn() })!
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.name-prompt-input')).not.toBeNull()
    expect(bar.querySelector('.name-prompt-save')).not.toBeNull()
    expect(bar.querySelector('.name-prompt-skip')).not.toBeNull()
  })

  it('esitäyttää laitteelle muistetun nimen', () => {
    vi.stubGlobal('localStorage', mockStorage({ [TALKOO_NAME_KEY]: 'Kalle' }))
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn() })!
    expect(bar.querySelector<HTMLInputElement>('.name-prompt-input')!.value).toBe('Kalle')
  })

  it('liian lyhyt nimi ei lähde eteenpäin', async () => {
    const submitFn = vi.fn()
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn(), submitFn })!
    document.body.appendChild(bar)
    bar.querySelector<HTMLInputElement>('.name-prompt-input')!.value = 'L'
    bar.querySelector<HTMLButtonElement>('.name-prompt-save')!.click()
    await Promise.resolve()
    expect(submitFn).not.toHaveBeenCalled()
    expect(bar.querySelector('.name-prompt-error')!.textContent).toContain('2 merkkiä')
  })

  it('tallennus lähettää nimen, muistaa sen ja poistaa palkin', async () => {
    const ls = mockStorage()
    vi.stubGlobal('localStorage', ls)
    const submitFn = vi.fn().mockResolvedValue(true)
    const onNamed = vi.fn()
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed, submitFn })!
    document.body.appendChild(bar)

    bar.querySelector<HTMLInputElement>('.name-prompt-input')!.value = '  Liisa  '
    bar.querySelector<HTMLButtonElement>('.name-prompt-save')!.click()

    await vi.waitFor(() => expect(onNamed).toHaveBeenCalledWith('Liisa'))
    expect(submitFn).toHaveBeenCalledWith('Liisa')
    expect(ls._store.get(TALKOO_NAME_KEY)).toBe('Liisa')
    expect(document.querySelector('.name-prompt')).toBeNull()
  })

  it('epäonnistunut tallennus ei sulje palkkia — kenttätyö ei jää nimettömäksi hiljaa', async () => {
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn(), submitFn: vi.fn().mockResolvedValue(false) })!
    document.body.appendChild(bar)
    bar.querySelector<HTMLInputElement>('.name-prompt-input')!.value = 'Liisa'
    bar.querySelector<HTMLButtonElement>('.name-prompt-save')!.click()

    await vi.waitFor(() => expect(bar.querySelector('.name-prompt-error')!.textContent).toContain('yritä uudelleen'))
    expect(document.body.contains(bar)).toBe(true)
    expect(bar.querySelector<HTMLButtonElement>('.name-prompt-save')!.disabled).toBe(false)
  })

  it('"Ei nyt" sulkee palkin eikä se palaa seuraavalla latauksella (ei jankuta metsässä)', () => {
    const bar = buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn() })!
    document.body.appendChild(bar)
    bar.querySelector<HTMLButtonElement>('.name-prompt-skip')!.click()
    expect(document.querySelector('.name-prompt')).toBeNull()
    expect(buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn() })).toBeNull()
  })

  it('estetty localStorage ei kaada palkkia', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => buildNamePrompt(LEGACY_NAME, { onNamed: vi.fn() })).not.toThrow()
  })
})
