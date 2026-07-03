import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response))
}

// T148: SegmentPanel.render() suodattaa getActivePhase()-callbackin läpi kun se annetaan
describe('T148 — SegmentPanel phase-suodin', () => {
  let container: HTMLElement
  let store: SegmentStore

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    mockFetchOk()

    store = createSegmentStore()
    createSegment(store, {
      routeIds: ['35km'], startDist: 0, endDist: 5000,
      equipment: [], phase: 'asettaminen', displayName: 'Asetuspätkä',
    })
    createSegment(store, {
      routeIds: ['35km'], startDist: 5000, endDist: 10000,
      equipment: [], phase: 'tarkastus', displayName: 'Tarkastuspätkä',
    })
  })

  it('ilman getActivePhase-callbackia näyttää kaikki pätkät (taaksepäin yhteensopiva)', () => {
    new SegmentPanel(container, [], store, vi.fn(), {})
    expect(container.querySelectorAll('.segment-item').length).toBe(2)
  })

  it('getActivePhase="asettaminen" näyttää vain asetus-pätkän', () => {
    new SegmentPanel(container, [], store, vi.fn(), { getActivePhase: () => 'asettaminen' })
    const items = container.querySelectorAll('.segment-item')
    expect(items.length).toBe(1)
    expect(items[0].querySelector('.segment-info')?.textContent).toBe('Asetuspätkä')
  })

  it('getActivePhase="tarkastus" näyttää vain tarkastus-pätkän', () => {
    new SegmentPanel(container, [], store, vi.fn(), { getActivePhase: () => 'tarkastus' })
    const items = container.querySelectorAll('.segment-item')
    expect(items.length).toBe(1)
    expect(items[0].querySelector('.segment-info')?.textContent).toBe('Tarkastuspätkä')
  })

  it('getActivePhase="purku" (ei pätkiä) näyttää phase-tietoisen tyhjä-viestin', () => {
    new SegmentPanel(container, [], store, vi.fn(), { getActivePhase: () => 'purku' })
    const empty = container.querySelector('.segment-empty')
    expect(empty?.textContent).toBe('Ei pätkiä purku-vaiheessa')
  })
})
