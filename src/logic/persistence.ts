import type { SignMarker } from './types'

const LS_KEY = 'karttamaster-markers'
const VERSION = 1

interface PersistedData {
  version: number
  markers: SignMarker[]
}

export function saveMarkers(markers: SignMarker[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify({ version: VERSION, markers }))
}

export function loadMarkers(): SignMarker[] {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!isValid(data)) {
      console.warn('[persistence] invalid marker data, resetting')
      localStorage.removeItem(LS_KEY)
      return []
    }
    return data.markers
  } catch {
    console.warn('[persistence] parse error, resetting')
    localStorage.removeItem(LS_KEY)
    return []
  }
}

function isValid(data: unknown): data is PersistedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.version === VERSION && Array.isArray(d.markers)
}
