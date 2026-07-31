// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PhaseSwitcher } from '../src/ui/phase-switcher'
import { getActivePhase, getViewPhase, isViewingOtherPhase, resetViewPhase } from '../src/logic/phase-view'

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

describe('PhaseSwitcher (T148)', () => {
  let container: HTMLElement

  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock())
    // T434: katseluvaihe on moduulitason tila jaetussa rekisterissä ∴ edellisen testin
    // valinta vuotaisi seuraavaan. Nollaus tässä, ei jokaisen testin lopussa.
    resetViewPhase()
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('renderöi kolme vaihtoehtoa', () => {
    new PhaseSwitcher(container, () => {})
    const options = container.querySelectorAll('option')
    expect(options.length).toBe(3)
    expect(Array.from(options).map(o => o.value)).toEqual(['asettaminen', 'tarkastus', 'purku'])
  })

  it('alkuarvo tulee getActivePhase()-funktiosta (default asettaminen)', () => {
    new PhaseSwitcher(container, () => {})
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('asettaminen')
  })

  // T434/V321: tämä testi KÄÄNTYI — se väitti valinnan siirtävän KÄYNNISSÄ olevaa vaihetta.
  // Se oli koko vian ydin: järjestäjän katselu siirsi koko talkooporukan toiseen vaiheeseen.
  // Nyt valinta muuttaa katselua & käynnissä oleva vaihe pysyy adminin komennossa (T432/T433).
  it('valinnan vaihto kutsuu onChange & muuttaa KATSELUA — käynnissä oleva vaihe ei liiku', () => {
    let received: string | null = null
    new PhaseSwitcher(container, (phase) => { received = phase })
    const select = container.querySelector('select') as HTMLSelectElement
    select.value = 'tarkastus'
    select.dispatchEvent(new Event('change'))
    expect(received).toBe('tarkastus')
    expect(getViewPhase()).toBe('tarkastus')
    expect(getActivePhase()).toBe('asettaminen')
    expect(isViewingOtherPhase()).toBe(true)
  })

  it('vapaa siirtymä mihin arvoon tahansa — purku suoraan ilman ketjua', () => {
    let received: string | null = null
    new PhaseSwitcher(container, (phase) => { received = phase })
    const select = container.querySelector('select') as HTMLSelectElement
    select.value = 'purku'
    select.dispatchEvent(new Event('change'))
    expect(received).toBe('purku')
  })

  it('T180/B80: select-klikki ei bubblaa dokumenttiin (ei katkaise overflow-menun ulkoklikki-sulkijaa)', () => {
    new PhaseSwitcher(container, () => {})
    const select = container.querySelector('select') as HTMLSelectElement
    let documentClickFired = false
    document.addEventListener('click', () => { documentClickFired = true })
    select.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(documentClickFired).toBe(false)
  })

  it('T180/B80: select-mousedown ei bubblaa dokumenttiin', () => {
    new PhaseSwitcher(container, () => {})
    const select = container.querySelector('select') as HTMLSelectElement
    let documentMousedownFired = false
    document.addEventListener('mousedown', () => { documentMousedownFired = true })
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(documentMousedownFired).toBe(false)
  })
})
