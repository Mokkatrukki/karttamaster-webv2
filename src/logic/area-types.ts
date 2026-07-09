export type AreaStatus = 'suunniteltu' | 'valmis'

export interface AreaFeature {
  id: string
  name?: string
  centerLat: number
  centerLng: number
  widthM: number
  heightM: number
  rotation: number
  color: string
}

export interface AreaMarker {
  id: string
  name: string
  centerLat: number
  centerLng: number
  widthM: number
  heightM: number
  rotation: number
  markdownDescription: string
  status: AreaStatus
  hashCode: string
  features: AreaFeature[]
  // V140: AreaMarker on strukturaalinen TaskMarkerSource — sama resolveTaskMarkers palvelee sitä.
  linkedMarkerIds?: string[]
  markerTypeFilter?: string
}

export function createAreaMarker(
  params: Omit<AreaMarker, 'features' | 'status'>
): AreaMarker {
  return {
    ...params,
    status: 'suunniteltu',
    features: [],
  }
}

export function addFeature(area: AreaMarker, feature: AreaFeature): AreaMarker {
  return { ...area, features: [...area.features, feature] }
}

export function removeFeature(area: AreaMarker, featureId: string): AreaMarker {
  return { ...area, features: area.features.filter(f => f.id !== featureId) }
}

export function setAreaStatus(area: AreaMarker, status: AreaStatus): AreaMarker {
  return { ...area, status }
}
