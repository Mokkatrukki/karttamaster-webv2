import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RoleSelector } from '../src/ui/role-selector'

describe('T32 — rooli-näkymävalinta', () => {
  let store: Record<string, string>
  let btn: HTMLButtonElement

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
    })
    btn = document.createElement('button')
  })

  it('onChange fires on init with current role', () => {
    const onChange = vi.fn()
    new RoleSelector(btn, onChange)
    expect(onChange).toHaveBeenCalledWith('järjestäjä')
  })

  it('onChange fires on toggle', () => {
    const onChange = vi.fn()
    new RoleSelector(btn, onChange)
    btn.click()
    expect(onChange).toHaveBeenLastCalledWith('talkoolainen')
  })

  it('onChange fires twice on double toggle — returns to järjestäjä', () => {
    const onChange = vi.fn()
    new RoleSelector(btn, onChange)
    btn.click()
    btn.click()
    expect(onChange).toHaveBeenLastCalledWith('järjestäjä')
  })

  it('init with talkoolainen in localStorage → onChange fires talkoolainen', () => {
    store['karttamaster-role'] = 'talkoolainen'
    const onChange = vi.fn()
    new RoleSelector(btn, onChange)
    expect(onChange).toHaveBeenCalledWith('talkoolainen')
  })

  it('no onChange → no crash', () => {
    expect(() => {
      const sel = new RoleSelector(btn)
      btn.click()
      expect(sel.getRole()).toBe('talkoolainen')
    }).not.toThrow()
  })

  describe('applyRoleView — body.dataset.role', () => {
    it('järjestäjä sets body dataset', () => {
      new RoleSelector(btn, (role) => { document.body.dataset.role = role })
      expect(document.body.dataset.role).toBe('järjestäjä')
    })

    it('talkoolainen toggle updates body dataset', () => {
      new RoleSelector(btn, (role) => { document.body.dataset.role = role })
      btn.click()
      expect(document.body.dataset.role).toBe('talkoolainen')
    })
  })

  describe('T67 — V39: lockedRole tietoturva', () => {
    it('lockedRole=talkoolainen → nappi piilotettu (hidden=true)', () => {
      new RoleSelector(btn, undefined, 'talkoolainen')
      expect(btn.hidden).toBe(true)
    })

    it('lockedRole=talkoolainen → rooli pysyy talkoolaisena, klikki ei muuta', () => {
      const onChange = vi.fn()
      const sel = new RoleSelector(btn, onChange, 'talkoolainen')
      btn.click()
      expect(sel.getRole()).toBe('talkoolainen')
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('talkoolainen')
    })

    it('lockedRole=talkoolainen → onChange fires talkoolainen init:ssä', () => {
      const onChange = vi.fn()
      new RoleSelector(btn, onChange, 'talkoolainen')
      expect(onChange).toHaveBeenCalledWith('talkoolainen')
    })

    it('lockedRole=järjestäjä → nappi näkyvissä, toggle toimii', () => {
      const onChange = vi.fn()
      new RoleSelector(btn, onChange, 'järjestäjä')
      expect(btn.hidden).toBe(false)
      btn.click()
      expect(onChange).toHaveBeenLastCalledWith('talkoolainen')
    })

    it('ilman lockedRole → nappi näkyvissä (vanha käyttäytyminen säilyy)', () => {
      new RoleSelector(btn)
      expect(btn.hidden).toBe(false)
    })

    it('lockedRole=talkoolainen → localStorage ei ylikirjoitu järjestäjäksi klikillä', () => {
      new RoleSelector(btn, undefined, 'talkoolainen')
      btn.click()
      expect(store['karttamaster-role']).not.toBe('järjestäjä')
    })
  })
})
