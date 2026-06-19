import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RoleSelector } from '../src/ui/role-selector'

describe('T81 — järjestäjän toolbar yksinkertaistaminen', () => {
  beforeEach(() => {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem:    (k: string) => store[k] ?? null,
      setItem:    (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear:      () => { store = {} },
    })
  })

  it('lockedRole järjestäjä → btn hidden (V13: ei rooli-togglea)', () => {
    const btn = document.createElement('button')
    new RoleSelector(btn, undefined, 'järjestäjä')
    expect(btn.hidden).toBe(true)
  })

  it('lockedRole talkoolainen → btn hidden (T67: olemassa oleva käytös säilyy)', () => {
    const btn = document.createElement('button')
    new RoleSelector(btn, undefined, 'talkoolainen')
    expect(btn.hidden).toBe(true)
  })

  it('ei lockedRole → btn näkyy (vanha käytös säilyy)', () => {
    const btn = document.createElement('button')
    new RoleSelector(btn)
    expect(btn.hidden).toBe(false)
  })

  it('lockedRole järjestäjä → getRole() palauttaa järjestäjä', () => {
    const btn = document.createElement('button')
    const sel = new RoleSelector(btn, undefined, 'järjestäjä')
    expect(sel.getRole()).toBe('järjestäjä')
  })

  it('lockedRole järjestäjä → onChange kutsutaan heti järjestäjä-roolilla', () => {
    const btn = document.createElement('button')
    const onChange = vi.fn()
    new RoleSelector(btn, onChange, 'järjestäjä')
    expect(onChange).toHaveBeenCalledWith('järjestäjä')
  })

  it('lockedRole järjestäjä → klikki ei vaihda roolia', () => {
    const btn = document.createElement('button')
    const onChange = vi.fn()
    new RoleSelector(btn, onChange, 'järjestäjä')
    onChange.mockClear()
    btn.click()
    expect(onChange).not.toHaveBeenCalled()
    expect(btn.textContent).toBe('Järjestäjä')
  })
})
