import { describe, it, expect, beforeEach } from 'vitest'
import { RouteBar } from '../src/map/route-bar'

const routes = [
  { id: '35km', label: '35 km', color: '#ff0000', routePoints: [{ lat: 63, lon: 27, distanceFromStart: 0 }] },
  { id: '55km', label: '55 km', color: '#00ff00', routePoints: [{ lat: 63, lon: 27, distanceFromStart: 0 }] },
]

function mkBar(summary?: { routeId: string; lengthKm: string; markerCount: number }) {
  const container = document.createElement('div')
  const trackFill = document.createElement('div')
  // map/driveMode/markerManager eivät ole käytössä summary-/tab-rakennuspolulla → tyhjät stubit.
  return new RouteBar(
    routes as never, [], {} as never, {} as never, {} as never,
    container, trackFill, () => {}, summary,
  )
}

describe('T224 (A) — RouteBar pätkä-yhteenveto', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('ilman summarya: renderöi reittitabit (taaksepäin-yhteensopiva)', () => {
    const bar = mkBar()
    const container = (bar as unknown as { container: HTMLElement }).container
    expect(container.querySelectorAll('.route-tab').length).toBe(2)
    expect(container.querySelector('.route-segment-summary')).toBeNull()
  })

  it('summaryn kanssa: renderöi pätkä-yhteenvedon, EI reittitabeja', () => {
    const bar = mkBar({ routeId: '35km', lengthKm: '7.0', markerCount: 12 })
    const container = (bar as unknown as { container: HTMLElement }).container
    expect(container.querySelector('.route-segment-summary')).not.toBeNull()
    expect(container.querySelectorAll('.route-tab').length).toBe(0)
    expect(container.querySelector('.rss-meta')?.textContent).toBe('7.0 km · 12 merkkiä')
  })

  it('summary lukitsee drive-reitin pätkän reittiin', () => {
    const bar = mkBar({ routeId: '55km', lengthKm: '3.0', markerCount: 2 })
    expect(bar.getActiveRoute().id).toBe('55km')
  })

  it('yksikkömuoto: 1 merkki (ei "merkkiä")', () => {
    const bar = mkBar({ routeId: '35km', lengthKm: '1.5', markerCount: 1 })
    const container = (bar as unknown as { container: HTMLElement }).container
    expect(container.querySelector('.rss-meta')?.textContent).toBe('1.5 km · 1 merkki')
  })

  it('tuntematon routeId summaryssa → fallback ensimmäiseen reittiin', () => {
    const bar = mkBar({ routeId: 'ei-ole', lengthKm: '2.0', markerCount: 5 })
    expect(bar.getActiveRoute().id).toBe('35km')
  })
})
