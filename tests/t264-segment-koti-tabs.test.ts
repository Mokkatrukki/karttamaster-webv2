// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentKotiTabs } from '../src/ui/segment-koti-tabs'

function el(text: string): HTMLElement {
  const d = document.createElement('div')
  d.textContent = text
  return d
}

describe('T264 — SegmentKotiTabs (koti-välilehdet)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('renderöi 3 tabia + reparentoi elementit paneleihin', () => {
    const a = el('A'), b = el('B'), c = el('C')
    const tabs = new SegmentKotiTabs([
      { id: 'varuste', label: '🎒 Varustelista', els: [a] },
      { id: 'merkit', label: 'Kaikki merkit', els: [b] },
      { id: 'kommentit', label: 'Kommentit', els: [c] },
    ])
    document.body.appendChild(tabs.root)
    expect(tabs.root.querySelectorAll('.segment-koti-tab').length).toBe(3)
    // Elementit siirtyivät paneleihin (reparentointi).
    expect(tabs.root.querySelector('.segment-koti-panel[data-tab="varuste"]')?.contains(a)).toBe(true)
    expect(tabs.root.querySelector('.segment-koti-panel[data-tab="merkit"]')?.contains(b)).toBe(true)
  })

  it('oletuksena ensimmäinen tab aktiivinen, muut panelit piilossa', () => {
    const tabs = new SegmentKotiTabs([
      { id: 'varuste', label: 'V', els: [el('a')] },
      { id: 'merkit', label: 'M', els: [el('b')] },
      { id: 'kommentit', label: 'K', els: [el('c')] },
    ])
    expect(tabs.getActive()).toBe('varuste')
    const panels = tabs.root.querySelectorAll<HTMLElement>('.segment-koti-panel')
    expect(panels[0].hidden).toBe(false)
    expect(panels[1].hidden).toBe(true)
    expect(panels[2].hidden).toBe(true)
    expect(tabs.root.querySelector('.segment-koti-tab.is-active')?.textContent).toBe('V')
  })

  it('tab-klikkaus vaihtaa aktiivin + näyttää oikean panelin', () => {
    const tabs = new SegmentKotiTabs([
      { id: 'varuste', label: 'V', els: [el('a')] },
      { id: 'merkit', label: 'M', els: [el('b')] },
      { id: 'kommentit', label: 'K', els: [el('c')] },
    ])
    document.body.appendChild(tabs.root)
    const merkitBtn = tabs.root.querySelector<HTMLButtonElement>('.segment-koti-tab[data-tab="merkit"]')!
    merkitBtn.click()
    expect(tabs.getActive()).toBe('merkit')
    expect(tabs.root.querySelector<HTMLElement>('.segment-koti-panel[data-tab="varuste"]')!.hidden).toBe(true)
    expect(tabs.root.querySelector<HTMLElement>('.segment-koti-panel[data-tab="merkit"]')!.hidden).toBe(false)
    expect(merkitBtn.classList.contains('is-active')).toBe(true)
    expect(merkitBtn.getAttribute('aria-selected')).toBe('true')
  })

  // T354/V257: sama komponentti palvelee järjestäjän pätkämodaalia — scrolleri on eri elementti.
  // Yleistys on parametri, ⊥ roolihaara sisällä.
  it('oletusscrolleri on #segment-view (talkoolaispolku ennallaan)', () => {
    const host = document.createElement('div')
    host.id = 'segment-view'
    document.body.appendChild(host)
    const tabs = new SegmentKotiTabs([
      { id: 'varuste', label: 'V', els: [el('a')] },
      { id: 'merkit', label: 'M', els: [el('b')] },
    ])
    host.appendChild(tabs.root)
    host.scrollTop = 120
    tabs.root.querySelector<HTMLButtonElement>('.segment-koti-tab[data-tab="merkit"]')!.click()
    expect(host.scrollTop).toBe(0)
  })

  it('scrollerSelector-parametri ohjaa scroll-nollauksen toiseen kuoreen', () => {
    const host = document.createElement('div')
    host.className = 'segment-details-modal-body'
    document.body.appendChild(host)
    const tabs = new SegmentKotiTabs(
      [
        { id: 'varuste', label: 'V', els: [el('a')] },
        { id: 'merkit', label: 'M', els: [el('b')] },
      ],
      { scrollerSelector: '.segment-details-modal-body' },
    )
    host.appendChild(tabs.root)
    host.scrollTop = 200
    tabs.root.querySelector<HTMLButtonElement>('.segment-koti-tab[data-tab="merkit"]')!.click()
    expect(host.scrollTop).toBe(0)
  })

  it('initial-tab toimii sekä merkkijonona että optiona (yhteensopivuus)', () => {
    const defs = () => [
      { id: 'varuste', label: 'V', els: [el('a')] },
      { id: 'merkit', label: 'M', els: [el('b')] },
    ]
    expect(new SegmentKotiTabs(defs(), 'merkit').getActive()).toBe('merkit')
    expect(new SegmentKotiTabs(defs(), { initial: 'merkit' }).getActive()).toBe('merkit')
  })
})
