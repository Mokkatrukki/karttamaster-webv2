import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentStatusBar } from '../src/ui/segment-status-bar'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeMarker(id: string, dist: number, status: SignMarker['status']): SignMarker {
  return { id, type: 'right', lat: 0, lon: 0, distanceFromStart: dist, routeIds: ['r1'], status }
}

describe('SegmentStatusBar', () => {
  let container: HTMLElement
  let store: SegmentStore

  beforeEach(() => {
    container = document.createElement('div')
    store = createSegmentStore()
  })

  it('on hidden kun ei pätkiä', () => {
    const bar = new SegmentStatusBar(container)
    bar.update(store, [])
    const el = container.querySelector('#segment-status-bar') as HTMLElement
    expect(el.hidden).toBe(true)
  })

  it('näyttää lukumäärän per status pätkän nimen perässä', () => {
    createSegment(store, {
      routeIds: ['r1'], startDist: 0, endDist: 1000, equipment: [], phase: 'asettaminen', displayName: 'Etelä 1',
    })
    const markers = [makeMarker('m1', 100, 'asetettu'), makeMarker('m2', 200, 'asetettu'), makeMarker('m3', 300, 'kerätty')]
    const bar = new SegmentStatusBar(container)
    bar.update(store, markers)
    const el = container.querySelector('#segment-status-bar') as HTMLElement
    expect(el.hidden).toBe(false)
    expect(el.textContent).toContain('Etelä 1')
    expect(el.textContent).toContain('2 asetettu')
    expect(el.textContent).toContain('1 kerätty')
  })

  it('piilottaa uudelleen kun kaikki pätkät poistetaan', () => {
    createSegment(store, { routeIds: ['r1'], startDist: 0, endDist: 1000, equipment: [], phase: 'asettaminen' })
    const bar = new SegmentStatusBar(container)
    bar.update(store, [])
    expect((container.querySelector('#segment-status-bar') as HTMLElement).hidden).toBe(false)
    store.clear()
    bar.update(store, [])
    expect((container.querySelector('#segment-status-bar') as HTMLElement).hidden).toBe(true)
  })
})
