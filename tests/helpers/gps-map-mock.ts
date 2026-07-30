import { vi } from 'vitest'

// T406 — YKSI jaettu karttatuplaus GpsNavigator-testeille (t341, t397, t406).
//
// Miksi jaettu: jokainen GpsNavigatorin uusi kartta-API-kutsu (`on`/`off`/`panTo`) rikkoi
// aiemmin jokaisen testitiedoston oman `fakeMap`in erikseen. Kolme kopiota ajautuu erilleen
// juuri silloin kun niiden pitäisi kertoa sama asia navigaattorin sopimuksesta.
//
// Tämä EI ole leaflet-mock (`helpers/leaflet-mock.ts` tuplaa `L`-nimiavaruuden). Tämä tuplaa
// KARTTAINSTANSSIN — sen jonka `new GpsNavigator(map)` saa.

export interface FakeMap {
  panes: Record<string, HTMLElement>
  createPaneCalls: string[]
  getPane: (n: string) => HTMLElement | undefined
  createPane: (n: string) => HTMLElement
  panTo: ReturnType<typeof vi.fn>
  addLayer: ReturnType<typeof vi.fn>
  removeLayer: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  /** Laukaisee kartan tapahtuman kaikille sille rekisteröidyille kuuntelijoille. */
  fire: (event: string) => void
  /** Kuinka monta kuuntelijaa on yhä kiinni — `stop()`in jälkeen ! olla 0 (B92-luokka). */
  listenerCount: () => number
}

export function fakeMap(): FakeMap {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {}
  const m: FakeMap = {
    panes: {},
    createPaneCalls: [],
    getPane: (n) => m.panes[n],
    createPane: (n) => {
      m.createPaneCalls.push(n)
      const el = document.createElement('div')
      m.panes[n] = el
      return el
    },
    panTo: vi.fn(),
    // Leafletin CircleMarker/Circle `.addTo(map)` kutsuu tätä — riittää tuplaukseksi.
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    on: vi.fn((ev: string, fn: (...a: unknown[]) => void) => {
      (handlers[ev] ??= []).push(fn)
      return m
    }),
    // `off` poistaa TASAN annetun viitteen — sama sopimus kuin Leafletilla ∴ anonyymillä
    // nuolifunktiolla rekisteröity kuuntelija paljastuu tässä eikä tuotannossa.
    off: vi.fn((ev: string, fn: (...a: unknown[]) => void) => {
      handlers[ev] = (handlers[ev] ?? []).filter(h => h !== fn)
      return m
    }),
    fire: (ev) => (handlers[ev] ?? []).slice().forEach(h => h()),
    listenerCount: () => Object.values(handlers).reduce((n, hs) => n + hs.length, 0),
  }
  return m
}

/** Ohjattava geolocation: talteen otetut callbackit laukaistaan käsin. */
export interface FakeGeo {
  watch: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  calls: { success: PositionCallback; error?: PositionErrorCallback; opts?: PositionOptions }[]
  /** Laukaisee sijainnin VIIMEISIMMÄLLE watchille (uudelleenkäynnistys vaihtaa callbackin). */
  fire: (lat: number, lon: number, accuracy?: number) => void
  fireError: (code: number) => void
}

export function stubGeolocation(): FakeGeo {
  const calls: FakeGeo['calls'] = []
  const watch = vi.fn((success: PositionCallback, error?: PositionErrorCallback, opts?: PositionOptions) => {
    calls.push({ success, error, opts })
    return calls.length
  })
  const clear = vi.fn()
  vi.stubGlobal('navigator', { geolocation: { watchPosition: watch, clearWatch: clear } })
  return {
    watch, clear, calls,
    fire: (lat, lon, accuracy) =>
      calls.at(-1)?.success({ coords: { latitude: lat, longitude: lon, accuracy } } as GeolocationPosition),
    fireError: (code) => calls.at(-1)?.error?.(
      { code, message: 'x', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError,
    ),
  }
}
