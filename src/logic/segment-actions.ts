import { isTerminal } from './marker-status'
import type { Segment } from './segments'
import type { SignMarker } from './types'

// V28: atomic bulk-collect — all non-terminal markers in segment → kerätty
// Returns updated copies (caller is responsible for persisting)
export function bulkCollect(
  _segment: Segment,
  markers: SignMarker[],
): SignMarker[] {
  const targets = markers.filter(m => !isTerminal(m.status))
  if (targets.length === 0) return []
  return targets.map(m => ({ ...m, status: 'kerätty' as const }))
}
