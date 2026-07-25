import type { SignMarker } from './types'
import { distancesForRoute } from './marker-distance'

// V140: tehtävän merkkijoukon KANONINEN lähde. Strukturaalinen interface — sekä Segment
// että AreaMarker toteuttavat sen ilman olio-spesifiä koodia. Kolme lähdettä:
//  - reittifiltteri (jos reitillinen): routeIds-leikkaus ∩ distanceFromStart∈[startDist,endDist] (V25)
//  - eksplisiittiset linkedMarkerIds (poimittu kartalta)
//  - dynaamiset markerTypeFilter-osumat (templateId-täsmäys, V143)
export interface TaskMarkerSource {
  routeIds?: string[]
  // T299/V211: mitä reittiä startDist/endDist mittaavat. Puuttuu legacyltä → routeIds[0].
  primaryRouteId?: string
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
  // T299/T300/V211/V212: km-vertailun akseli. Pätkän [start,end] on mitattu TÄTÄ reittiä
  // vasten ∴ merkin km ! lukea samalta reitiltä — ei sokeasti `distanceFromStart`ista,
  // joka voi olla mitattu ihan toisesta geometriasta (B115).
  const primaryRouteId = source.primaryRouteId ?? source.routeIds?.[0]
  const start = source.startDist ?? 0
  const end = source.endDist ?? 0
  const linkedSet = new Set(source.linkedMarkerIds ?? [])
  const typeFilter = source.markerTypeFilter

  return markers.filter(m => {
    // reittifiltteri (V25): routeIds-leikkaus ∩ dist-range
    if (routeSet && m.routeIds.some(r => routeSet.has(r))) {
      // T302/V214: riittää että YKSI km-ehdokas osuu väliin — lenkillä sama merkki on
      // reitillä kahdessa km-kohdassa ja vain toinen niistä kuuluu pätkään.
      if (distancesForRoute(m, primaryRouteId).some(d => d >= start && d <= end)) return true
    }
    // eksplisiittinen liitos
    if (linkedSet.has(m.id)) return true
    // dynaaminen tyyppisuodatin — täsmää templateId:llä, EI muuttuvalla labelilla (V143)
    if (typeFilter !== undefined && m.templateId === typeFilter) return true
    return false
  })
}
