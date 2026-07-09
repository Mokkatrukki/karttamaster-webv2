import type { SignMarker } from './types'

// V140: tehtävän merkkijoukon KANONINEN lähde. Strukturaalinen interface — sekä Segment
// että AreaMarker toteuttavat sen ilman olio-spesifiä koodia. Kolme lähdettä:
//  - reittifiltteri (jos reitillinen): routeIds-leikkaus ∩ distanceFromStart∈[startDist,endDist] (V25)
//  - eksplisiittiset linkedMarkerIds (poimittu kartalta)
//  - dynaamiset markerTypeFilter-osumat (templateId-täsmäys, V143)
export interface TaskMarkerSource {
  routeIds?: string[]
  startDist?: number
  endDist?: number
  linkedMarkerIds?: string[]
  markerTypeFilter?: string
}

// V140: merkkijoukko = reittifiltteri ∪ linkedMarkerIds ∪ markerTypeFilter-osumat.
// Merkin id uniikki → unioni deduplikoi implisiittisesti (yksi filter-läpikäynti).
// Reitilliselle tehtävälle (kaikki route-kentät annettu) tulos = sama kuin vanha route+dist-filtteri.
export function resolveTaskMarkers(source: TaskMarkerSource, markers: SignMarker[]): SignMarker[] {
  const isRouted =
    source.routeIds != null && source.startDist !== undefined && source.endDist !== undefined
  const routeSet = isRouted ? new Set(source.routeIds) : null
  const start = source.startDist ?? 0
  const end = source.endDist ?? 0
  const linkedSet = new Set(source.linkedMarkerIds ?? [])
  const typeFilter = source.markerTypeFilter

  return markers.filter(m => {
    // reittifiltteri (V25): routeIds-leikkaus ∩ dist-range
    if (
      routeSet &&
      m.routeIds.some(r => routeSet.has(r)) &&
      m.distanceFromStart >= start &&
      m.distanceFromStart <= end
    ) {
      return true
    }
    // eksplisiittinen liitos
    if (linkedSet.has(m.id)) return true
    // dynaaminen tyyppisuodatin — täsmää templateId:llä, EI muuttuvalla labelilla (V143)
    if (typeFilter !== undefined && m.templateId === typeFilter) return true
    return false
  })
}
