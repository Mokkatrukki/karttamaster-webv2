// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { createSectionHeader } from '../src/ui/section-header'

describe('T371 — jaettu section-header (V61, V267)', () => {
  it('renderöi V61-patternin DOM:n: header + toggle + name', () => {
    const h = createSectionHeader({ name: 'Alueet', collapsed: true, onToggle: vi.fn() })
    expect(h.el.className).toBe('left-panel-section-header')
    // T373/V268: oikea nappi ∴ kosketusvahti näkee sen & fokus/Enter/Space tulevat natiivina.
    expect(h.el.tagName).toBe('BUTTON')
    expect((h.el as HTMLButtonElement).type).toBe('button')
    expect(h.el.getAttribute('role')).toBeNull()
    expect(h.el.getAttribute('tabindex')).toBeNull()
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

  // T373: EI omaa keydown-kuuntelijaa. Natiivi nappi laukaisee clickin Enteristä/Spacesta ∴
  // oma kuuntelija tuplaisi toggle-kutsun ja tila palaisi lähtöpisteeseen (hiljainen regressio).
  // jsdom ⊥ toteuta natiivia keydown→click-aktivointia ∴ tämä testi mittaa nimenomaan sitä
  // ETTEI moduulissa ole omaa kuuntelijaa; oikea näppäinaktivointi varmistetaan Playwrightissa
  // (e2e/critical-paths.spec.ts "section-header aktivoituu näppäimistöltä").
  it.each(['Enter', ' '])('%s ⊥ laukaise omaa keydown-kuuntelijaa (⊥ tuplakutsua)', (key) => {
    const onToggle = vi.fn()
    const h = createSectionHeader({ name: 'X', collapsed: true, onToggle })
    h.el.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  // V267:n ydin: apurin OLEMASSAOLO ei riitä, sen ohi ei saa mennä. Ilman tätä testiä
  // neljäs käsin kirjoitettu header syntyisi hiljaa — juuri niin pattern rapautui kerran jo.
  it('yksikään src/ui/-tiedosto ei rakenna omaa section-headeria (V267)', () => {
    const rikkojat = readdirSync('src/ui')
      .filter(f => f.endsWith('.ts') && f !== 'section-header.ts')
      .filter(f => readFileSync(`src/ui/${f}`, 'utf8')
        .split('\n')
        .some(rivi => rivi.includes("'left-panel-section-header'") || rivi.includes('"left-panel-section-header"')))
    expect(rikkojat, 'käytä createSectionHeaderia (src/ui/section-header.ts)').toEqual([])
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
