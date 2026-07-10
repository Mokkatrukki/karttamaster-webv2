import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView } from '../src/ui/segment-view'
import type { SegmentViewActions } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T218/V143 (skenaario 2): markerTypeFilter-tehtävä = reititön keräyskasa-lista. SegmentView saa
// jo resolvoidut merkit (getMarkersForSegment delegoi resolveTaskMarkers V140) → testeissä syötetään
// osumat suoraan update():iin. Näkymä listaa ne elävästi + per-merkki "Haettu"-kuittaus.

function collectSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-collect',
    // reititön: EI routeIds/startDist/endDist — pelkkä tyyppisuodatin
    markerTypeFilter: 'tpl-keräyskasa',
    equipment: [],
    phase: 'purku',
    displayName: 'Autoporukan keräys',
    ...overrides,
  }
}

function pile(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    distanceFromStart: 3000,
    routeIds: [],
    status: 'suunniteltu',
    templateId: 'tpl-keräyskasa',
    label: 'Keräyskasa',
    ...overrides,
  }
}

describe('T218/V143: dynaaminen keräyslista (skenaario 2)', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('markerTypeFilter-tehtävä → keräyslista näkyy, asettaminen-hero EI', () => {
    const view = new SegmentView(container, collectSeg({ phase: 'asettaminen' }))
    view.update([pile()])
    expect(container.querySelector('.segment-view-collect')).not.toBeNull()
    // hero (Aseta) ei renderöidy keräystehtävälle vaikka phase=asettaminen
    expect(container.querySelector('.segment-view-next-set')).toBeNull()
  })

  it('tavallinen reittipätkä → EI keräyslistaa (hero säilyy)', () => {
    const seg: Segment = {
      id: 'seg-route', routeIds: ['35km'], startDist: 5000, endDist: 12000,
      equipment: [], phase: 'asettaminen',
    }
    const view = new SegmentView(container, seg)
    view.update([pile({ routeIds: ['35km'], distanceFromStart: 7000, templateId: undefined })])
    expect(container.querySelector('.segment-view-collect')?.hasAttribute('hidden')).not.toBe(false)
    expect(container.querySelector('.segment-view-next-set')).not.toBeNull()
  })

  it('listaa kaikki osumat + laskee haettu-määrän', () => {
    const view = new SegmentView(container, collectSeg())
    view.update([
      pile({ id: 'a', distanceFromStart: 1000 }),
      pile({ id: 'b', distanceFromStart: 2000, status: 'kerätty' }),
      pile({ id: 'c', distanceFromStart: 3000 }),
    ])
    const rows = container.querySelectorAll('.segment-view-collect-row')
    expect(rows.length).toBe(3)
    expect(container.querySelector('.segment-view-collect-header')?.textContent).toContain('1/3')
  })

  it('rivit distanceFromStart-järjestyksessä', () => {
    const view = new SegmentView(container, collectSeg())
    view.update([
      pile({ id: 'far', distanceFromStart: 9000, label: 'Kaukana' }),
      pile({ id: 'near', distanceFromStart: 1000, label: 'Lähellä' }),
    ])
    const names = [...container.querySelectorAll('.segment-view-collect-name')].map(e => e.textContent)
    expect(names).toEqual(['Lähellä', 'Kaukana'])
  })

  it('elävä: update() uudella osumalla kasvattaa listan', () => {
    const view = new SegmentView(container, collectSeg())
    view.update([pile({ id: 'a' })])
    expect(container.querySelectorAll('.segment-view-collect-row').length).toBe(1)
    // joku toinen lisäsi keräyskasan → seuraava resolvointi tuo sen listaan
    view.update([pile({ id: 'a' }), pile({ id: 'b', distanceFromStart: 5000 })])
    expect(container.querySelectorAll('.segment-view-collect-row').length).toBe(2)
  })

  it('"Haettu"-kuittaus → onCollectMarker(id, true) kerätymättömälle', () => {
    let call: [string, boolean] | null = null
    const actions: SegmentViewActions = { onCollectMarker: (id, c) => { call = [id, c] } }
    const view = new SegmentView(container, collectSeg(), undefined, undefined, actions)
    view.update([pile({ id: 'x', status: 'suunniteltu' })])
    const btn = container.querySelector('.segment-view-collect-btn') as HTMLButtonElement
    expect(btn.textContent).toContain('Haettu')
    btn.click()
    expect(call).toEqual(['x', true])
  })

  it('jo kerätyn "Haettu ✓" → onCollectMarker(id, false) (peruutus)', () => {
    let call: [string, boolean] | null = null
    const actions: SegmentViewActions = { onCollectMarker: (id, c) => { call = [id, c] } }
    const view = new SegmentView(container, collectSeg(), undefined, undefined, actions)
    view.update([pile({ id: 'y', status: 'kerätty' })])
    const btn = container.querySelector('.segment-view-collect-btn') as HTMLButtonElement
    expect(btn.textContent).toBe('Haettu ✓')
    btn.click()
    expect(call).toEqual(['y', false])
  })

  it('tyhjä lista → "Ei vielä keräyskohteita"', () => {
    const view = new SegmentView(container, collectSeg())
    view.update([])
    expect(container.querySelector('.segment-view-collect-header')?.textContent).toContain('Ei vielä')
    expect(container.querySelectorAll('.segment-view-collect-row').length).toBe(0)
  })
})
