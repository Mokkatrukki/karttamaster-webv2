import { describe, it, expect } from 'vitest'
import {
  createSegmentStore,
  createSegment,
  updateSegment,
  getSegmentForCode,
  cloneSegmentToNextPhase,
} from '../src/logic/segments'

// T297/V209/V210/B113: slug ∀ pätkälle heti luonnissa — ei vaadi "jaa linkki" -assignia.
describe('T297 — pätkän slug (V209)', () => {
  it('luonti generoi slugin displayNamestä ilman assignia', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, {
      routeIds: ['35km'], startDist: 0, endDist: 1000,
      equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1 — Varikko',
    })
    expect(seg.slug).toBe('patka-1-varikko')
    expect(seg.assignedCode).toBeUndefined()
  })

  it('nimetön pätkä saa fallback-slugin', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen' })
    expect(seg.slug).toBe('patka')
  })

  it('reititön tehtävä saa slugin (V139)', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, {
      equipment: [], phase: 'asettaminen', displayName: 'Aluetehtävä Ähtäri',
    })
    expect(seg.slug).toBe('aluetehtava-ahtari')
  })

  it('sama nimi kahdesti → törmäys suffiksoituu (V191)', () => {
    const store = createSegmentStore()
    const a = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    const b = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    expect(a.slug).toBe('patka-1')
    expect(b.slug).toBe('patka-1-2')
  })

  it('slug ei varasta legacy-assignedCodea', () => {
    const store = createSegmentStore()
    createSegment(store, {
      equipment: [], phase: 'asettaminen', displayName: 'Vanha', assignedCode: 'patka-1', slug: 'vanha',
    })
    const uusi = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    expect(uusi.slug).toBe('patka-1-2')
  })

  it('nimenmuutos regeneroi slugin — vanha kuolee (⊥ alias)', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    expect(getSegmentForCode(store, 'patka-1')?.id).toBe(seg.id)

    const updated = updateSegment(store, seg.id, { displayName: 'Varikon silmukka' })
    expect(updated?.slug).toBe('varikon-silmukka')
    expect(getSegmentForCode(store, 'varikon-silmukka')?.id).toBe(seg.id)
    expect(getSegmentForCode(store, 'patka-1')).toBeUndefined()
  })

  it('sama nimi uudelleen → slug ei suffiksoidu itsensä takia', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    const updated = updateSegment(store, seg.id, { displayName: 'Pätkä  1' })
    expect(updated?.slug).toBe('patka-1')
  })

  it('muu kuin nimi ei kosketa slugia', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    const updated = updateSegment(store, seg.id, { completed: true })
    expect(updated?.slug).toBe('patka-1')
  })

  it('eksplisiittinen slug-patch voittaa nimenmuutoksen', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
    const updated = updateSegment(store, seg.id, { displayName: 'Uusi nimi', slug: 'pakotettu' })
    expect(updated?.slug).toBe('pakotettu')
  })

  it('klooni seuraavaan vaiheeseen saa oman slugin (⊥ törmää alkuperäiseen)', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, {
      routeIds: ['35km'], startDist: 0, endDist: 1000,
      equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1',
    })
    const clone = cloneSegmentToNextPhase(store, seg)
    expect(clone?.slug).toBe('patka-1-2')
    expect(clone?.slug).not.toBe(seg.slug)
  })

  it('getSegmentForCode: legacy assignedCode toimii yhä (vanhat jaetut linkit)', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, {
      equipment: [], phase: 'asettaminen', displayName: 'Vanha pätkä', assignedCode: 'VANHA-KOODI',
    })
    expect(getSegmentForCode(store, 'vanha-koodi')?.id).toBe(seg.id)
  })
})
