// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { renderPatkatPage } from '../src/ui/patkat-page'
import { loadActivePhase } from '../src/logic/phase-view'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
import { phaseTarget, segmentTarget } from '../src/logic/phase-target'
import type { Segment } from '../src/logic/segments'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

function seg(id: string, phase: Segment['phase'], extra: Partial<Segment> = {}): Segment {
  return {
    id, routeIds: ['35km'], startDist: 0, endDist: 12000, equipment: [],
    phase, displayName: `Pätkä ${id}`, assignedCode: id.toUpperCase(), ...extra,
  } as Segment
}

function marker(id: string, status: MarkerStatus = 'asetettu'): SignMarker {
  return {
    id, type: 'right', lat: 63, lon: 27, distanceFromStart: 5000,
    routeIds: ['35km'], status,
  }
}

function mountView(segment: Segment, markers: SignMarker[], actions: SegmentViewActions = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const view = new SegmentView(container, segment, undefined, undefined, actions)
  view.update(markers)
  return { container, view }
}

async function setGlobalPhase(phase: string): Promise<void> {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phase }) })))
  await loadActivePhase()
}

beforeEach(() => { document.body.innerHTML = '' })

describe('T427/V318 — talkoolaiselle vain aktiivisen vaiheen tehtävät', () => {
  const segments = [seg('a', 'asettaminen'), seg('b', 'purku'), seg('c', 'tarkastus')]

  it('hub näyttää vain suodatetut rivit ja kertoo vaiheen otsikossa', () => {
    const c = document.createElement('div')
    renderPatkatPage(c, {
      faqMarkdown: '', markers: [], role: 'talkoolainen', activePhase: 'purku',
      segments: segments.filter(s => s.phase === 'purku'),
    })
    expect(c.querySelectorAll('.patkat-list li')).toHaveLength(1)
    expect(c.querySelector('h2')?.textContent).toContain('Purku')
  })

  it('tyhjä lista kertoo MIKSI se on tyhjä (V21: tyhjä ruutu luetaan rikkinäiseksi)', () => {
    const c = document.createElement('div')
    renderPatkatPage(c, {
      faqMarkdown: '', markers: [], role: 'talkoolainen', activePhase: 'purku', segments: [],
    })
    const empty = c.querySelector('.patkat-empty')?.textContent ?? ''
    expect(empty).toContain('Purku')
    expect(empty).not.toBe('Ei pätkiä vielä.')
  })

  // T470/V357/B204: tämä testi koodasi lupauksen "järjestäjä näkee kaikki vaiheet eikä saa
  // vaihe-otsikkoa" — & juuri se lupaus OLI bugi: hub listasi 18 asetus- + 13 purkupätkää
  // sekaisin kun sivupalkki oli suodattanut samalla hetkellä. Rajaus tehdään `patkat.ts`:ssä
  // (`segmentsInPhase`, ks. `tests/t470-*`); tämä pinta vastaa siitä että rajaus SANOTAAN.
  it('otsikko kertoo vaiheen myös järjestäjälle (rajattu lista ⊥ saa esiintyä rajaamattomana)', () => {
    const c = document.createElement('div')
    renderPatkatPage(c, {
      faqMarkdown: '', markers: [], role: 'järjestäjä', activePhase: 'purku',
      segments: segments.filter(s => s.phase === 'purku'),
    })
    expect(c.querySelectorAll('.patkat-list li')).toHaveLength(1)
    expect(c.querySelector('h2')?.textContent).toBe('Pätkät · Purku')
  })
})

describe('T428 — varustelista pois purkuvaiheesta', () => {
  it('purussa varustepinta on piilossa', () => {
    const { container } = mountView(seg('p', 'purku'), [marker('m')])
    expect((container.querySelector('.segment-view-equipment') as HTMLElement).hidden).toBe(true)
    const tab = container.querySelector('.segment-koti-tab[data-tab="varuste"]') as HTMLElement
    expect(tab.hidden).toBe(true)
  })

  it('asettamisessa varustepinta on ennallaan (regressio T262/T264)', () => {
    const { container } = mountView(seg('p', 'asettaminen'), [marker('m', 'suunniteltu')])
    expect((container.querySelector('.segment-view-equipment') as HTMLElement).hidden).toBe(false)
    const tab = container.querySelector('.segment-koti-tab[data-tab="varuste"]') as HTMLElement
    expect(tab.hidden).toBe(false)
  })

  it('vaiheenvaihto ajossa piilottaa/palauttaa listan', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const view = new SegmentView(container, seg('p', 'asettaminen'))
    view.update([marker('m', 'suunniteltu')])
    const el = container.querySelector('.segment-view-equipment') as HTMLElement
    expect(el.hidden).toBe(false)
    view.update([marker('m')], seg('p', 'purku'))
    expect(el.hidden).toBe(true)
  })
})

describe('T429/V319 — purussa tasan kaksi merkkitoimintoa', () => {
  it('purun overflow sisältää VAIN "Ei löytynyt"', () => {
    const { container } = mountView(seg('p', 'purku'), [marker('m')])
    const items = container.querySelectorAll('.segment-view-next-menu-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toBe('Ei löytynyt')
    expect(container.querySelector('.segment-view-next-move')).toBeNull()
    expect(container.querySelector('.segment-view-next-comment')).toBeNull()
    expect(container.querySelector('.segment-view-next-add')).toBeNull()
    expect(container.querySelector('.segment-view-next-photo')).toBeNull()
  })

  it('asetusvaiheen viisi toimintoa ovat ennallaan (regressio T224/T228/T229)', () => {
    const { container } = mountView(seg('p', 'asettaminen'), [marker('m', 'suunniteltu')])
    expect(container.querySelectorAll('.segment-view-next-menu-item')).toHaveLength(5)
    expect(container.querySelector('.segment-view-next-skip')?.textContent).toBe('Ei tarpeen')
  })

  it('"Ei löytynyt" kutsuu samaa ohituspolkua kuin "Ei tarpeen"', () => {
    const skipped: string[] = []
    const { container } = mountView(seg('p', 'purku'), [marker('m')], {
      onSkipMarker: (id) => skipped.push(id),
    })
    ;(container.querySelector('.segment-view-next-skip') as HTMLButtonElement).click()
    expect(skipped).toEqual(['m'])
  })

  it('sekundäärin sana tulee lookupista, kohdestatus on sama molemmissa vaiheissa', () => {
    expect(phaseTarget('asettaminen').secondaryLabel).toBe('Ei tarpeen')
    expect(phaseTarget('purku').secondaryLabel).toBe('Ei löytynyt')
    expect(phaseTarget('asettaminen').secondaryStatus).toBe('ei_tarpeen')
    expect(phaseTarget('purku').secondaryStatus).toBe('ei_tarpeen')
    expect(segmentTarget({ phase: 'purku', markerTypeFilter: 'kerayskasa' }).secondaryLabel)
      .toBe('Ei löytynyt')
  })
})

describe('T430/V320 — kasa syntyy myös ilman GPS:ää', () => {
  // §C: kasanappi vaatii MYÖS globaalin purkuvaiheen ∴ testi asettaa sen & palauttaa lopuksi
  // (moduulitason tila jaetussa rekisterissä, T426/V317).
  beforeAll(async () => { await setGlobalPhase('purku') })
  afterAll(async () => { await setGlobalPhase('asettaminen') })

  it('kasanappi kutsuu onLeavePileä vaikka gpsPositionia ei ole annettu', () => {
    let calls = 0
    const { container } = mountView(seg('p', 'purku'), [marker('m', 'kerätty')], {
      pileCandidates: () => [marker('m', 'kerätty')],
      onLeavePile: () => { calls++ },
    })
    const btn = container.querySelector('.segment-view-pile-btn') as HTMLButtonElement
    expect(btn.hidden).toBe(false)
    btn.click()
    expect(calls).toBe(1)
  })
})
