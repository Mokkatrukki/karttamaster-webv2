import { describe, it, expect } from 'vitest'
import {
  getEquipmentCounts,
  getEquipmentSummary,
  formatEquipmentSummary,
} from '../src/logic/equipment-counts'
import type { Segment } from '../src/logic/segments'
import type { SignMarker, MarkerStatus } from '../src/logic/types'

// T393/V285 — varustelistan phase-tietoinen tyyppilaskuri. Taso 1 Vitest-pure:
// moduuli ei koske DOM:iin ∴ ei jsdom-docblockia (CLAUDE.md/V248).

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1', routeIds: ['35km'], startDist: 0, endDist: 10000,
    equipment: [], phase: 'asettaminen', displayName: 'Pätkä', ...overrides,
  }
}

let n = 0
function mk(type: string, status: MarkerStatus): SignMarker {
  return {
    id: `m${n++}`, type, lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status,
  }
}

describe('getEquipmentCounts — asettaminen', () => {
  it('take = jäljellä olevat, done = asetettu+tarkistettu+kerätty', () => {
    const seg = makeSeg()
    const markers = [
      mk('right', 'suunniteltu'), mk('right', 'suunniteltu'),
      mk('right', 'asetettu'), mk('right', 'tarkistettu'), mk('right', 'kerätty'),
    ]
    const [row] = getEquipmentCounts(seg, markers)
    expect(row.type).toBe('right')
    expect(row.total).toBe(5)
    expect(row.done).toBe(3)
    expect(row.take).toBe(2)
    expect(row.label).toBe('asetettu')
  })

  it('ei_tarpeen putoaa KAIKISTA luvuista — myös nimittäjästä (V285)', () => {
    const seg = makeSeg()
    const markers = [
      mk('right', 'suunniteltu'), mk('right', 'asetettu'),
      mk('right', 'ei_tarpeen'), mk('right', 'ei_tarpeen'),
    ]
    const [row] = getEquipmentCounts(seg, markers)
    expect(row.total).toBe(2)
    expect(row.done).toBe(1)
    expect(row.take).toBe(1)
  })

  it('tyyppi jolla vain ei_tarpeen-merkkejä katoaa riveiltä (⊥ 0×-haamurivi)', () => {
    const seg = makeSeg()
    const rows = getEquipmentCounts(seg, [
      mk('right', 'suunniteltu'),
      mk('left', 'ei_tarpeen'), mk('left', 'ei_tarpeen'),
    ])
    expect(rows.map(r => r.type)).toEqual(['right'])
  })

  it('täysin asetettu tyyppi → take 0 (rivi on tehty, ei katoa)', () => {
    const rows = getEquipmentCounts(makeSeg(), [mk('right', 'asetettu'), mk('right', 'asetettu')])
    expect(rows[0]).toMatchObject({ take: 0, done: 2, total: 2 })
  })
})

describe('getEquipmentCounts — phase kääntää suunnan', () => {
  const markers = () => [
    mk('right', 'asetettu'), mk('right', 'asetettu'),
    mk('right', 'kerätty'),
  ]

  it('purku laskee vain kerätyt', () => {
    const [row] = getEquipmentCounts(makeSeg({ phase: 'purku' }), markers())
    expect(row).toMatchObject({ total: 3, done: 1, take: 2, label: 'kerätty' })
  })

  it('sama data eri phasessa ⊥ anna samaa lukua', () => {
    const ms = markers()
    const asettaminen = getEquipmentCounts(makeSeg({ phase: 'asettaminen' }), ms)[0]
    const purku = getEquipmentCounts(makeSeg({ phase: 'purku' }), ms)[0]
    expect(asettaminen.take).not.toBe(purku.take)
  })

  it('tarkastus → sama kuin asettaminen (per-merkki-tarkastettu-statusta ⊥ ole, V91)', () => {
    const ms = markers()
    expect(getEquipmentCounts(makeSeg({ phase: 'tarkastus' }), ms)[0])
      .toEqual(getEquipmentCounts(makeSeg({ phase: 'asettaminen' }), ms)[0])
  })
})

describe('getEquipmentCounts — muoto', () => {
  it('tyhjä markers-lista → tyhjä taulukko, ⊥ kaadu', () => {
    expect(getEquipmentCounts(makeSeg(), [])).toEqual([])
  })

  it('tuntematon tyyppi ⊥ kaada — se on vain ryhmäavain', () => {
    const rows = getEquipmentCounts(makeSeg(), [mk('täysin-uusi-tyyppi', 'suunniteltu')])
    expect(rows[0]).toMatchObject({ type: 'täysin-uusi-tyyppi', take: 1 })
  })

  it('järjestys = ensiesiintymä, deterministinen', () => {
    const ms = [mk('left', 'suunniteltu'), mk('right', 'suunniteltu'), mk('left', 'suunniteltu')]
    expect(getEquipmentCounts(makeSeg(), ms).map(r => r.type)).toEqual(['left', 'right'])
    expect(getEquipmentCounts(makeSeg(), ms).map(r => r.type)).toEqual(['left', 'right'])
  })

  it('sample on ei-ei_tarpeen-merkki kun sellainen on (merkkivisuaali)', () => {
    const skipped = mk('right', 'ei_tarpeen')
    const real = mk('right', 'suunniteltu')
    expect(getEquipmentCounts(makeSeg(), [skipped, real])[0].sample.id).toBe(real.id)
  })
})

describe('getEquipmentSummary / formatEquipmentSummary', () => {
  it('summaa yli tyyppien, ei_tarpeen omana lukunaan', () => {
    const s = getEquipmentSummary(makeSeg(), [
      mk('right', 'suunniteltu'), mk('left', 'asetettu'),
      mk('left', 'asetettu'), mk('up', 'ei_tarpeen'),
    ])
    expect(s).toMatchObject({ total: 3, done: 2, take: 1, notNeeded: 1, label: 'asetettu' })
  })

  it('formatoi sektiorivin (V285-sanamuoto)', () => {
    const s = getEquipmentSummary(makeSeg(), [
      ...Array.from({ length: 10 }, () => mk('right', 'asetettu')),
      ...Array.from({ length: 10 }, () => mk('left', 'suunniteltu')),
    ])
    expect(formatEquipmentSummary(s)).toBe('Pätkällä 20 merkkiä · 10 jo asetettu · ota mukaan 10')
  })

  it('done = 0 → ⊥ "jo asetettu" -osaa (⊥ kohinaa ennen lähtöä)', () => {
    const s = getEquipmentSummary(makeSeg(), [mk('right', 'suunniteltu')])
    expect(formatEquipmentSummary(s)).toBe('Pätkällä 1 merkkiä · ota mukaan 1')
  })

  it('ei tarpeen -osa näkyy vain kun J > 0', () => {
    const withNone = getEquipmentSummary(makeSeg(), [mk('right', 'suunniteltu')])
    expect(formatEquipmentSummary(withNone)).not.toContain('ei tarpeen')
    const withSome = getEquipmentSummary(makeSeg(), [mk('right', 'suunniteltu'), mk('right', 'ei_tarpeen')])
    expect(formatEquipmentSummary(withSome)).toContain('1 ei tarpeen')
  })

  it('tyhjä pätkä → "Ei merkkejä pätkällä"', () => {
    expect(formatEquipmentSummary(getEquipmentSummary(makeSeg(), []))).toBe('Ei merkkejä pätkällä')
  })
})
