import type { SignMarker } from './types'

// DB is the source of truth. These are kept as no-ops for interface compatibility.
export function saveMarkers(_markers: SignMarker[]): void {}

export function loadMarkers(): SignMarker[] {
  return []
}
