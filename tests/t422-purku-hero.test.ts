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

describe('T422/V313 — purku-hero', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('(i) purku-pätkä renderöi heron (ei enää piilossa)', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker()])
    const hero = container.querySelector('.segment-view-next') as HTMLElement
    expect(hero.hidden).toBe(false)
    expect(container.querySelector('.segment-view-next-label')?.textContent).toContain('Seuraava purettava')
  })

  it('(i) kuittausnappi on "Kerätty" ja kutsuu onCollectMarker', () => {
    const collected: Array<[string, boolean]> = []
    const set: string[] = []
    const actions: SegmentViewActions = {
      onCollectMarker: (id, c) => collected.push([id, c]),
      onSetMarker: (id) => set.push(id),
    }
    const view = new SegmentView(container, makeSeg(), undefined, undefined, actions)
    view.update([makeMarker()])
    const btn = container.querySelector('.segment-view-next-set') as HTMLButtonElement
    expect(btn.textContent).toContain('Kerätty')
    btn.click()
    expect(collected).toEqual([['m-1', true]])
    expect(set).toEqual([])
  })

  it('(ii) purussa `asetettu` näkyy herossa, `suunniteltu` ei (V313)', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'ei-asetettu', status: 'suunniteltu', distanceFromStart: 6000, label: 'Eka' }),
      makeMarker({ id: 'asetettu', status: 'asetettu', distanceFromStart: 8000, label: 'Toka' }),
    ])
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('Toka')
    // Vain yksi avoin ∴ ◀▶-nuolia ei renderöidä.
    expect(container.querySelector('.segment-view-next-prev')).toBeNull()
  })

  it('(ii) järjestys kulkee alusta loppuun kuten asettamisessa (V312)', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'a', status: 'asetettu', distanceFromStart: 6000, label: 'Alku' }),
      makeMarker({ id: 'b', status: 'asetettu', distanceFromStart: 11000, label: 'Loppu' }),
    ])
    expect(container.querySelector('.segment-view-next-name')?.textContent).toBe('Alku')
    expect(container.querySelector('.segment-view-next-label')?.textContent).toContain('1/2')
  })

  it('(ii) kaikki kerätty → "Kaikki kerätty 🎉"', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker({ status: 'kerätty' })])
    expect(container.querySelector('.segment-view-next-done-title')?.textContent).toContain('Kaikki kerätty')
  })

  it('(iii) markerTypeFilter-tehtävä EI saa heroa (regressio T218)', () => {
    const view = new SegmentView(container, makeSeg({ markerTypeFilter: 'kerayskasa' }))
    view.update([makeMarker()])
    expect((container.querySelector('.segment-view-next') as HTMLElement).hidden).toBe(true)
  })

  it('(iii) tarkastus-vaihe EI saa merkkiheroa (V91)', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'tarkastus' }))
    view.update([makeMarker()])
    expect((container.querySelector('.segment-view-next') as HTMLElement).hidden).toBe(true)
  })

  it('(iv) asettaminen-hero muuttumaton', () => {
    const set: string[] = []
    const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
      onSetMarker: (id) => set.push(id),
    })
    view.update([makeMarker({ status: 'suunniteltu' })])
    expect(container.querySelector('.segment-view-next-label')?.textContent).toBe('Seuraava merkki')
    const btn = container.querySelector('.segment-view-next-set') as HTMLButtonElement
    expect(btn.textContent).toContain('Aseta')
    btn.click()
    expect(set).toEqual(['m-1'])
  })

  it('(v) "Merkitse pätkä valmiiksi" toimii purussa kun kaikki kerätty (T230/T351)', () => {
    const done: boolean[] = []
    const view = new SegmentView(container, makeSeg(), undefined, undefined, {
      onComplete: (c) => done.push(c),
    })
    view.update([makeMarker({ status: 'kerätty' })])
    const btn = container.querySelector('.segment-hero-complete-btn') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()
    expect(done).toEqual([true])
  })
})
