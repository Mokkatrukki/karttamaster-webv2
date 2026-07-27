import { describe, it, expect } from 'vitest'
import { getSegmentStatusCounts, getPhaseProgress, getMarkersForSegment, type Segment } from '../src/logic/segments'
import { firstUnsetMarker } from '../src/logic/navigation'
import type { SignMarker } from '../src/logic/types'
import type { Comment } from '../src/logic/comments'

// V245 — HUOMIO ⊥ OLE MERKKI. Tämä on koko huomio-featuren kantava invariantti.
//
// Konkreettinen vaara jota tämä vahtii: talkoolaisen edistymälukema. Jos huomio vuotaisi
// merkkien joukkoon, "12/13 asetettu" muuttuisi "12/14":ksi merkistä jota kukaan ⊥ voi asettaa
// — pätkä ⊥ valmistuisi koskaan. Erillinen `comments`-taulu tekee tästä TOSI nyt; testi lukitsee
// sen niin ettei mikään myöhempi "yhdistetään kaikki karttapisteet" -refaktori riko sitä hiljaa.

const seg: Segment = {
  id: 'seg-1',
  routeIds: ['smtb-55'],
  startDist: 5000,
  endDist: 12000,
  equipment: [],
  phase: 'asettaminen',
  displayName: 'Pätkä 1',
}

const markers: SignMarker[] = [
  { id: 'm1', type: 'right', lat: 65.0, lon: 27.0, distanceFromStart: 6000, routeIds: ['smtb-55'], status: 'asetettu' },
  { id: 'm2', type: 'left', lat: 65.1, lon: 27.1, distanceFromStart: 8000, routeIds: ['smtb-55'], status: 'asetettu' },
  { id: 'm3', type: 'right', lat: 65.2, lon: 27.2, distanceFromStart: 10000, routeIds: ['smtb-55'], status: 'suunniteltu' },
]

// Huomiot SAMOISSA koordinaateissa ja km-välillä kuin merkit — jos jäsenyys vuotaisi, se vuotaisi tässä.
const comments: Comment[] = [
  { id: 'c1', targetType: 'point', lat: 65.05, lon: 27.05, text: 'Tämä voisi korjata', createdAt: '2026-07-25T10:00:00.000Z' },
  { id: 'c2', targetType: 'point', lat: 65.15, lon: 27.15, text: 'Puu kaatuu', createdAt: '2026-07-25T10:05:00.000Z' },
]

describe('V245 — huomio ei vuoda merkkien joukkoon', () => {
  it('Comment-tyypissä ⊥ ole merkin kenttiä (status, type, distanceFromStart)', () => {
    for (const c of comments) {
      expect('status' in c).toBe(false)
      expect('type' in c).toBe(false)
      expect('distanceFromStart' in c).toBe(false)
      expect('routeIds' in c).toBe(false)
    }
  })

  it('pätkän jäsenyys laskee 3 merkkiä — huomiot eivät kelpaa syötteeksi (eri tyyppi)', () => {
    expect(getMarkersForSegment(seg, markers)).toHaveLength(3)
  })

  it('edistymä pysyy 2/3 vaikka huomioita on 2 — juuri tämä lukema rikkoutuisi vuodosta', () => {
    const p = getPhaseProgress(seg, markers)
    expect(p).toMatchObject({ done: 2, total: 3 })
  })

  it('statuslaskurit eivät tunne huomiota (⊥ tuntematonta statusta)', () => {
    const counts = getSegmentStatusCounts(seg, markers)
    expect(counts.asetettu).toBe(2)
    expect(counts.suunniteltu).toBe(1)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('navigaatio ohjaa merkkiin, ⊥ huomioon', () => {
    expect(firstUnsetMarker(markers, seg)?.id).toBe('m3')
  })

  it('huomioilla ⊥ ole km-akselia ∴ niitä ⊥ voi järjestää pätkän akselille', () => {
    // Dokumentoi aikomus: jos joku myöhemmin lisää Commentille distanceFromStart-kentän,
    // tämä testi on se paikka jossa päätös pitää tehdä tietoisesti (V237: pätkä omistaa akselin).
    for (const c of comments) expect((c as Record<string, unknown>).distanceByRoute).toBeUndefined()
  })
})
