import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadChecked, setChecked, checkProgress } from '../src/logic/varustarkastus'

// T258/R2 — varustarkastus checkoff (client-only, localStorage per pätkä). Vitest-pure.
// CLAUDE.md: localStorage-testeissä aina vi.stubGlobal-mock (natiivi konfliktoi Node v26:ssa).

function mockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
})

describe('T258 — varustarkastus (client-only checkoff)', () => {
  it('tyhjä alku → loadChecked palauttaa tyhjän joukon', () => {
    expect(loadChecked('seg1').size).toBe(0)
  })

  it('setChecked lisää + persistoi, loadChecked palauttaa saman', () => {
    setChecked('seg1', 'sign:right', true)
    expect(loadChecked('seg1').has('sign:right')).toBe(true)
  })

  it('setChecked(false) poistaa', () => {
    setChecked('seg1', 'item:nauha', true)
    setChecked('seg1', 'item:nauha', false)
    expect(loadChecked('seg1').has('item:nauha')).toBe(false)
  })

  it('pätkäkohtainen — eri segId eri tila', () => {
    setChecked('segA', 'sign:left', true)
    expect(loadChecked('segB').has('sign:left')).toBe(false)
    expect(loadChecked('segA').has('sign:left')).toBe(true)
  })

  it('checkProgress laskee done/total oikein', () => {
    setChecked('s', 'a', true)
    setChecked('s', 'c', true)
    const p = checkProgress(loadChecked('s'), ['a', 'b', 'c'])
    expect(p).toEqual({ done: 2, total: 3 })
  })

  it('checkProgress tyhjä labels → 0/0', () => {
    expect(checkProgress(new Set(), [])).toEqual({ done: 0, total: 0 })
  })

  it('rikkinäinen localStorage-JSON → tyhjä (turvallinen oletus)', () => {
    localStorage.setItem('karttamaster-varustarkastus-x', '{ ei-jsonia')
    expect(loadChecked('x').size).toBe(0)
  })
})
