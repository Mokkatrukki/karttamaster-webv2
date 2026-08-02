// T436/V326 (B175): hero ⊥ julista purkua valmiiksi kun merkkejä on jäänyt päätetilan
// ulkopuolelle. Kuittaamaton merkki näkyy OMANA rivinään + samat kaksi toimintoa (V319).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'purku',
    displayName: 'Matin pätkä',
    ...overrides,
  }
}

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    distanceFromStart: 7000,
    routeIds: ['35km'],
    status: 'asetettu',
    ...overrides,
  }
}

describe('T436/V326 — hero näyttää kuittaamattoman merkin, ei valmis-riviä', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('(B175) 1 kerätty + 2 suunniteltu → ⊥ "Kaikki kerätty", vaan välitilarivi', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'kerätty', status: 'kerätty', distanceFromStart: 6000, label: 'Eka' }),
      makeMarker({ id: 'p1', status: 'suunniteltu', distanceFromStart: 7000, label: 'Toka' }),
      makeMarker({ id: 'p2', status: 'suunniteltu', distanceFromStart: 8000, label: 'Kolmas' }),
    ])
    expect(container.querySelector('.segment-view-next-done')).toBeNull()
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('Toka')
    expect(container.querySelector('.segment-view-next-pending')?.textContent)
      .toContain('Ei kuitattu asetetuksi')
  })

  it('välitilassa on samat kaksi toimintoa (V319): kuittaus + "Ei löytynyt"', () => {
    const collected: Array<[string, boolean]> = []
    const skipped: string[] = []
    const actions: SegmentViewActions = {
      onCollectMarker: (id, c) => collected.push([id, c]),
      onSkipMarker: (id) => skipped.push(id),
    }
    const view = new SegmentView(container, makeSeg(), undefined, actions)
    view.update([makeMarker({ id: 'p1', status: 'suunniteltu', label: 'Toka' })])
    const setBtn = container.querySelector('.segment-view-next-set') as HTMLButtonElement
    expect(setBtn.textContent).toContain('Kerätty')
    setBtn.click()
    expect(collected).toEqual([['p1', true]])
    const skipBtn = container.querySelector('.segment-view-next-skip') as HTMLButtonElement
    expect(skipBtn.textContent).toContain('Ei löytynyt')
    skipBtn.click()
    expect(skipped).toEqual(['p1'])
  })

  it('avoin merkki voittaa välitilan — purkujärjestys ⊥ muutu (T436(c))', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'pending', status: 'suunniteltu', distanceFromStart: 6000, label: 'Kuittaamaton' }),
      makeMarker({ id: 'avoin', status: 'asetettu', distanceFromStart: 9000, label: 'Avoin' }),
    ])
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('Avoin')
    expect(container.querySelector('.segment-view-next-pending')).toBeNull()
  })

  it('◀▶ selaa välitilan merkkejä km-järjestyksessä', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'p1', status: 'suunniteltu', distanceFromStart: 6000, label: 'A' }),
      makeMarker({ id: 'p2', status: 'suunniteltu', distanceFromStart: 8000, label: 'B' }),
    ])
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('A')
    ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click()
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('B')
    ;(container.querySelector('.segment-view-next-prev') as HTMLButtonElement).click()
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('A')
  })

  it('kun ∀ merkki on päätetilassa, valmis-rivi tulee kuten ennen', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'a', status: 'kerätty', distanceFromStart: 6000 }),
      makeMarker({ id: 'b', status: 'ei_tarpeen', distanceFromStart: 7000 }),
    ])
    expect(container.querySelector('.segment-view-next-done-title')?.textContent)
      .toContain('Kaikki kerätty')
  })

  it('asetusvaihe säilyttää entisen valmis-rivin (⊥ välitilaa)', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
    view.update([makeMarker({ id: 'a', status: 'asetettu', distanceFromStart: 6000 })])
    expect(container.querySelector('.segment-view-next-done-title')?.textContent)
      .toContain('Kaikki asetettu')
  })
})
