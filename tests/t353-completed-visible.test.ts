// @vitest-environment jsdom
// T353/V256 (B142): talkoolaisen kuittaus (`Segment.completed`) näkyviin järjestäjän
// tilannekuvaan. Ennen tätä lipulla ⊥ ollut yhtään lukijaa nappien labelien ulkopuolella:
// pätkälistan laskuri & kartan viiva johdettiin pelkästään MERKKIEN statuksista.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function marker(id: string, status: SignMarker['status'], dist: number): SignMarker {
  return {
    id, type: 'right', lat: 65.62, lon: 27.62,
    distanceFromStart: dist, routeIds: ['35km'], status,
  }
}

function setup(completed: boolean, markers: SignMarker[] = []) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'], startDist: 0, endDist: 10000,
    equipment: [], phase: 'asettaminen', displayName: 'Testipätkä', completed,
  })
  new SegmentPanel(container, [], store, vi.fn(), { getMarkers: () => markers })
  return { container }
}

const kuitattu = (c: HTMLElement) => c.querySelector('.segment-kuitattu') as HTMLElement | null
const laskuri = (c: HTMLElement) => c.querySelector('.segment-km') as HTMLElement | null

describe('T353 — kuittaus näkyy pätkälistassa', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('kuitattu pätkä → "✓ Kuitattu" näkyvissä', () => {
    const { container } = setup(true)
    expect(kuitattu(container)?.hidden).toBe(false)
    expect(kuitattu(container)?.textContent).toBe('✓ Kuitattu')
  })

  it('kuittaamaton pätkä → merkintä piilossa', () => {
    const { container } = setup(false)
    expect(kuitattu(container)?.hidden).toBe(true)
  })

  it('kuittaus ⊥ korvaa merkkilaskuria — molemmat näkyvissä', () => {
    const { container } = setup(true, [marker('m1', 'asetettu', 1000), marker('m2', 'suunniteltu', 2000)])
    expect(kuitattu(container)?.hidden).toBe(false)
    expect(laskuri(container)?.textContent).toBe('1/2 asetettu')
  })

  it('ristiriita näkyy: kuitattu vaikka merkit kesken (⊥ piiloteta)', () => {
    const { container } = setup(true, [marker('m1', 'suunniteltu', 1000)])
    expect(kuitattu(container)?.hidden).toBe(false)
    expect(laskuri(container)?.textContent).toBe('0/1 asetettu')
  })

  it('ristiriita toisin päin: kaikki asetettu mutta ⊥ kuitattu', () => {
    const { container } = setup(false, [marker('m1', 'asetettu', 1000)])
    expect(kuitattu(container)?.hidden).toBe(true)
    expect(laskuri(container)?.textContent).toBe('1/1 asetettu')
  })
})
