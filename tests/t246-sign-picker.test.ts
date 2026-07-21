import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderSignPicker, type SignPickerCallbacks } from '../src/ui/inventory-page'

function makeCb(over: Partial<SignPickerCallbacks> = {}): SignPickerCallbacks {
  return { onPick: vi.fn(), onCreateNew: vi.fn(), onClose: vi.fn(), ...over }
}

const templates = [
  { id: 'tpl-1', label: 'Alueella pyöräkilpailu' },
  { id: 'tpl-2', label: 'Varo oikealta' },
  { id: 'tpl-3', label: 'Huoltopiste 25km' },
]

let host: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  host = document.body
})

describe('T246 renderSignPicker', () => {
  it('listaa kaikki mallit (label textContent)', () => {
    renderSignPicker(host, templates, makeCb())
    const rows = host.querySelectorAll('.inv-sign-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toBe('Alueella pyöräkilpailu')
  })

  it('haku suodattaa labelin mukaan', () => {
    renderSignPicker(host, templates, makeCb())
    const search = host.querySelector<HTMLInputElement>('.inv-sign-search')!
    search.value = 'oikea'
    search.dispatchEvent(new Event('input'))
    const rows = host.querySelectorAll('.inv-sign-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toBe('Varo oikealta')
  })

  it('ei osumia → "Ei osumia"', () => {
    renderSignPicker(host, templates, makeCb())
    const search = host.querySelector<HTMLInputElement>('.inv-sign-search')!
    search.value = 'zzz'
    search.dispatchEvent(new Event('input'))
    expect(host.querySelector('.inv-sign-list .inv-empty')!.textContent).toContain('Ei osumia')
  })

  it('rivin klikkaus → onClose + onPick(id)', () => {
    const cb = makeCb()
    renderSignPicker(host, templates, cb)
    host.querySelectorAll<HTMLButtonElement>('.inv-sign-row')[0].click()
    expect(cb.onPick).toHaveBeenCalledWith('tpl-1')
    expect(cb.onClose).toHaveBeenCalled()
  })

  it('"+ Uusi merkki" → onClose + onCreateNew', () => {
    const cb = makeCb()
    renderSignPicker(host, templates, cb)
    host.querySelector<HTMLButtonElement>('#inv-sign-new')!.click()
    expect(cb.onCreateNew).toHaveBeenCalled()
    expect(cb.onClose).toHaveBeenCalled()
  })

  it('Sulje-nappi → onClose', () => {
    const cb = makeCb()
    renderSignPicker(host, templates, cb)
    ;[...host.querySelectorAll('button')].find((b) => b.textContent === 'Sulje')!.click()
    expect(cb.onClose).toHaveBeenCalled()
  })

  it('V164: label jossa HTML renderöityy tekstinä', () => {
    renderSignPicker(host, [{ id: 'x', label: '<img src=x onerror="1">' }], makeCb())
    expect(host.querySelector('.inv-sign-row')!.textContent).toBe('<img src=x onerror="1">')
    expect(host.querySelector('.inv-sign-row img')).toBeNull()
  })

  it('palauttaa backdropin (kutsuja poistaa)', () => {
    const backdrop = renderSignPicker(host, templates, makeCb())
    expect(host.contains(backdrop)).toBe(true)
    backdrop.remove()
    expect(host.querySelector('.inv-sign-picker-backdrop')).toBeNull()
  })
})
