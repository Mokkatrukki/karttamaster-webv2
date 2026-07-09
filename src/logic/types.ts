import type { SignPart } from './sign-library'

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
  distanceFromStart: number // meters — nearest route at placement time
  routeIds: string[]      // routes this marker belongs to
  status: MarkerStatus    // lifecycle: suunniteltu → asetettu → tarkistettu → kerätty | ei_tarpeen
  locationNote?: string   // vapaa teksti: mihin tarkasti kiinnitetään
  color?: string          // custom template color (ei default-4 tyypeille)
  label?: string          // V99/T160: denormalisoitu template-label; kompakti kartta-teksti = compactLabel(label)
  iconId?: string         // V106: denormalisoitu template.iconId — kartan ikoni-tier (V99) toimii itsenäisesti
  imageId?: string        // T196/V131: denormalisoitu template.imageId (bundle-avain TAI backend-URL) — kartan kuva-tier toimii itsenäisesti kun template on ladattu oma kuva
  templateId?: string     // T215/V143: denormalisoitu template.id — dynaamisen markerTypeFilter-osuman (V140) vakaa viite (persistointi T215)
  parts?: SignPart[]      // V107: denormalisoitu template.parts — yhdistelmämerkin pystypino
  description?: string    // T103: lisäkuvaus, järjestäjä muokkaa
  images?: string[]       // T103: kuva-URL:t (server/routes/markers.ts POST :id/images)
}
