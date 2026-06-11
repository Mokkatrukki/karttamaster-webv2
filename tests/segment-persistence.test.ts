import { describe, it, expect, vi } from 'vitest'
import { saveSegments, loadSegments } from '../src/logic/segment-persistence'
import type { SegmentStore } from '../src/logic/segments'

const SEG = {
  id: 'seg-1',
  routeIds: ['35km'],
  startDist: 1000,
  endDist: 5000,
  equipment: [],
  phase: 'asettaminen' as const,
  displayName: 'Pätkä 1',
}

// DB is the source of truth — segment-persistence.ts is now a no-op layer.
describe('segment-persistence — DB is master', () => {
  it('loadSegments always returns empty store', () => {
    const store = loadSegments()
    expect(store.size).toBe(0)
  })

  it('saveSegments does not throw', () => {
    const store: SegmentStore = new Map([['seg-1', SEG]])
    expect(() => saveSegments(store)).not.toThrow()
  })

  it('saveSegments with onError does not call onError', () => {
    const onError = vi.fn()
    saveSegments(new Map([['seg-1', SEG]]), onError)
    expect(onError).not.toHaveBeenCalled()
  })

  it('saveSegments handles empty store', () => {
    expect(() => saveSegments(new Map())).not.toThrow()
  })
})
