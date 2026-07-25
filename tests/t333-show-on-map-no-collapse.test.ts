import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

// T333/V242 (fix B131): "Näytä kartalla" panoroi kartan — se EI kutista pätkänäkymää.
// Kutistus vei koko heron (.segment-view-next piilotetaan CSS:llä kun .segment-view--collapsed)
// ja ainoa paluu oli merkitsemätön chevron ∴ talkoolainen jäi umpikujaan kentällä.

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
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
    status: 'suunniteltu',
    ...overrides,
  }
}

describe('T333/V242 — panorointi ei kutista näkymää (B131)', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('hero "Näytä kartalla": kutsuu onShowOnMap eikä lisää --collapsed-luokkaa', () => {
    const shown: string[] = []
    const view = new SegmentView(container, makeSeg(), undefined, undefined, {
      onShowOnMap: (id) => shown.push(id),
    })
    view.update([makeMarker({ id: 'm-1' })])

    const panel = container.querySelector('#segment-view') as HTMLElement
    expect(panel.classList.contains('segment-view--collapsed')).toBe(false)

    ;(container.querySelector('.segment-view-next-show') as HTMLButtonElement).click()

    expect(shown).toEqual(['m-1'])
    // Ydinväite: hero jää näkyviin — käyttäjä voi jatkaa ◀▶/Aseta ilman paluuliikettä.
    expect(panel.classList.contains('segment-view--collapsed')).toBe(false)
    expect(container.querySelector('.segment-view-next')).not.toBeNull()
  })

  it('keräyslistan rivi: sama sääntö — panoroi, ei kutista', () => {
    const shown: string[] = []
    const seg = makeSeg({ markerTypeFilter: 'right' })
    const view = new SegmentView(container, seg, undefined, undefined, {
      onShowOnMap: (id) => shown.push(id),
    })
    view.update([makeMarker({ id: 'm-9', type: 'right' })])

    const row = container.querySelector('.segment-view-collect-info') as HTMLButtonElement
    expect(row).not.toBeNull()
    row.click()

    expect(shown).toEqual(['m-9'])
    const panel = container.querySelector('#segment-view') as HTMLElement
    expect(panel.classList.contains('segment-view--collapsed')).toBe(false)
  })

  it('regressio: chevron kutistaa edelleen — käyttäjän oma komento säilyy', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker()])
    const panel = container.querySelector('#segment-view') as HTMLElement
    const chevron = container.querySelector('.segment-view-collapse') as HTMLButtonElement

    chevron.click()
    expect(panel.classList.contains('segment-view--collapsed')).toBe(true)
    expect(chevron.getAttribute('aria-label')).toBe('Laajenna pätkänäkymä')

    chevron.click()
    expect(panel.classList.contains('segment-view--collapsed')).toBe(false)
    expect(chevron.getAttribute('aria-label')).toBe('Pienennä pätkänäkymä')
  })
})
