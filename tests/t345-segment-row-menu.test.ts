// @vitest-environment jsdom
// T345/V250 — pätkärivin ···-pikavalikko. Ydin: katselutoiminnot (zoom, korostus, linkki) eivät
// enää kulje modaalin kautta, ja valikko LUKEE korostustilan wiringistä — ei pidä omaa lippua.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openSegmentRowMenu, segmentRowMenuRows } from '../src/ui/segment-row-menu'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'

function anchor(): HTMLElement {
  const btn = document.createElement('button')
  btn.setAttribute('aria-expanded', 'false')
  document.body.appendChild(btn)
  return btn
}

const rowLabels = () =>
  [...document.querySelectorAll('.segment-row-menu-item')].map(el => el.textContent)

describe('T345 — valikon rivit', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('kaikki toiminnot annettuna: neljä riviä oikeassa järjestyksessä', () => {
    const rows = segmentRowMenuRows({
      onShowOnMap: () => {},
      isFocused: () => false,
      onToggleFocus: () => {},
      shareUrl: '/s/patka-1',
      onOpenDetails: () => {},
    })
    expect(rows.map(r => r.label)).toEqual([
      '🔍 Näytä kartalla',
      '◎ Korosta vain tämä pätkä',
      '🔗 Kopioi talkoolaislinkki',
      '⚙ Lisätiedot & varusteet…',
    ])
  })

  it('jakamaton pätkä: linkkiriviä ei ole (⊥ disabloitu rivi)', () => {
    const rows = segmentRowMenuRows({ shareUrl: null, onOpenDetails: () => {} })
    expect(rows.map(r => r.label)).toEqual(['⚙ Lisätiedot & varusteet…'])
  })

  it('korostusrivi heijastaa wiringin tilaa, ei omaa lippua', () => {
    const on = segmentRowMenuRows({ isFocused: () => true, onToggleFocus: () => {}, onOpenDetails: () => {} })
    expect(on[0].label).toBe('◉ Korostus päällä')
    expect(on[0].pressed).toBe(true)
  })

  it('korostusrivi kytkee vastakkaiseen tilaan', () => {
    const toggle = vi.fn()
    segmentRowMenuRows({ isFocused: () => true, onToggleFocus: toggle, onOpenDetails: () => {} })[0].onSelect()
    expect(toggle).toHaveBeenCalledWith(false)
  })
})

describe('T345 — valikon avaus ja sulkeminen', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { document.body.innerHTML = '' })

  it('avaus renderöi valikon ja merkitsee aria-expanded', () => {
    const a = anchor()
    openSegmentRowMenu(a, { onShowOnMap: () => {}, onOpenDetails: () => {} })
    expect(document.querySelector('.segment-row-menu')).not.toBeNull()
    expect(a.getAttribute('aria-expanded')).toBe('true')
    expect(rowLabels()).toContain('🔍 Näytä kartalla')
  })

  it('valinta sulkee valikon ENNEN toiminnon ajoa (⊥ orpo kerros modaalin päälle)', () => {
    const a = anchor()
    let menuOpenWhenRan: boolean | null = null
    openSegmentRowMenu(a, {
      onOpenDetails: () => { menuOpenWhenRan = !!document.querySelector('.segment-row-menu') },
    })
    document.querySelector<HTMLButtonElement>('.segment-row-menu-item')!.click()
    expect(menuOpenWhenRan).toBe(false)
    expect(document.querySelector('.segment-row-menu')).toBeNull()
    expect(a.getAttribute('aria-expanded')).toBe('false')
  })

  it('Esc sulkee', () => {
    openSegmentRowMenu(anchor(), { onOpenDetails: () => {} })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.segment-row-menu')).toBeNull()
  })

  it('ulkoklikki (backdrop) sulkee', () => {
    openSegmentRowMenu(anchor(), { onOpenDetails: () => {} })
    document.querySelector<HTMLElement>('.segment-row-menu-backdrop')!.click()
    expect(document.querySelector('.segment-row-menu')).toBeNull()
  })

  it('Esc-kuuntelija irtoaa sulkemisessa (⊥ vuoda)', () => {
    const handle = openSegmentRowMenu(anchor(), { onOpenDetails: () => {} })
    handle.close()
    // toinen avaus + Esc ei saa kaataa eikä jättää kahta kuuntelijaa
    openSegmentRowMenu(anchor(), { onOpenDetails: () => {} })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelectorAll('.segment-row-menu-backdrop')).toHaveLength(0)
  })
})

describe('T345 — SegmentPanel-kytkentä', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  })

  function panelWith(cb: Partial<Parameters<typeof SegmentPanel.prototype.constructor>[4]> = {}) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const store = createSegmentStore()
    createSegment(store, {
      routeIds: ['35km'], startDist: 0, endDist: 1000, equipment: [],
      phase: 'asettaminen', displayName: 'Pätkä 1',
    })
    new SegmentPanel(container, [], store, vi.fn(), { getMarkers: () => [], ...cb })
    return store
  }

  it('··· avaa valikon, ei enää suoraan modaalia', () => {
    panelWith()
    document.querySelector<HTMLButtonElement>('.btn-segment-details-open')!.click()
    expect(document.querySelector('.segment-row-menu')).not.toBeNull()
    expect(document.querySelector('.segment-details-modal')).toBeNull()
  })

  it('valikon "Lisätiedot" avaa modaalin', () => {
    panelWith()
    document.querySelector<HTMLButtonElement>('.btn-segment-details-open')!.click()
    const details = [...document.querySelectorAll<HTMLButtonElement>('.segment-row-menu-item')]
      .find(b => b.textContent?.includes('Lisätiedot'))!
    details.click()
    expect(document.querySelector('.segment-details-modal')).not.toBeNull()
  })

  it('"Näytä kartalla" kutsuu wiringin rajausta annetulla pätkällä', () => {
    const onShowSegmentOnMap = vi.fn()
    panelWith({ onShowSegmentOnMap })
    document.querySelector<HTMLButtonElement>('.btn-segment-details-open')!.click()
    const show = [...document.querySelectorAll<HTMLButtonElement>('.segment-row-menu-item')]
      .find(b => b.textContent?.includes('Näytä kartalla'))!
    show.click()
    expect(onShowSegmentOnMap).toHaveBeenCalledTimes(1)
    expect(onShowSegmentOnMap.mock.calls[0][0].displayName).toBe('Pätkä 1')
  })

  it('korostus kulkee samaan tilaan kuin modaalin kytkin (T335)', () => {
    const onToggleFocusSegment = vi.fn()
    panelWith({ isFocusSegment: () => false, onToggleFocusSegment })
    document.querySelector<HTMLButtonElement>('.btn-segment-details-open')!.click()
    const focus = [...document.querySelectorAll<HTMLButtonElement>('.segment-row-menu-item')]
      .find(b => b.textContent?.includes('Korosta'))!
    focus.click()
    expect(onToggleFocusSegment).toHaveBeenCalledTimes(1)
    expect(onToggleFocusSegment.mock.calls[0][1]).toBe(true)
  })
})
