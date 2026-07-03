import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bulkCollect } from '../src/logic/segment-actions'
import { SegmentView } from '../src/ui/segment-view'
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
    displayName: 'Purku-pätkä 1',
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

// ── Taso 1: Vitest-pure ──────────────────────────────────────────────────────

describe('T52 — bulkCollect (logiikka, V28)', () => {
  it('palauttaa kaikki ei-terminal-merkit statuksella kerätty', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'suunniteltu' }),
      makeMarker({ id: 'm-2', status: 'asetettu' }),
      makeMarker({ id: 'm-3', status: 'tarkistettu' }),
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(3)
    expect(updated.every(m => m.status === 'kerätty')).toBe(true)
  })

  it('vain kerätty on terminal — ei_tarpeen sisällytetään (V28)', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'kerätty' }),   // terminal → skip
      makeMarker({ id: 'm-2', status: 'ei_tarpeen' }), // not terminal → include
      makeMarker({ id: 'm-3', status: 'suunniteltu' }), // not terminal → include
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(2)
    expect(updated.every(m => m.status === 'kerätty')).toBe(true)
    expect(updated.map(m => m.id)).not.toContain('m-1')
  })

  it('palauttaa tyhjä lista jos kaikki terminal (vain kerätty)', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'kerätty' }),
      makeMarker({ id: 'm-2', status: 'kerätty' }),
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(0)
  })

  it('palauttaa tyhjä lista jos ei merkkejä', () => {
    const updated = bulkCollect(makeSeg(), [])
    expect(updated.length).toBe(0)
  })

  it('ei muuta alkuperäisiä merkkejä (immutability)', () => {
    const seg = makeSeg()
    const m = makeMarker({ status: 'suunniteltu' })
    bulkCollect(seg, [m])
    expect(m.status).toBe('suunniteltu')
  })
})

// ── Taso 2: Vitest-jsdom ─────────────────────────────────────────────────────

describe('T52 — SegmentView bulk-collect UI', () => {
  let container: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('bulk-nappi piilotettu kun phase=asettaminen', () => {
    const seg = makeSeg({ phase: 'asettaminen' })
    const view = new SegmentView(container, seg)
    view.update([makeMarker({ status: 'suunniteltu' })])
    const btn = container.querySelector('.btn-bulk-collect') as HTMLButtonElement
    expect(btn.hidden).toBe(true)
  })

  it('bulk-nappi piilotettu kun kaikki merkit terminal (V28)', () => {
    const seg = makeSeg({ phase: 'purku' })
    const view = new SegmentView(container, seg)
    view.update([makeMarker({ status: 'kerätty' })])
    const btn = container.querySelector('.btn-bulk-collect') as HTMLButtonElement
    expect(btn.hidden).toBe(true)
  })

  it('bulk-nappi näkyy purku-vaiheessa kun on ei-terminal-merkkejä', () => {
    const seg = makeSeg({ phase: 'purku' })
    const view = new SegmentView(container, seg)
    view.update([makeMarker({ status: 'suunniteltu' })])
    const btn = container.querySelector('.btn-bulk-collect') as HTMLButtonElement
    expect(btn.hidden).toBe(false)
  })

  it('bulk-nappi klikkaus kutsuu onBulkCollect-callbackia oikeilla merkeillä', () => {
    const seg = makeSeg({ phase: 'purku' })
    const onBulkCollect = vi.fn()
    const view = new SegmentView(container, seg, onBulkCollect)
    const markers = [
      makeMarker({ id: 'm-1', status: 'suunniteltu' }),
      makeMarker({ id: 'm-2', status: 'kerätty' }),
    ]
    view.update(markers)

    const btn = container.querySelector('.btn-bulk-collect') as HTMLButtonElement
    btn.click()

    expect(onBulkCollect).toHaveBeenCalledOnce()
    const arg = onBulkCollect.mock.calls[0][0] as SignMarker[]
    expect(arg.length).toBe(1)
    expect(arg[0].id).toBe('m-1')
    expect(arg[0].status).toBe('kerätty')
  })

  it('bulk-nappi ei kutsu callbackia kun kaikki terminal', () => {
    const seg = makeSeg({ phase: 'purku' })
    const onBulkCollect = vi.fn()
    const view = new SegmentView(container, seg, onBulkCollect)
    view.update([makeMarker({ status: 'kerätty' })])

    // Button is hidden, but even if called directly:
    const btn = container.querySelector('.btn-bulk-collect') as HTMLButtonElement
    btn.click()

    expect(onBulkCollect).not.toHaveBeenCalled()
  })
})
