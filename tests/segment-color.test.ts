/**
 * T465 (pilkko) — pätkän VÄRIKIELI. Lohkot siirretty `tests/segments.test.ts`:stä SELLAISENAAN
 * (T464:n jälkeinen tila): pilkkomisen ehto on ettei käyttäytyminen muutu ∴ uusia assertioita ⊥
 * lisätä samassa muutoksessa — muuten ⊥ tiedä kumpi muutos rikkoi.
 *
 * `segmentLineState` EI ole täällä: se lukee `PhaseProgress`ia ∴ se jäi `segments.ts`:ään & sen
 * testit `tests/segments.test.ts`:ään. Jakolinja on väri / status.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  SEGMENT_COLORS,
  SEGMENT_DONE_COLOR,
  colorForSegment,
  assignSegmentColors,
  segmentLineColor,
} from '../src/logic/segment-color'
import {
  createSegmentStore,
  createSegment,
  deleteSegment,
  segmentPrimaryRouteId,
  type Segment,
  type SegmentStore,
} from '../src/logic/segments'

const baseSegment: Omit<Segment, 'id'> = {
  routeIds: ['smtb-30'],
  startDist: 1000,
  endDist: 5000,
  equipment: [],
  phase: 'asettaminen',
}

describe('segment-color', () => {
  let store: SegmentStore

  beforeEach(() => {
    store = createSegmentStore()
  })

// T152/V96: kartan väri = tunniste (stabiili), viivatyyli = status
describe('colorForSegment (V96)', () => {
  it('sama id → aina sama väri (deterministinen)', () => {
    expect(colorForSegment('abc-123')).toBe(colorForSegment('abc-123'))
  })

  it('palauttaa aina paletin värin', () => {
    for (const id of ['a', 'xyz', crypto.randomUUID(), '']) {
      expect(SEGMENT_COLORS).toContain(colorForSegment(id))
    }
  })

  it('poisto ei siirrä muiden värejä — väri riippuu vain id:stä, ei järjestyksestä', () => {
    const a = createSegment(store, { ...baseSegment, startDist: 0, endDist: 1000 }, 'seg-a')
    const b = createSegment(store, { ...baseSegment, startDist: 2000, endDist: 3000 }, 'seg-b')
    const colorBefore = colorForSegment(b.id)
    deleteSegment(store, a.id)
    expect(colorForSegment(b.id)).toBe(colorBefore)
  })
})

// T348/V96-amend/B135: kartan viivaväri = tunniste PAITSI valmiina — silloin status voittaa.
// T464/V352: parametri on TUNNISTEVÄRI ⊥ id (jako tulee `assignSegmentColors`ilta).
describe('segmentLineColor (V96-amend, T348, T464)', () => {
  it('valmis → confirm-vihreä riippumatta tunnisteväristä', () => {
    for (const c of [...SEGMENT_COLORS, '#123456']) {
      expect(segmentLineColor(c, 'valmis')).toBe(SEGMENT_DONE_COLOR)
    }
  })

  it('kesken & ei_alkanut → tunnisteväri sellaisenaan', () => {
    for (const c of SEGMENT_COLORS) {
      expect(segmentLineColor(c, 'kesken')).toBe(c)
      expect(segmentLineColor(c, 'ei_alkanut')).toBe(c)
    }
  })

  it('sama tunnisteväri + eri state → eri väri (status on oma kanavansa)', () => {
    expect(segmentLineColor(SEGMENT_COLORS[0], 'valmis')).not.toBe(segmentLineColor(SEGMENT_COLORS[0], 'kesken'))
  })

  it('vihreä on VARATTU statukselle — tunnistepaletti ei sisällä sitä (T304-rajoite)', () => {
    expect(SEGMENT_COLORS).not.toContain(SEGMENT_DONE_COLOR)
  })
})

// T464/V352 (B200): väri on SUHDE NAAPUREIHIN. Vanha lupaus "poisto ⊥ siirrä muiden värejä"
// (V96) on tässä kumottu tietoisesti — se antoi vakauden & vei erottuvuuden.
describe('assignSegmentColors (V352)', () => {
  const seg = (id: string, startDist: number, endDist: number, over: Partial<Segment> = {}): Segment => ({
    ...baseSegment, id, startDist, endDist, ...over,
  } as Segment)

  const overlaps = (a: Segment, b: Segment) =>
    a.startDist! <= b.endDist! && b.startDist! <= a.endDist!

  const sameGroup = (a: Segment, b: Segment) =>
    a.phase === b.phase && segmentPrimaryRouteId(a) === segmentPrimaryRouteId(b)

  /** V352:n ydinehto koneellisesti: leikkaava TAI koskettava naapuri ⊥ saa samaa väriä. */
  const assertNeighboursDiffer = (segs: Segment[]) => {
    const colors = assignSegmentColors(segs)
    for (const a of segs) {
      for (const b of segs) {
        if (a.id >= b.id) continue
        if (!sameGroup(a, b) || !overlaps(a, b)) continue
        expect(colors.get(a.id), `${a.id} vs ${b.id}`).not.toBe(colors.get(b.id))
      }
    }
    return colors
  }

  it('peräkkäiset pätkät (jaettu päätepiste) saavat eri värin — B200:n ydin', () => {
    const segs = [seg('a', 0, 1000), seg('b', 1000, 2000), seg('c', 2000, 3000)]
    const colors = assertNeighboursDiffer(segs)
    // `a` & `c` SAAVAT olla samanvärisiä — ne ⊥ kosketa toisiaan ∴ niiden väliltä ⊥ lueta
    // rajaa. Vaatimus on naapuruus ⊥ globaali uniikkius: kolmen värin vaatiminen tässä
    // kuluttaisi paletin turhaan & kaatuisi pitkällä ketjulla (4 väriä, 13 pätkää).
    expect(colors.get('a')).not.toBe(colors.get('b'))
    expect(colors.get('b')).not.toBe(colors.get('c'))
  })

  it('leikkaavat pätkät saavat eri värin', () => {
    assertNeighboursDiffer([seg('a', 0, 2000), seg('b', 1000, 3000), seg('c', 2500, 4000)])
  })

  it('B200-regressio: tuotannon 13 purkupätkää — ei yhtään samanväristä naapuria', () => {
    // Arvot `backups/karttamaster-20260801-153447.db`:stä (phase=purku).
    const prod: [string, number, number][] = [
      ['110km', 4.06, 1777.08], ['p1', 3027.04, 9294.65], ['p2', 9347.45, 15761.41],
      ['p3', 15761.41, 19441.09], ['p4', 19441.09, 25653.25], ['30km', 507.37, 4638.54],
      ['p5', 25686.35, 31510.03], ['p6', 31510.03, 35598.36], ['p7', 35598.36, 41122.40],
      ['p8', 41122.40, 49430.25], ['p10', 49430.25, 54229.61], ['huippu', 54229.61, 54899.29],
      ['gravel125', 1018.21, 123363.25],
    ]
    assertNeighboursDiffer(prod.map(([id, s, e]) => seg(id, s, e)))
  })

  it('eri phase ei rajoita — sama km-väli eri vaiheessa saa saman värin', () => {
    const colors = assignSegmentColors([
      seg('aset', 0, 1000, { phase: 'asettaminen' }),
      seg('purku', 0, 1000, { phase: 'purku' }),
    ])
    expect(colors.get('aset')).toBe(colors.get('purku'))
  })

  it('eri primary-reitti ei rajoita', () => {
    const colors = assignSegmentColors([
      seg('r1', 0, 1000, { routeIds: ['r1'], primaryRouteId: 'r1' }),
      seg('r2', 0, 1000, { routeIds: ['r2'], primaryRouteId: 'r2' }),
    ])
    expect(colors.get('r1')).toBe(colors.get('r2'))
  })

  it('reititön tehtävä (V139) pitää hash-värinsä', () => {
    const routeless = { ...baseSegment, id: 'alue', startDist: undefined, endDist: undefined } as Segment
    expect(assignSegmentColors([routeless]).get('alue')).toBe(colorForSegment('alue'))
  })

  it('paletin loppuessa törmäys hyväksytään — ei kaadu, ei paletin ulkopuolista väriä', () => {
    const segs = Array.from({ length: 6 }, (_, i) => seg(`s${i}`, i, 10000))
    const colors = assignSegmentColors(segs)
    expect(colors.size).toBe(6)
    for (const c of colors.values()) expect(SEGMENT_COLORS).toContain(c)
  })

  it('valmistuminen ei vaihda värejä — jako on riippumaton completed-lipusta', () => {
    const segs = [seg('a', 0, 1000), seg('b', 1000, 2000), seg('c', 2000, 3000)]
    const before = assignSegmentColors(segs)
    const after = assignSegmentColors(segs.map(s => (s.id === 'b' ? { ...s, completed: true } : s)))
    for (const s of segs) expect(after.get(s.id)).toBe(before.get(s.id))
  })

  it('syötejärjestys ei vaikuta tulokseen (Map-iteraatio ⊥ vuoda väreihin)', () => {
    const segs = [seg('a', 0, 1000), seg('b', 1000, 2000), seg('c', 2000, 3000)]
    const forward = assignSegmentColors(segs)
    const reversed = assignSegmentColors([...segs].reverse())
    for (const s of segs) expect(reversed.get(s.id)).toBe(forward.get(s.id))
  })
})
})
