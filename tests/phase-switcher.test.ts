import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PhaseSwitcher } from '../src/ui/phase-switcher'
import { getActivePhase } from '../src/logic/phase-view'

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

  it('valinnan vaihto kutsuu onChange ja persistoi localStorageen', () => {
    let received: string | null = null
    new PhaseSwitcher(container, (phase) => { received = phase })
    const select = container.querySelector('select') as HTMLSelectElement
    select.value = 'tarkastus'
    select.dispatchEvent(new Event('change'))
    expect(received).toBe('tarkastus')
    expect(getActivePhase()).toBe('tarkastus')
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
