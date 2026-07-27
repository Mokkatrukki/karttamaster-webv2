// V248/T342 — YKSI jaettu leaflet-mock.
//
// Miksi: `isolate: false` ⇒ moduulirekisteri on jaettu tiedostojen kesken. Ennen tätä kuusi eri
// `vi.mock('leaflet', …)`-tehdasta kilpaili samasta avaimesta & ensimmäinen ajettu voitti — esim.
// t309:n mock (vain `marker`) söi t158/t140/t138/sign-icon-statuksen `divIcon`:n ∴ `createSignIcon`
// palautti undefinedin. Yksi mock ⇒ ajojärjestys ⊥ merkitse.
//
// `installLeafletMock()` ! kutsua beforeEachissä jokaisessa mockia käyttävässä tiedostossa: osa
// testeistä kutsuu `vi.resetAllMocks()` joka pyyhkii `vi.fn`-implementaatiot jaetusta oliosta.
// Uudelleenasennus per testi on halpa & tekee tiedostosta riippumattoman naapureistaan.

import { vi } from 'vitest'

export type MarkerFactory = (ll: [number, number], opts?: unknown) => unknown

// Jaettu `L`-olio: identiteetti pysyy (mock-tehdas palauttaa aina tämän), jäsenet uusitaan.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const L: Record<string, any> = {}

let markerFactory: MarkerFactory | null = null

/** t309-tyyppinen testi antaa oman marker-toteutuksensa. Kutsu `installLeafletMock()`:n JÄLKEEN. */
export function setMarkerFactory(f: MarkerFactory | null): void {
  markerFactory = f
}

function defaultMarker() {
  return {
    on: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    setIcon: vi.fn(),
    setLatLng: vi.fn().mockReturnThis(),
    getLatLng: vi.fn().mockReturnValue({ lat: 0, lng: 0 }),
    getElement: vi.fn(() => null),
    dragging: { enable: vi.fn(), disable: vi.fn() },
  }
}

function defaultShape() {
  return {
    on: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn(),
    getTooltip: vi.fn(() => ({ getElement: () => null })),
    setStyle: vi.fn(),
    remove: vi.fn(),
  }
}

/** Asenna tuore mock-pinta. Nollaa myös marker-tehtaan ∴ edellisen tiedoston valinta ⊥ vuoda. */
export function installLeafletMock(): void {
  markerFactory = null
  L.divIcon = vi.fn((opts: unknown) => opts)
  L.marker = vi.fn((ll: [number, number], opts?: unknown) =>
    markerFactory ? markerFactory(ll, opts) : defaultMarker(),
  )
  L.polygon = vi.fn(() => defaultShape())
  L.polyline = vi.fn(() => defaultShape())
  L.DomEvent = { stopPropagation: vi.fn() }
}

installLeafletMock()
