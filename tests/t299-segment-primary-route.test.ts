import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import {
  createSegmentStore,
  createSegment,
  segmentPrimaryRouteId,
  validateNoOverlap,
  cloneSegmentToNextPhase,
} from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'
import { computeGapRanges } from '../src/map/segment-overlay'

// r1 ja r2 kulkevat SAMAA polkua (jaettu osuus, kuten 3 SMTB-reittiä) mutta eri km-lukemilla:
// sama fyysinen piste on r1:llä 5.0 km ja r2:lla 45.0 km. Tämä on B114:n koeasetelma.
const SHARED_PATH = [
  { lat: 65.0, lon: 25.0 },
  { lat: 65.1, lon: 25.1 },
  { lat: 65.2, lon: 25.2 },
]

const R1 = SHARED_PATH.map((p, i) => ({ ...p, distanceFromStart: i * 5000 }))
const R2 = SHARED_PATH.map((p, i) => ({ ...p, distanceFromStart: 40000 + i * 5000 }))
// r3 risteää polun vain yhdessä kohdassa — ei jaettu osuus.
const R3 = [
  { lat: 65.1, lon: 25.1, distanceFromStart: 0 },
  { lat: 66.5, lon: 27.0, distanceFromStart: 9000 },
]

const ROUTES = [
  { id: 'r1', routePoints: R1 },
  { id: 'r2', routePoints: R2 },
  { id: 'r3', routePoints: R3 },
] as never[]

function setup() {
  const store = createSegmentStore()
  const container = document.createElement('div')
  document.body.appendChild(container)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id-' + Math.random() })

  const panel = new SegmentPanel(container, ROUTES, store, vi.fn(), {
    onFirstPoint: vi.fn(),
    onFirstPointClear: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
  })
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  container.querySelector<HTMLElement>('#btn-segment-create')!.click()
  return { panel, store, container }
}

function errorText(container: HTMLElement): string {
  const el = document.querySelector<HTMLElement>('[data-error-el]')
  return el && !el.hidden ? (el.textContent ?? '') : ''
}

function savedSegment(store: SegmentStore) {
  const btn = document.querySelector<HTMLElement>('.btn-segment-creation-save')
  btn?.click()
  return Array.from(store.values())[0]
}

describe('T299/B114 — pätkän km mitataan yhdestä reitistä', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('molemmat klikit samalle reitille → väli on sen reitin km:issä', () => {
    const { panel, store } = setup()
    panel.onSnapClick('r1', 0, 65.0, 25.0)
    panel.onSnapClick('r1', 5000, 65.1, 25.1)

    const seg = savedSegment(store)
    expect(seg.startDist).toBe(0)
    expect(seg.endDist).toBe(5000)
    expect(seg.primaryRouteId).toBe('r1')
  })

  // B114:n ydin: ennen korjausta klikki 2:n km luettiin SIITÄ reitistä johon se snappasi
  // → [0, 45000] = 45 km pätkä joka keräsi merkkejä pitkin molempia reittejä.
  it('klikki 2 osuu jaetulla osuudella toiseen reittiin → km silti primarysta, ei sekoitusta', () => {
    const { panel, store } = setup()
    panel.onSnapClick('r1', 0, 65.0, 25.0)
    panel.onSnapClick('r2', 45000, 65.1, 25.1)

    const seg = savedSegment(store)
    expect(seg.primaryRouteId).toBe('r1')
    expect(seg.startDist).toBe(0)
    expect(seg.endDist).toBe(5000)
    expect(seg.endDist).not.toBe(45000)
  })

  it('klikki 2 kaukana primary-reitistä → virhe, ei pätkää', () => {
    const { panel, store, container } = setup()
    panel.onSnapClick('r1', 0, 65.0, 25.0)
    panel.onSnapClick('r3', 9000, 66.5, 27.0)

    expect(errorText(container)).toMatch(/samalla reitillä/i)
    expect(store.size).toBe(0)
  })

  it('rinnakkain kulkeva reitti tulee jäseneksi, vain risteävä ei', () => {
    const { panel, store } = setup()
    panel.onSnapClick('r1', 0, 65.0, 25.0)
    panel.onSnapClick('r1', 10000, 65.2, 25.2)

    const seg = savedSegment(store)
    expect(seg.routeIds).toContain('r1')
    expect(seg.routeIds).toContain('r2')
    expect(seg.routeIds).not.toContain('r3')
  })
})

describe('T299/V211 — primaryRouteId logiikkakerroksessa', () => {
  it('legacy-pätkä ilman primaryRouteId → routeIds[0]', () => {
    expect(segmentPrimaryRouteId({ routeIds: ['r1', 'r2'] })).toBe('r1')
    expect(segmentPrimaryRouteId({ primaryRouteId: 'r2', routeIds: ['r1', 'r2'] })).toBe('r2')
    expect(segmentPrimaryRouteId({})).toBeUndefined()
  })

  it('primaryRouteId joka ei ole routeIds-listalla → V211-virhe', () => {
    const store = createSegmentStore()
    expect(() =>
      createSegment(store, {
        routeIds: ['r1'],
        primaryRouteId: 'r2',
        startDist: 0,
        endDist: 1000,
        equipment: [],
        phase: 'asettaminen',
      }),
    ).toThrow(/V211/)
  })

  it('overlap ratkeaa primary-reitillä — jaettu jäsenyys ei enää estä', () => {
    const store = createSegmentStore()
    createSegment(store, {
      routeIds: ['r1', 'r2'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 5000,
      equipment: [],
      phase: 'asettaminen',
    })

    // sama km-väli mutta ERI primary = eri geometria ∴ ei törmäys
    expect(validateNoOverlap(store, 'r2', 0, 5000, 'asettaminen')).toBe(true)
    // sama primary + päällekkäinen väli = aito törmäys
    expect(validateNoOverlap(store, 'r1', 2000, 7000, 'asettaminen')).toBe(false)
  })

  it('klooni seuraavaan vaiheeseen säilyttää primaryRouteId:n', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, {
      routeIds: ['r1', 'r2'],
      primaryRouteId: 'r1',
      startDist: 0,
      endDist: 5000,
      equipment: [],
      phase: 'asettaminen',
    })
    const clone = cloneSegmentToNextPhase(store, seg)
    expect(clone?.primaryRouteId).toBe('r1')
    expect(clone?.phase).toBe('tarkastus')
  })
})

describe('T299/V211 — kattavuuslasku primary-reitin km-akselilla', () => {
  const rp = Array.from({ length: 51 }, (_, i) => ({
    lat: 65 + i / 1000, lon: 27, distanceFromStart: i * 100,
  }))

  const seg = (id: string, routeIds: string[], primaryRouteId: string | undefined, a: number, b: number) =>
    ({ id, routeIds, primaryRouteId, startDist: a, endDist: b, equipment: [], phase: 'asettaminen' }) as never

  it('naapurireitin km-väli ei enää valu tämän reitin kattavuuteen', () => {
    // pätkä on jäsenenä r1:llä mutta sen km:t mitattiin r2:lla → ei kata r1:n akselia
    const gaps = computeGapRanges([seg('s1', ['r1', 'r2'], 'r2', 1000, 3000)], 'r1', rp)
    expect(gaps).toEqual([[0, 5000]])
  })

  it('oman primaryn pätkä kattaa normaalisti', () => {
    const gaps = computeGapRanges([seg('s1', ['r1', 'r2'], 'r1', 1000, 3000)], 'r1', rp)
    expect(gaps).toEqual([[0, 1000], [3000, 5000]])
  })

  it('legacy-pätkä ilman primaryä → routeIds[0] ratkaisee', () => {
    expect(computeGapRanges([seg('s1', ['r1'], undefined, 1000, 3000)], 'r1', rp))
      .toEqual([[0, 1000], [3000, 5000]])
    expect(computeGapRanges([seg('s1', ['r2', 'r1'], undefined, 1000, 3000)], 'r1', rp))
      .toEqual([[0, 5000]])
  })
})
