import { describe, it, expect, vi, afterEach } from 'vitest'
import { genId } from '../src/logic/uid'

describe('T238/B103 genId — turva-id insecure contextissa', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('palauttaa ei-tyhjän stringin', () => {
    expect(typeof genId()).toBe('string')
    expect(genId().length).toBeGreaterThan(0)
  })

  it('palauttaa uniikkeja id:itä peräkkäin', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => genId()))
    expect(ids.size).toBe(1000)
  })

  it('EI kaadu vaikka crypto.randomUUID puuttuu (insecure context)', () => {
    // Simuloi insecure contextia: crypto ilman randomUUID:tä.
    vi.stubGlobal('crypto', {})
    expect(() => genId()).not.toThrow()
    const a = genId()
    const b = genId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('EI kaadu vaikka crypto on kokonaan undefined', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => genId()).not.toThrow()
    expect(genId()).not.toBe(genId())
  })

  it('käyttää natiivia crypto.randomUUID:tä kun saatavilla (secure context)', () => {
    const spy = vi.fn(() => 'native-uuid-123')
    vi.stubGlobal('crypto', { randomUUID: spy })
    expect(genId()).toBe('native-uuid-123')
    expect(spy).toHaveBeenCalled()
  })
})
