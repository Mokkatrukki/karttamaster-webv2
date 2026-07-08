import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRole, setRole, toggleRole } from '../src/logic/role'

describe('role logic', () => {
  beforeEach(() => {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem:    (k: string) => store[k] ?? null,
      setItem:    (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear:      () => { store = {} },
    })
  })

  it('default role is järjestäjä', () => {
    expect(getRole()).toBe('järjestäjä')
  })

  it('setRole persists to localStorage', () => {
    setRole('talkoolainen')
    expect(getRole()).toBe('talkoolainen')
  })

  it('setRole järjestäjä persists', () => {
    setRole('talkoolainen')
    setRole('järjestäjä')
    expect(getRole()).toBe('järjestäjä')
  })

  it('unknown localStorage value → järjestäjä', () => {
    localStorage.setItem('karttamaster-role', 'hakkerikoodari')
    expect(getRole()).toBe('järjestäjä')
  })

  it('toggleRole järjestäjä → talkoolainen', () => {
    expect(toggleRole()).toBe('talkoolainen')
    expect(getRole()).toBe('talkoolainen')
  })

  it('toggleRole talkoolainen → järjestäjä', () => {
    setRole('talkoolainen')
    expect(toggleRole()).toBe('järjestäjä')
    expect(getRole()).toBe('järjestäjä')
  })
})
