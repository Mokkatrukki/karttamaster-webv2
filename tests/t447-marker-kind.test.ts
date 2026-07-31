import { describe, it, expect } from 'vitest'
import {
  MARKER_KINDS,
  markerKind,
  markerBehavior,
  countsAsSign,
  isCollectable,
  hasStatus,
  onlySigns,
  type MarkerKind,
} from '../src/logic/marker-kind'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import { getSegmentStatusCounts, getPhaseProgress } from '../src/logic/segments'
import { getEquipmentCounts, getEquipmentSummary } from '../src/logic/equipment-counts'
import { orphanMarkerIds } from '../src/logic/map-filter'
import type { SignMarker } from '../src/logic/types'
import type { Segment } from '../src/logic/segments'

function marker(id: string, over: Partial<SignMarker> = {}): SignMarker {
  return {
    id,
    type: 'nuoli',
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 100,
    routeIds: ['r1'],
    status: 'suunniteltu',
    templateId: 'nuoli-vasen',
    ...over,
  } as SignMarker
}

function pile(id: string, ids: string[] = []): SignMarker {
  return marker(id, { templateId: PILE_TEMPLATE_ID, type: PILE_TEMPLATE_ID, status: 'kerätty', pileMarkerIds: ids })
}

const ALL_KINDS: MarkerKind[] = ['kyltti', 'kasa']

describe('T447/V331 — MARKER_KINDS-taulu on ainoa luokittelun koti', () => {
  it('∀ kind on rivi taulussa (taulun täydellisyys)', () => {
    for (const kind of ALL_KINDS) {
      expect(MARKER_KINDS[kind], `kind ${kind} puuttuu taulusta`).toBeDefined()
    }
    // Taulussa ⊥ saa olla rivejä joita tyyppi ⊥ tunne (parkissa olevat havainto/palvelu eivät
    // saa vuotaa taulun riviksi ennen kuin niillä on käyttäjä — T447c).
    expect(Object.keys(MARKER_KINDS).sort()).toEqual([...ALL_KINDS].sort())
  })

  it('jokaisella rivillä on kaikki kolme käyttäytymiskenttää', () => {
    for (const kind of ALL_KINDS) {
      const row = MARKER_KINDS[kind]
      expect(typeof row.countsAsSign).toBe('boolean')
      expect(typeof row.collectable).toBe('boolean')
      expect(typeof row.hasStatus).toBe('boolean')
      // T456/V341: pintarajaus on saman taulun sarake ∴ uusi luokka ⊥ pääse läpi ilman sitä.
      expect(Array.isArray(row.statusSurfaces)).toBe(true)
    }
  })

  it('kyltti true/true/true, kasa false/true/true', () => {
    expect(MARKER_KINDS.kyltti).toEqual({ countsAsSign: true, collectable: true, hasStatus: true, statusSurfaces: ['patka'] })
    // T456/V341: kasan status elää `/kasat`illa ⊥ pätkäpinnalla (B189).
    expect(MARKER_KINDS.kasa).toEqual({ countsAsSign: false, collectable: true, hasStatus: true, statusSurfaces: ['kasat'] })
  })
})

describe('T447 — markerKind johdetaan templatesta, ⊥ tallenneta', () => {
  it('kasa-template → kasa', () => {
    expect(markerKind(PILE_TEMPLATE_ID)).toBe('kasa')
    expect(markerKind(pile('p1'))).toBe('kasa')
  })

  it('tuntematon templateId → kyltti (vanha data on kylttejä, ⊥ migraatiota)', () => {
    expect(markerKind('jokin-ihan-muu')).toBe('kyltti')
    expect(markerKind(marker('a'))).toBe('kyltti')
  })

  it('puuttuva templateId → kyltti (⊥ kaadu, ⊥ undefined-luokka)', () => {
    expect(markerKind(undefined)).toBe('kyltti')
    expect(markerKind(null)).toBe('kyltti')
    expect(markerKind({ templateId: undefined })).toBe('kyltti')
    expect(markerKind('')).toBe('kyltti')
  })

  it('predikaatit lukevat taulua', () => {
    expect(countsAsSign(marker('a'))).toBe(true)
    expect(countsAsSign(pile('p1'))).toBe(false)
    expect(isCollectable(pile('p1'))).toBe(true)
    expect(hasStatus(pile('p1'))).toBe(true)
    expect(markerBehavior(pile('p1'))).toBe(MARKER_KINDS.kasa)
    expect([marker('a'), pile('p1')].filter(onlySigns).map(m => m.id)).toEqual(['a'])
  })
})

// ── (a) laskurit: kasa ⊥ saa kasvattaa kylttilukemaa ─────────────────────────────────────────

function segment(over: Partial<Segment> = {}): Segment {
  return {
    id: 'seg1',
    routeIds: ['r1'],
    startDist: 0,
    endDist: 10000,
    phase: 'purku',
    ...over,
  } as Segment
}

describe('T447a/V331 — kasa ⊥ laske kylttilaskuriin', () => {
  const seg = segment()
  const markers = [
    marker('a', { status: 'kerätty' }),
    marker('b', { status: 'asetettu' }),
    pile('kasa1', ['a']),
  ]

  it('getSegmentStatusCounts ohittaa kasan', () => {
    const counts = getSegmentStatusCounts(seg, markers, [seg])
    // Ilman rajausta `kerätty` olisi 2 (merkki a + kasa) — järjestäjä lukisi "13 merkkiä"
    // kun kylttejä on 12.
    expect(counts.kerätty).toBe(1)
    expect(counts.asetettu).toBe(1)
    const total = Object.values(counts).reduce((n, v) => n + v, 0)
    expect(total).toBe(2)
  })

  it('getPhaseProgress laskee vain kyltit (kasa ⊥ nimittäjään)', () => {
    const p = getPhaseProgress(seg, markers, [seg])
    expect(p.kind).toBe('count')
    if (p.kind === 'count') {
      expect(p.total).toBe(2)
      expect(p.done).toBe(1)
    }
  })

  it('varustelistalla ⊥ ole kasariviä eikä kasa näy yhteenvedossa', () => {
    const rows = getEquipmentCounts(seg, markers)
    expect(rows.map(r => r.type)).not.toContain(PILE_TEMPLATE_ID)
    expect(getEquipmentSummary(seg, markers).total).toBe(2)
  })

  it('kasa ⊥ ole järjestäjän orpotyöjonossa', () => {
    const orphanSeg = segment({ routeIds: ['r9'], startDist: 0, endDist: 100 })
    const orphans = orphanMarkerIds([orphanSeg], [marker('orpo', { routeIds: ['rX'] }), pile('kasa9')])
    expect(orphans.has('orpo')).toBe(true)
    expect(orphans.has('kasa9')).toBe(false)
  })
})
