// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createSectionHeader } from '../src/ui/section-header'

describe('T371 — jaettu section-header (V61, V267)', () => {
  it('renderöi V61-patternin DOM:n: header + toggle + name', () => {
    const h = createSectionHeader({ name: 'Alueet', collapsed: true, onToggle: vi.fn() })
    expect(h.el.className).toBe('left-panel-section-header')
    expect(h.el.getAttribute('role')).toBe('button')
    expect(h.el.getAttribute('tabindex')).toBe('0')
    expect(h.el.querySelector('.section-header-toggle')?.textContent).toBe('▶')
    expect(h.el.querySelector('.section-header-name')?.textContent).toBe('Alueet')
  })

  it('count-span vain jos count annettu — countClass lisäluokkana', () => {
    const ilman = createSectionHeader({ name: 'X', collapsed: false, onToggle: vi.fn() })
    expect(ilman.el.querySelector('.section-header-count')).toBeNull()

    const kanssa = createSectionHeader({
      name: 'Alueet', collapsed: true, count: '(0)', countClass: 'area-section-count', onToggle: vi.fn(),
    })
    const countEl = kanssa.el.querySelector('.area-section-count')
    expect(countEl?.textContent).toBe('(0)')
    expect(countEl?.classList.contains('section-header-count')).toBe(true)
  })

  it('setCount luo spanin jälkikäteen jos sitä ei ollut', () => {
    const h = createSectionHeader({ name: 'X', collapsed: false, onToggle: vi.fn() })
    h.setCount('(3)')
    expect(h.el.querySelector('.section-header-count')?.textContent).toBe('(3)')
    h.setCount('(4)')
    expect(h.el.querySelectorAll('.section-header-count').length).toBe(1)
  })

  it('toggleClass säilyttää kuluttajan oman selektorin', () => {
    const h = createSectionHeader({
      name: 'Reittipätkät (0)', collapsed: true, toggleClass: 'btn-segment-toggle', onToggle: vi.fn(),
    })
    expect(h.el.querySelector('.btn-segment-toggle')).not.toBeNull()
  })

  it('setCollapsed vaihtaa ikonin JA aria-expandedin', () => {
    const h = createSectionHeader({ name: 'X', collapsed: true, onToggle: vi.fn() })
    expect(h.el.getAttribute('aria-expanded')).toBe('false')
    h.setCollapsed(false)
    expect(h.el.querySelector('.section-header-toggle')?.textContent).toBe('▼')
    expect(h.el.getAttribute('aria-expanded')).toBe('true')
    h.setCollapsed(true)
    expect(h.el.querySelector('.section-header-toggle')?.textContent).toBe('▶')
    expect(h.el.getAttribute('aria-expanded')).toBe('false')
  })

  it('setName päivittää nimen (segment-panel upottaa laskurin nimeen)', () => {
    const h = createSectionHeader({ name: 'Reittipätkät (0)', collapsed: true, onToggle: vi.fn() })
    h.setName('Reittipätkät (7)')
    expect(h.el.textContent).toContain('Reittipätkät (7)')
  })

  it('klikkaus kutsuu onToggle', () => {
    const onToggle = vi.fn()
    const h = createSectionHeader({ name: 'X', collapsed: true, onToggle })
    h.el.click()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // V267: role="button" lupaa näppäimistökäytön — ennen T371:tä lupaus oli valhe.
  it.each(['Enter', ' '])('%s-näppäin kutsuu onToggle & estää oletustoiminnon', (key) => {
    const onToggle = vi.fn()
    const h = createSectionHeader({ name: 'X', collapsed: true, onToggle })
    const ev = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true })
    h.el.dispatchEvent(ev)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('muu näppäin ei togglaa', () => {
    const onToggle = vi.fn()
    const h = createSectionHeader({ name: 'X', collapsed: true, onToggle })
    h.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('ei inline-tyylejä — luokat elävät style.css:ssä (V267)', () => {
    const h = createSectionHeader({
      name: 'Alueet', collapsed: true, count: '(0)', countClass: 'area-section-count', onToggle: vi.fn(),
    })
    expect(h.el.getAttribute('style')).toBeNull()
    for (const span of h.el.querySelectorAll('span')) {
      expect(span.getAttribute('style')).toBeNull()
    }
  })
})
