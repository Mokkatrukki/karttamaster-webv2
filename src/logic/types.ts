export type MarkerType = string

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
  color?: string          // custom template color (ei default-4 tyypeille)
  shortLabel?: string     // custom template lyhenne
  bearingManual?: boolean // true jos käyttäjä on manuaalisesti kääntänyt merkkiä — dragend ei ylikirjoita
  description?: string    // T103: lisäkuvaus, järjestäjä muokkaa
  images?: string[]       // T103: kuva-URL:t (server/routes/markers.ts POST :id/images)
}
