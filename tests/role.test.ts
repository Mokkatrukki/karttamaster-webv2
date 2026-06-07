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

describe('RoleSelector toggle button', () => {
  beforeEach(() => {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem:    (k: string) => store[k] ?? null,
      setItem:    (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear:      () => { store = {} },
    })
  })

  it('button text shows current role', async () => {
    const { RoleSelector } = await import('../src/ui/role-selector')
    const btn = document.createElement('button')
    new RoleSelector(btn)
    expect(btn.textContent).toBe('Järjestäjä')
  })

  it('click toggles to talkoolainen, adds role-active class', async () => {
    const { RoleSelector } = await import('../src/ui/role-selector')
    const btn = document.createElement('button')
    new RoleSelector(btn)
    btn.click()
    expect(btn.textContent).toBe('Talkoolainen')
    expect(btn.classList.contains('role-active')).toBe(true)
  })

  it('second click toggles back to järjestäjä, removes role-active', async () => {
    const { RoleSelector } = await import('../src/ui/role-selector')
    const btn = document.createElement('button')
    new RoleSelector(btn)
    btn.click()
    btn.click()
    expect(btn.textContent).toBe('Järjestäjä')
    expect(btn.classList.contains('role-active')).toBe(false)
  })

  it('getRole() returns current role', async () => {
    const { RoleSelector } = await import('../src/ui/role-selector')
    const btn = document.createElement('button')
    const sel = new RoleSelector(btn)
    expect(sel.getRole()).toBe('järjestäjä')
    btn.click()
    expect(sel.getRole()).toBe('talkoolainen')
  })

  it('persists across instances (localStorage)', async () => {
    const { RoleSelector } = await import('../src/ui/role-selector')
    const btn1 = document.createElement('button')
    new RoleSelector(btn1)
    btn1.click()
    const btn2 = document.createElement('button')
    const sel2 = new RoleSelector(btn2)
    expect(sel2.getRole()).toBe('talkoolainen')
    expect(btn2.textContent).toBe('Talkoolainen')
  })
})
