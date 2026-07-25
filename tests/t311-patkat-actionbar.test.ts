// T311/V223: /patkat-hubin primary "Kartalle →" omassa sticky-toimintopalkissa alalaidassa.
// Taso 2 todistaa rakenteen + luokat (palkki on sivun VIIMEINEN lapsi ∴ flow'ssa listan jälkeen →
// scrollin pohjassa se ei peitä viimeistä pätkäriviä, V157/B101-oppi). Pikselit: Playwright 375px.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderPatkatPage } from '../src/ui/patkat-page'
import type { Segment } from '../src/logic/segments'

function seg(id: string): Segment {
  return {
    id,
    routeIds: ['35km'],
    startDist: 0,
    endDist: 10000,
    equipment: [],
    phase: 'asettaminen',
    slug: id,
    displayName: `Pätkä ${id}`,
  } as Segment
}

describe('T311 — /patkat sticky-toimintopalkki (V223)', () => {
  let c: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    c = document.createElement('div')
    document.body.appendChild(c)
  })

  it('"Kartalle →" on .patkat-actionbarin sisällä', () => {
    renderPatkatPage(c, { faqMarkdown: '', segments: [], markers: [], role: 'talkoolainen' })
    const bar = c.querySelector('.patkat-actionbar')
    expect(bar).not.toBeNull()
    expect(bar!.querySelector('.patkat-to-map')?.textContent).toBe('Kartalle →')
  })

  it('palkki on sivun viimeinen lapsi — pätkälistan JÄLKEEN (ei peitä viimeistä riviä pohjassa)', () => {
    renderPatkatPage(c, {
      faqMarkdown: '', segments: [seg('a'), seg('b'), seg('c')], markers: [], role: 'talkoolainen',
    })
    expect(c.lastElementChild?.classList.contains('patkat-actionbar')).toBe(true)
    const kids = Array.from(c.children)
    expect(kids.indexOf(c.querySelector('.patkat-list-section')!))
      .toBeLessThan(kids.indexOf(c.querySelector('.patkat-actionbar')!))
  })

  it('sivu merkitään .patkat-page--has-actionbariksi → alalaidan välistys on palkin, ei orpo gap (V157)', () => {
    renderPatkatPage(c, { faqMarkdown: '', segments: [seg('a')], markers: [], role: 'talkoolainen' })
    expect(c.classList.contains('patkat-page')).toBe(true)
    expect(c.classList.contains('patkat-page--has-actionbar')).toBe(true)
  })

  it('nappi säilyy toimivana (onKartalle-callback)', () => {
    let hit = 0
    renderPatkatPage(c, {
      faqMarkdown: '', segments: [], markers: [], role: 'talkoolainen', onKartalle: () => { hit++ },
    })
    ;(c.querySelector('.patkat-to-map') as HTMLButtonElement).click()
    expect(hit).toBe(1)
  })

  it('uudelleenrenderöinti ei kloonaa palkkia', () => {
    renderPatkatPage(c, { faqMarkdown: '', segments: [seg('a')], markers: [], role: 'talkoolainen' })
    renderPatkatPage(c, { faqMarkdown: '', segments: [seg('a')], markers: [], role: 'talkoolainen' })
    expect(c.querySelectorAll('.patkat-actionbar').length).toBe(1)
  })
})
