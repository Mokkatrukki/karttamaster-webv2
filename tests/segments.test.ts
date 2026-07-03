import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSegmentStore,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentsForPhase,
  getSegmentForCode,
  getMarkersForSegment,
  getSegmentStatusCounts,
  formatStatusCounts,
  validateNoOverlap,
  type Segment,
  type SegmentStore,
} from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

const baseSegment: Omit<Segment, 'id'> = {
  routeIds: ['route-35km'],
  startDist: 1000,
  endDist: 5000,
  equipment: [],
  phase: 'asettaminen',
}

function makeMarker(id: string, routeIds: string[], dist: number): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: dist,
    routeIds,
    status: 'suunniteltu',
  }
}

describe('segments', () => {
  let store: SegmentStore

  beforeEach(() => {
    store = createSegmentStore()
  })

  describe('createSegment', () => {
    it('luo segmentin kaikilla kentillä', () => {
      const s = createSegment(store, baseSegment)
      expect(s.routeIds).toEqual(['route-35km'])
      expect(s.startDist).toBe(1000)
      expect(s.endDist).toBe(5000)
      expect(s.phase).toBe('asettaminen')
      expect(s.id).toBeTruthy()
    })

    it('generoi uniikin id:n', () => {
      const a = createSegment(store, baseSegment)
      const b = createSegment(store, baseSegment)
      expect(a.id).not.toBe(b.id)
    })

    it('hyväksyy eksplisiittisen id:n', () => {
      const s = createSegment(store, baseSegment, 'my-id')
      expect(s.id).toBe('my-id')
    })

    // V11: jatkuvuus — startDist < endDist
    it('V11: heittää virheen jos startDist >= endDist (samat arvot)', () => {
      expect(() => createSegment(store, { ...baseSegment, startDist: 5000, endDist: 5000 })).toThrow('V11')
    })

    it('V11: heittää virheen jos startDist > endDist', () => {
      expect(() => createSegment(store, { ...baseSegment, startDist: 6000, endDist: 5000 })).toThrow('V11')
    })

    // V25: routeIds ei saa olla tyhjä
    it('V25: heittää virheen tyhjällä routeIds:llä', () => {
      expect(() => createSegment(store, { ...baseSegment, routeIds: [] })).toThrow('V25')
    })

    it('tallentaa segmentin storeen', () => {
      const s = createSegment(store, baseSegment)
      expect(store.get(s.id)).toBe(s)
    })
  })

  describe('updateSegment', () => {
    it('päivittää kentät osittain', () => {
      const s = createSegment(store, baseSegment, 'seg-1')
      const updated = updateSegment(store, 'seg-1', { displayName: 'Osuus 1', endDist: 6000 })
      expect(updated?.displayName).toBe('Osuus 1')
      expect(updated?.endDist).toBe(6000)
      expect(updated?.startDist).toBe(1000)
    })

    it('palauttaa null tuntemattomalla id:llä', () => {
      expect(updateSegment(store, 'ei-ole', { displayName: 'X' })).toBeNull()
    })

    it('V11: heittää virheen jos päivitys rikkoo jatkuvuuden', () => {
      createSegment(store, baseSegment, 'seg-1')
      expect(() => updateSegment(store, 'seg-1', { startDist: 9000 })).toThrow('V11')
    })

    it('V25: heittää virheen jos päivitys tyhjentää routeIds:n', () => {
      createSegment(store, baseSegment, 'seg-1')
      expect(() => updateSegment(store, 'seg-1', { routeIds: [] })).toThrow('V25')
    })

    it('ei muuta id:tä', () => {
      createSegment(store, baseSegment, 'seg-1')
      const updated = updateSegment(store, 'seg-1', { displayName: 'X' })
      expect(updated?.id).toBe('seg-1')
    })
  })

  describe('deleteSegment', () => {
    it('poistaa olemassa olevan segmentin', () => {
      createSegment(store, baseSegment, 'seg-1')
      expect(deleteSegment(store, 'seg-1')).toBe(true)
      expect(store.get('seg-1')).toBeUndefined()
    })

    it('palauttaa false tuntemattomalla id:llä', () => {
      expect(deleteSegment(store, 'ei-ole')).toBe(false)
    })
  })

  // V26: asettaminen ja purku ovat erillisiä jakojaoja
  describe('getSegmentsForPhase', () => {
    it('palauttaa vain asettaminen-segmentit', () => {
      createSegment(store, { ...baseSegment, phase: 'asettaminen' }, 's1')
      createSegment(store, { ...baseSegment, phase: 'purku' }, 's2')
      createSegment(store, { ...baseSegment, phase: 'asettaminen' }, 's3')
      const result = getSegmentsForPhase(store, 'asettaminen')
      expect(result.map(s => s.id)).toEqual(['s1', 's3'])
    })

    it('palauttaa vain purku-segmentit (V26)', () => {
      createSegment(store, { ...baseSegment, phase: 'asettaminen' }, 's1')
      createSegment(store, { ...baseSegment, phase: 'purku' }, 's2')
      const result = getSegmentsForPhase(store, 'purku')
      expect(result.map(s => s.id)).toEqual(['s2'])
    })

    it('palauttaa tyhjän taulukon jos ei osumia', () => {
      expect(getSegmentsForPhase(store, 'purku')).toEqual([])
    })
  })

  describe('getSegmentForCode', () => {
    it('löytää segmentin assignedCode:lla', () => {
      createSegment(store, { ...baseSegment, assignedCode: 'TALKOO1' }, 'seg-1')
      const found = getSegmentForCode(store, 'TALKOO1')
      expect(found?.id).toBe('seg-1')
    })

    it('palauttaa undefined tuntemattomalla koodilla', () => {
      expect(getSegmentForCode(store, 'EI-OLE')).toBeUndefined()
    })

    it('ei palauta segmenttiä ilman assignedCode:ta', () => {
      createSegment(store, baseSegment, 'seg-1')
      expect(getSegmentForCode(store, 'anything')).toBeUndefined()
    })
  })

  // V25: routeIds-leikkaus + distanceFromStart-range
  describe('getMarkersForSegment', () => {
    it('palauttaa merkit segmentin alueelta ja routeIds-leikkauksella', () => {
      const segment = createSegment(store, { ...baseSegment, routeIds: ['r1', 'r2'], startDist: 1000, endDist: 5000 })
      const markers: SignMarker[] = [
        makeMarker('m1', ['r1'], 2000),      // sisällä, r1 leikkaa
        makeMarker('m2', ['r2'], 3000),      // sisällä, r2 leikkaa
        makeMarker('m3', ['r3'], 2000),      // sisällä, ei routeId-leikkausta
        makeMarker('m4', ['r1'], 500),       // liian lähellä alkua
        makeMarker('m5', ['r1'], 6000),      // segmentin ulkopuolella
      ]
      const result = getMarkersForSegment(segment, markers)
      expect(result.map(m => m.id)).toEqual(['m1', 'm2'])
    })

    it('sisällyttää raja-arvot (startDist ja endDist)', () => {
      const segment = createSegment(store, { ...baseSegment, startDist: 1000, endDist: 5000 })
      const markers: SignMarker[] = [
        makeMarker('start', ['route-35km'], 1000),
        makeMarker('end', ['route-35km'], 5000),
      ]
      const result = getMarkersForSegment(segment, markers)
      expect(result.map(m => m.id)).toEqual(['start', 'end'])
    })

    // V25: merkki näkyy kerran vaikka se kuuluu useammalle reitille
    it('V25: palauttaa merkin vain kerran vaikka se kuuluu useammalle reitille', () => {
      const segment = createSegment(store, { ...baseSegment, routeIds: ['r1', 'r2'] })
      const markers: SignMarker[] = [
        makeMarker('m1', ['r1', 'r2'], 3000),  // kuuluu molemmille reiteille
      ]
      const result = getMarkersForSegment(segment, markers)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('m1')
    })

    it('palauttaa tyhjän taulukon jos ei osumia', () => {
      const segment = createSegment(store, baseSegment)
      expect(getMarkersForSegment(segment, [])).toEqual([])
    })
  })

  // T141/V88: lukumäärä per status kartan-alle-palkkia varten
  describe('getSegmentStatusCounts', () => {
    it('palauttaa 0 kaikille statuksille tyhjällä pätkällä', () => {
      const segment = createSegment(store, baseSegment)
      expect(getSegmentStatusCounts(segment, [])).toEqual({
        suunniteltu: 0, asetettu: 0, tarkistettu: 0, kerätty: 0, ei_tarpeen: 0,
      })
    })

    it('laskee lukumäärän per status vain segmentin omista merkeistä', () => {
      const segment = createSegment(store, baseSegment)
      const markers: SignMarker[] = [
        { ...makeMarker('m1', ['route-35km'], 2000), status: 'asetettu' },
        { ...makeMarker('m2', ['route-35km'], 3000), status: 'asetettu' },
        { ...makeMarker('m3', ['route-35km'], 4000), status: 'kerätty' },
        { ...makeMarker('outside', ['route-35km'], 9000), status: 'asetettu' },
      ]
      expect(getSegmentStatusCounts(segment, markers)).toEqual({
        suunniteltu: 0, asetettu: 2, tarkistettu: 0, kerätty: 1, ei_tarpeen: 0,
      })
    })

    it('täysi pätkä: kaikki yhdessä statuksessa', () => {
      const segment = createSegment(store, baseSegment)
      const markers: SignMarker[] = [
        { ...makeMarker('m1', ['route-35km'], 2000), status: 'kerätty' },
        { ...makeMarker('m2', ['route-35km'], 3000), status: 'kerätty' },
      ]
      expect(getSegmentStatusCounts(segment, markers)).toEqual({
        suunniteltu: 0, asetettu: 0, tarkistettu: 0, kerätty: 2, ei_tarpeen: 0,
      })
    })
  })

  // T141/B61: sivupalkin pätkärivin teksti (korvaa km-alueen)
  describe('formatStatusCounts', () => {
    it('"ei merkkejä" kun kaikki nollassa', () => {
      expect(formatStatusCounts({
        suunniteltu: 0, asetettu: 0, tarkistettu: 0, kerätty: 0, ei_tarpeen: 0,
      })).toBe('ei merkkejä')
    })

    it('yhdistää useamman statuksen pistein', () => {
      expect(formatStatusCounts({
        suunniteltu: 2, asetettu: 1, tarkistettu: 1, kerätty: 2, ei_tarpeen: 0,
      })).toBe('2 suunniteltu · 1 asetettu · 1 tarkistettu · 2 kerätty')
    })

    it('yksi status: ei erotinta', () => {
      expect(formatStatusCounts({
        suunniteltu: 3, asetettu: 0, tarkistettu: 0, kerätty: 0, ei_tarpeen: 0,
      })).toBe('3 suunniteltu')
    })
  })

  // V49: no overlap on same route
  describe('validateNoOverlap', () => {
    beforeEach(() => {
      createSegment(store, { ...baseSegment, routeIds: ['r1'], startDist: 1000, endDist: 5000 }, 'existing')
    })

    it('palauttaa true jos ei overlapia (ennen olemassa olevaa)', () => {
      expect(validateNoOverlap(store, 'r1', 0, 999)).toBe(true)
    })

    it('palauttaa true jos ei overlapia (jälkeen olemassa olevan)', () => {
      expect(validateNoOverlap(store, 'r1', 5001, 8000)).toBe(true)
    })

    it('palauttaa false täydellä overlapilla', () => {
      expect(validateNoOverlap(store, 'r1', 500, 6000)).toBe(false)
    })

    it('palauttaa false osittaisella overlapilla (alkupää)', () => {
      expect(validateNoOverlap(store, 'r1', 500, 2000)).toBe(false)
    })

    it('palauttaa false osittaisella overlapilla (loppupää)', () => {
      expect(validateNoOverlap(store, 'r1', 4000, 7000)).toBe(false)
    })

    it('palauttaa true vierekkäisille pätkille (exact touch)', () => {
      // startDist2 == endDist1: ei overlap koska overlap = startDist2 < endDist1
      expect(validateNoOverlap(store, 'r1', 5000, 8000)).toBe(true)
      expect(validateNoOverlap(store, 'r1', 0, 1000)).toBe(true)
    })

    it('palauttaa true eri routeId:llä vaikka sama distRange', () => {
      expect(validateNoOverlap(store, 'r2', 1000, 5000)).toBe(true)
    })

    it('excludeId ohittaa oman segmentin (muokkaus)', () => {
      expect(validateNoOverlap(store, 'r1', 1000, 5000, 'existing')).toBe(true)
    })
  })
})
