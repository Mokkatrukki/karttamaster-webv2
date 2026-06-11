import type { SegmentStore } from './segments'

// DB is the source of truth. These are kept as no-ops for interface compatibility.
export function saveSegments(_store: SegmentStore, _onError?: (err: unknown) => void): void {}

export function loadSegments(): SegmentStore {
  return new Map()
}
