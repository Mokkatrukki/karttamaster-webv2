export type MarkerType = 'right' | 'left' | 'upcoming-right' | 'upcoming-left'

export type MarkerStatus = 'suunniteltu' | 'asetettu' | 'tarkistettu' | 'kerätty' | 'ei_tarpeen'

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
  status: MarkerStatus    // lifecycle: suunniteltu → asetettu → tarkistettu → kerätty | ei_tarpeen
  locationNote?: string   // vapaa teksti: mihin tarkasti kiinnitetään
  pendingSync?: boolean   // V19: offline change not yet pushed to server
}
