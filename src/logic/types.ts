export type MarkerType = 'right' | 'left' | 'upcoming-right' | 'upcoming-left'

export interface RoutePoint {
  lat: number
  lon: number
  distanceFromStart: number // meters
}

export interface SignMarker {
  id: string
  type: MarkerType
  lat: number
  lon: number
  bearing: number         // degrees, direction of travel at this point
  distanceFromStart: number // meters — nearest route at placement time
  routeIds: string[]      // routes this marker belongs to
}
