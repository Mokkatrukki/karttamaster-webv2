import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveSegments, loadSegments } from '../src/logic/segment-persistence'
import type { SegmentStore } from '../src/logic/segments'

function makeMockLS() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    _raw: () => store,
  }
}

const SEG = {
  id: 'seg-1',
  routeIds: ['35km'],
  startDist: 1000,
  endDist: 5000,
  equipment: [],
  phase: 'asettaminen' as const,
  displayName: 'Pätkä 1',
}

describe('segment-persistence — V30, V14', () => {
  let ls: ReturnType<typeof makeMockLS>

  beforeEach(() => {
    ls = makeMockLS()
    vi.stubGlobal('localStorage', ls)
  })

  it('loadSegments returns empty store when nothing saved', () => {
    const store = loadSegments()
    expect(store.size).toBe(0)
  })

  it('save + load round trip preserves segment', () => {
    const store: SegmentStore = new Map([['seg-1', SEG]])
    saveSegments(store)

    const loaded = loadSegments()
    expect(loaded.size).toBe(1)
    const seg = loaded.get('seg-1')!
    expect(seg.routeIds).toEqual(['35km'])
    expect(seg.startDist).toBe(1000)
    expect(seg.endDist).toBe(5000)
    expect(seg.displayName).toBe('Pätkä 1')
  })

  it('save multiple segments', () => {
    const store: SegmentStore = new Map([
      ['seg-1', SEG],
      ['seg-2', { ...SEG, id: 'seg-2', startDist: 5000, endDist: 10000, displayName: 'Pätkä 2' }],
    ])
    saveSegments(store)
    const loaded = loadSegments()
    expect(loaded.size).toBe(2)
  })

  it('corrupt JSON → silent reset, empty store (V14)', () => {
    ls.setItem('karttamaster-segments', 'not-json{{{')
    const store = loadSegments()
    expect(store.size).toBe(0)
    expect(ls.getItem('karttamaster-segments')).toBeNull()
  })

  it('wrong version → silent reset (V14)', () => {
    ls.setItem('karttamaster-segments', JSON.stringify({ version: 99, segments: [] }))
    const store = loadSegments()
    expect(store.size).toBe(0)
    expect(ls.getItem('karttamaster-segments')).toBeNull()
  })

  it('missing segments array → silent reset (V14)', () => {
    ls.setItem('karttamaster-segments', JSON.stringify({ version: 1 }))
    const store = loadSegments()
    expect(store.size).toBe(0)
  })

  it('invalid segment (startDist >= endDist) skipped silently', () => {
    const bad = { ...SEG, startDist: 5000, endDist: 1000 }
    ls.setItem('karttamaster-segments', JSON.stringify({ version: 1, segments: [bad] }))
    const store = loadSegments()
    expect(store.size).toBe(0)
  })

  it('invalid segment (empty routeIds) skipped silently (V30)', () => {
    const bad = { ...SEG, routeIds: [] }
    ls.setItem('karttamaster-segments', JSON.stringify({ version: 1, segments: [bad] }))
    const store = loadSegments()
    expect(store.size).toBe(0)
  })

  it('saveSegments handles empty store', () => {
    saveSegments(new Map())
    const loaded = loadSegments()
    expect(loaded.size).toBe(0)
  })
})
