import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getActivePhase, setActivePhase } from '../src/logic/phase-view'

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

describe('phase-view (T148)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock())
  })

  it('default on asettaminen kun ei tallennettua arvoa', () => {
    expect(getActivePhase()).toBe('asettaminen')
  })

  it('setActivePhase persistoi ja getActivePhase palauttaa sen', () => {
    setActivePhase('tarkastus')
    expect(getActivePhase()).toBe('tarkastus')
  })

  it('vapaa siirtymä mihin arvoon tahansa, ei ketjua', () => {
    setActivePhase('purku')
    expect(getActivePhase()).toBe('purku')
    setActivePhase('asettaminen')
    expect(getActivePhase()).toBe('asettaminen')
    setActivePhase('tarkastus')
    expect(getActivePhase()).toBe('tarkastus')
  })

  it('virheellinen tallennettu arvo palautuu defaulttiin', () => {
    localStorage.setItem('karttamaster-active-phase', 'roskaa')
    expect(getActivePhase()).toBe('asettaminen')
  })
})
