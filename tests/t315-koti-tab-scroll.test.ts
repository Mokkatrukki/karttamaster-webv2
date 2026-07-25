// T315/V226 (B123): koti-tabit jakavat SAMAN scrollerin (#segment-view) ∴ tab-vaihto nollaa
// scrollTopin — muuten uusi tabi avautuu keskeltä (edellisen tabin scrollTop jää voimaan).
// CSS-osuus (viewportiin sidottu korkeus → scrolleri aktivoituu) todistetaan Playwrightissa.
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentKotiTabs } from '../src/ui/segment-koti-tabs'

function el(text: string): HTMLElement {
  const d = document.createElement('div')
  d.textContent = text
  return d
}

// jsdom ei laske layoutia ∴ natiivi scrollTop jää 0:aan. Tehdään siitä kirjoitettava kenttä
// jotta "nollataanko se" on havaittavissa.
function makeScroller(): HTMLElement {
  const sv = document.createElement('div')
  sv.id = 'segment-view'
  let top = 0
  Object.defineProperty(sv, 'scrollTop', {
    get: () => top,
    set: (v: number) => { top = v },
    configurable: true,
  })
  document.body.appendChild(sv)
  return sv
}

function makeTabs(): SegmentKotiTabs {
  return new SegmentKotiTabs([
    { id: 'varuste', label: 'Varustelista', els: [el('a')] },
    { id: 'merkit', label: 'Kaikki merkit', els: [el('b')] },
    { id: 'kommentit', label: 'Kommentit', els: [el('c')] },
  ])
}

describe('T315 — koti-tabin vaihto nollaa jaetun scrollerin (V226)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('setActive nollaa #segment-viewin scrollTopin', () => {
    const sv = makeScroller()
    const tabs = makeTabs()
    sv.appendChild(tabs.root)
    sv.scrollTop = 420
    tabs.setActive('merkit')
    expect(sv.scrollTop).toBe(0)
  })

  it('tab-napin klikkaus nollaa scrollTopin (käyttäjän polku)', () => {
    const sv = makeScroller()
    const tabs = makeTabs()
    sv.appendChild(tabs.root)
    sv.scrollTop = 900
    ;(tabs.root.querySelector('.segment-koti-tab[data-tab="kommentit"]') as HTMLButtonElement).click()
    expect(tabs.getActive()).toBe('kommentit')
    expect(sv.scrollTop).toBe(0)
  })

  it('nollaa vain oman scrollerinsa, ei muita scroll-alueita', () => {
    const other = document.createElement('div')
    other.id = 'marker-modal-items'
    let otherTop = 250
    Object.defineProperty(other, 'scrollTop', {
      get: () => otherTop, set: (v: number) => { otherTop = v }, configurable: true,
    })
    document.body.appendChild(other)
    const sv = makeScroller()
    const tabs = makeTabs()
    sv.appendChild(tabs.root)
    tabs.setActive('merkit')
    expect(other.scrollTop).toBe(250)
  })

  it('ei kaadu jos tabit eivät ole scrollerin sisällä (kartta-moodi / irrallinen root)', () => {
    const tabs = makeTabs()
    document.body.appendChild(tabs.root)
    expect(() => tabs.setActive('merkit')).not.toThrow()
    expect(tabs.getActive()).toBe('merkit')
  })
})
