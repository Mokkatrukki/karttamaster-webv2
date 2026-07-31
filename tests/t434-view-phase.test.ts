// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest'

// T434/V321: katseluvaihe on järjestäjän silmä, ⊥ komento. `phase-view.ts` pitää sekä
// globaalin että katseluvaiheen MODUULITASON muuttujissa ∴ jokainen testi lataa moduulin
// uudelleen (`resetModules`) — tiedosto kuuluu `vite.config.ts`in ISOLATED-listalle.

const store = new Map<string, string>()

function stubStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
  })
}

async function freshModule() {
  vi.resetModules()
  return await import('../src/logic/phase-view')
}

/** Asettaa globaalin vaiheen serveripolun kautta — ainoa tie, koska `active` on moduulin sisäinen. */
async function moduleWithActivePhase(phase: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phase }) })))
  const mod = await freshModule()
  await mod.loadActivePhase()
  return mod
}

describe('T434/V321 — katseluvaihe ⊥ komento', () => {
  beforeEach(() => { store.clear(); stubStorage() })

  test('oletus seuraa käynnissä olevaa vaihetta — tyhjä localStorage ⊥ ole eri mieltä', async () => {
    const mod = await moduleWithActivePhase('purku')
    expect(mod.getViewPhase()).toBe('purku')
    expect(mod.isViewingOtherPhase()).toBe(false)
  })

  test('katseluvaihto EI koske serveriin', async () => {
    const mod = await moduleWithActivePhase('asettaminen')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    mod.setViewPhase('purku')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mod.getViewPhase()).toBe('purku')
    expect(mod.getActivePhase()).toBe('asettaminen') // globaali ennallaan
    expect(mod.isViewingOtherPhase()).toBe(true)
  })

  test('paluu käynnissä olevaan vaiheeseen nollaa overriden — ⊥ jätä kuollutta arvoa', async () => {
    const mod = await moduleWithActivePhase('asettaminen')
    mod.setViewPhase('purku')
    mod.resetViewPhase()

    expect(mod.isViewingOtherPhase()).toBe(false)
    expect(mod.getViewPhase()).toBe('asettaminen')
    expect(store.has('karttamaster-view-phase')).toBe(false)
  })

  test('nimenomainen katseluvalinta säilyy sivun latauksen yli', async () => {
    const first = await moduleWithActivePhase('asettaminen')
    first.setViewPhase('purku')

    const second = await moduleWithActivePhase('asettaminen')
    expect(second.getViewPhase()).toBe('purku')
    expect(second.isViewingOtherPhase()).toBe(true)
  })

  test('kun globaali vaihe kiertää samaksi kuin katselu, pilleri sammuu', async () => {
    const first = await moduleWithActivePhase('asettaminen')
    first.setViewPhase('purku')

    // Admin käynnisti purun → katselu ja käynnissä oleva ovat samat.
    const second = await moduleWithActivePhase('purku')
    expect(second.getViewPhase()).toBe('purku')
    expect(second.isViewingOtherPhase()).toBe(false)
  })

  test('roskainen localStorage-arvo ⊥ kaada — katselu putoaa globaaliin', async () => {
    store.set('karttamaster-view-phase', 'muinainen')
    const mod = await moduleWithActivePhase('tarkastus')
    expect(mod.getViewPhase()).toBe('tarkastus')
    expect(mod.isViewingOtherPhase()).toBe(false)
  })
})

describe('T434/V321 — PhaseSwitcher näyttää eron', () => {
  beforeEach(() => { store.clear(); stubStorage() })

  async function mountSwitcher(activePhase: string) {
    const phaseView = await moduleWithActivePhase(activePhase)
    const { PhaseSwitcher } = await import('../src/ui/phase-switcher')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const onChange = vi.fn()
    new PhaseSwitcher(el, onChange)
    return { el, onChange, phaseView }
  }

  test('pilleri piilossa kun katselu = käynnissä oleva', async () => {
    const { el } = await mountSwitcher('asettaminen')
    expect(el.querySelector<HTMLElement>('.phase-switcher-pill')!.hidden).toBe(true)
  })

  test('pilleri ilmestyy & kertoo MOLEMMAT vaiheet kun katselu eroaa', async () => {
    const { el, onChange } = await mountSwitcher('asettaminen')
    const select = el.querySelector<HTMLSelectElement>('.phase-switcher-select')!
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))

    const pill = el.querySelector<HTMLElement>('.phase-switcher-pill')!
    expect(pill.hidden).toBe(false)
    expect(pill.textContent).toContain('Katselet: Purku')
    expect(pill.textContent).toContain('käynnissä: Asetus')
    expect(onChange).toHaveBeenCalledWith('purku')
  })

  test('valinta EI lähetä PUT:ia — katselu ⊥ komento', async () => {
    const { el } = await mountSwitcher('asettaminen')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const select = el.querySelector<HTMLSelectElement>('.phase-switcher-select')!
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('pillerin klikkaus palauttaa katselun & piilottaa pillerin', async () => {
    const { el, onChange } = await mountSwitcher('asettaminen')
    const select = el.querySelector<HTMLSelectElement>('.phase-switcher-select')!
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))

    el.querySelector<HTMLButtonElement>('.phase-switcher-pill')!.click()

    expect(el.querySelector<HTMLElement>('.phase-switcher-pill')!.hidden).toBe(true)
    expect(select.value).toBe('asettaminen')
    expect(onChange).toHaveBeenLastCalledWith('asettaminen')
  })
})
