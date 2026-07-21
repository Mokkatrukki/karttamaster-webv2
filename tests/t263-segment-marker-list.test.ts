import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentMarkerList } from '../src/ui/segment-marker-list'
import type { SignMarker } from '../src/logic/types'

// T263/V183 — KOTI-inline "Kaikki merkit" -lista (SegmentMarkerList). Vitest-jsdom.
function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status: 'suunniteltu', ...overrides,
  }
}

function mount(markers: SignMarker[], onOpenDetail: (id: string) => void = () => {}): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  new SegmentMarkerList(el, { getMarkers: () => markers, onOpenDetail }).render()
  return el
}

describe('T263 — SegmentMarkerList (KOTI-inline kaikki merkit)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('renderöi otsikon lukumäärällä + rivit', () => {
    const el = mount([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })])
    expect(el.querySelector('.segment-view-markers-header')?.textContent).toBe('Kaikki merkit (2)')
    expect(el.querySelectorAll('.segment-view-markers-row').length).toBe(2)
  })

  it('rivit distanceFromStart-järjestyksessä (pienin ensin)', () => {
    const el = mount([
      makeMarker({ id: 'far', distanceFromStart: 9000, label: 'Kaukainen' }),
      makeMarker({ id: 'near', distanceFromStart: 1000, label: 'Lähin' }),
    ])
    const names = [...el.querySelectorAll('.segment-view-markers-name')].map(n => n.textContent)
    expect(names[0]).toBe('Lähin')
    expect(names[1]).toBe('Kaukainen')
  })

  it('rivi näyttää status-labelin + km:t', () => {
    const el = mount([makeMarker({ status: 'asetettu', distanceFromStart: 3000 })])
    expect(el.querySelector('.segment-view-markers-meta')?.textContent).toBe('Asetettu · 3.0 km')
  })

  it('rivin klikkaus kutsuu onOpenDetail merkin id:llä', () => {
    let opened: string | null = null
    const el = mount([makeMarker({ id: 'mk-1' })], (id) => { opened = id })
    ;(el.querySelector('.segment-view-markers-row') as HTMLButtonElement).click()
    expect(opened).toBe('mk-1')
  })

  it('tyhjä lista → empty-viesti, ei rivejä', () => {
    const el = mount([])
    expect(el.querySelector('.segment-view-markers-empty')).not.toBeNull()
    expect(el.querySelectorAll('.segment-view-markers-row').length).toBe(0)
    expect(el.querySelector('.segment-view-markers-header')?.textContent).toBe('Kaikki merkit (0)')
  })

  // T264/V184: ryhmittely asetetut/asettamatta/ei tarpeen.
  it('ryhmittelee: Asettamatta (suunniteltu) / Asetetut / Ei tarpeen', () => {
    const el = mount([
      makeMarker({ id: 'a', status: 'suunniteltu', distanceFromStart: 1000 }),
      makeMarker({ id: 'b', status: 'asetettu', distanceFromStart: 2000 }),
      makeMarker({ id: 'c', status: 'kerätty', distanceFromStart: 3000 }),
      makeMarker({ id: 'd', status: 'ei_tarpeen', distanceFromStart: 4000 }),
    ])
    const groups = [...el.querySelectorAll('.segment-view-markers-group')].map(n => n.textContent)
    expect(groups).toEqual(['Asettamatta (1)', 'Asetetut (2)', 'Ei tarpeen (1)'])
  })

  it('tyhjät ryhmät jätetään pois', () => {
    const el = mount([makeMarker({ status: 'suunniteltu' })])
    const groups = [...el.querySelectorAll('.segment-view-markers-group')].map(n => n.textContent)
    expect(groups).toEqual(['Asettamatta (1)'])
  })
})
