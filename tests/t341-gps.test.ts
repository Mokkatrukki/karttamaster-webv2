// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { wireGpsButton, gpsButtonLabel } from '../src/app/markers-wiring'
import { GpsNavigator, type GpsState, type GpsStateListener } from '../src/map/gps-navigator'
import { fakeMap, stubGeolocation } from './helpers/gps-map-mock'

// T341/V247 (fix B133) — Taso 2 (Vitest-jsdom): talkoolaisen GPS-kytkentä ei riipu pätkästä
// eikä paikannusvirhe saa olla hiljainen.

// GpsNavigator-tuplaus. T407: `wireGpsButton` ohjaa nyt myös seurantaa (setFollow/isFollowing/
// onFollowChange) ∴ tupla kattaa ne — Pick<> pitää tämän listan totuudessa käännösaikana.
type GpsPick = Pick<GpsNavigator, 'start' | 'stop' | 'getState' | 'setFollow' | 'isFollowing' | 'onFollowChange'>

function fakeNavigator(): {
  gps: GpsPick
  emit: (s: GpsState, msg?: string) => void
  startCalls: number
  stopCalls: number
} {
  let state: GpsState = 'pois'
  let following = false
  let listener: GpsStateListener | null = null
  let followListener: ((f: boolean) => void) | null = null
  const api = {
    gps: {
      start(onState?: GpsStateListener) {
        api.startCalls++
        if (onState) listener = onState
        state = 'haetaan'; following = true
        listener?.('haetaan')
      },
      stop() { api.stopCalls++; state = 'pois'; following = false },
      getState: () => state,
      setFollow: (on: boolean) => { following = on; followListener?.(on) },
      isFollowing: () => following,
      onFollowChange: (cb: (f: boolean) => void) => { followListener = cb },
    } as GpsPick,
    emit(s: GpsState, msg?: string) { state = s; listener?.(s, msg) },
    startCalls: 0,
    stopCalls: 0,
  }
  return api
}

// Talkoolaisen ⋯-valikon GPS-nappi ILMAN pätkänäkymää — täsmälleen B133:n tilanne.
// T407: `#map-area` mukana — `wireGpsButton` telakoi `#gps-control`in sinne. Puuttuva säiliö
// ei kaada kytkentää (optional chain), mutta silloin testi ei mittaisi kartan kontrollia.
function domWithoutSegment(): void {
  document.body.innerHTML = '<div id="map-area"></div><button id="btn-tk-gps">📍 GPS</button>'
}

beforeEach(domWithoutSegment)
// T406: käynnistetty GpsNavigator kuuntelee `document`ia (`visibilitychange`) kunnes `stop()`.
// `isolate: false` ⇒ jsdom-ympäristö on JAETTU tiedostojen kesken ∴ pysäyttämätön navigaattori
// jatkaa naapuritiedoston testeissä ja kutsuu SEN geolocation-stubia (havaittu: "clear kutsuttiin
// 2 kertaa" t406:ssa). Tuotannossa tämän hoitaa stop(); testissä hoitaa tämä.
const live: GpsNavigator[] = []
function liveNavigator(map: unknown): GpsNavigator {
  const nav = new GpsNavigator(map as never)
  live.push(nav)
  return nav
}

afterEach(() => {
  live.splice(0).forEach(n => n.stop())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('T341/V247 — GPS kytkeytyy ilman pätkää (B133-regressio)', () => {
  it('klikkaus käynnistää paikannuksen vaikka pätkänäkymää ei ole', () => {
    const nav = fakeNavigator()
    wireGpsButton(nav.gps, vi.fn())
    document.getElementById('btn-tk-gps')!.click()
    expect(nav.startCalls).toBe(1)
  })

  it('toinen klikkaus sammuttaa ja palauttaa labelin', () => {
    const nav = fakeNavigator()
    wireGpsButton(nav.gps, vi.fn())
    const btn = document.getElementById('btn-tk-gps')!
    btn.click()
    btn.click()
    expect(nav.stopCalls).toBe(1)
    expect(btn.textContent).toBe('📍 GPS')
    expect(btn.classList.contains('gps-active')).toBe(false)
  })
})

describe('T341/V247 — napin tila kertoo totuuden', () => {
  it('"Haetaan…" ennen ensimmäistä fixiä, "GPS päällä" vasta fixistä', () => {
    const nav = fakeNavigator()
    wireGpsButton(nav.gps, vi.fn())
    const btn = document.getElementById('btn-tk-gps')!
    btn.click()
    expect(btn.textContent).toBe('📍 Haetaan…')
    nav.emit('päällä')
    expect(btn.textContent).toBe('📍 GPS päällä')
  })

  it('hero-nappi ja ⋯-nappi saavat saman labelin (ei kahta totuutta)', () => {
    document.body.innerHTML = '<button id="btn-tk-gps"></button><button class="segment-view-gps-btn"></button>'
    const nav = fakeNavigator()
    wireGpsButton(nav.gps, vi.fn())
    document.getElementById('btn-tk-gps')!.click()
    nav.emit('päällä')
    const labels = [...document.querySelectorAll('#btn-tk-gps, .segment-view-gps-btn')].map(b => b.textContent)
    expect(labels).toEqual(['📍 GPS päällä', '📍 GPS päällä'])
  })

  it('gpsButtonLabel kattaa kaikki tilat', () => {
    expect(gpsButtonLabel('pois')).toBe('📍 GPS')
    expect(gpsButtonLabel('haetaan')).toBe('📍 Haetaan…')
    expect(gpsButtonLabel('päällä')).toBe('📍 GPS päällä')
  })
})

describe('T341/V247 — virhe ei saa olla hiljainen', () => {
  it('virheviesti näytetään varoituksena ja label palaa pois-tilaan', () => {
    const nav = fakeNavigator()
    const showWarning = vi.fn()
    wireGpsButton(nav.gps, showWarning)
    const btn = document.getElementById('btn-tk-gps')!
    btn.click()
    nav.emit('pois', 'Sijaintilupa evätty — salli paikannus selaimen asetuksista')
    expect(showWarning).toHaveBeenCalledWith(
      '⚠ Sijaintilupa evätty — salli paikannus selaimen asetuksista', 5000,
    )
    expect(btn.textContent).toBe('📍 GPS')
  })
})

// T406: geolocation- ja karttatuplaus jaetusta helperistä — ⊥ oma kopio (t397/t406 lukevat
// samaa sopimusta; kolme kopiota ajautuu erilleen heti kun navigaattori kutsuu uutta API:a).
const geoError = (code: number): GeolocationPositionError =>
  ({ code, message: 'x', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError

afterEach(() => vi.unstubAllGlobals())

describe('T341/V247 — GpsNavigator virhepolut', () => {
  it('lupa evätty (code 1) → tila pois + syy käyttäjälle', () => {
    const g = stubGeolocation()
    const states: [GpsState, string | undefined][] = []
    const nav = liveNavigator(fakeMap())
    nav.start((s, msg) => states.push([s, msg]))
    g.calls[0].error!(geoError(1))
    expect(nav.getState()).toBe('pois')
    expect(states.at(-1)).toEqual(['pois', 'Sijaintilupa evätty — salli paikannus selaimen asetuksista'])
  })

  it('timeout (code 3) → yksi uusintayritys matalalla tarkkuudella ennen luovutusta', () => {
    const g = stubGeolocation()
    const nav = liveNavigator(fakeMap())
    nav.start()
    expect(g.calls[0].opts?.enableHighAccuracy).toBe(true)
    g.calls[0].error!(geoError(3))
    expect(g.watch).toHaveBeenCalledTimes(2)
    expect(g.calls[1].opts?.enableHighAccuracy).toBe(false)
    expect(g.calls[1].opts?.timeout).toBe(30000)
    expect(nav.getState()).toBe('haetaan')
    // toinen timeout → luovutus näkyvällä syyllä
    g.calls[1].error!(geoError(3))
    expect(nav.getState()).toBe('pois')
    expect(g.watch).toHaveBeenCalledTimes(2)
  })

  it('geolocation puuttuu (insecure context) → näkyvä syy, ei hiljainen no-op', () => {
    vi.stubGlobal('navigator', {})
    const states: [GpsState, string | undefined][] = []
    const nav = liveNavigator(fakeMap())
    nav.start((s, msg) => states.push([s, msg]))
    expect(states).toEqual([['pois', 'GPS vaatii HTTPS-yhteyden']])
  })

  it('tila on "haetaan" kunnes ensimmäinen sijainti saapuu', () => {
    const g = stubGeolocation()
    const map = fakeMap()
    const nav = liveNavigator(map)
    nav.start()
    expect(nav.getState()).toBe('haetaan')
    expect(nav.isActive()).toBe(true)
    g.calls[0].success!({ coords: { latitude: 65.6, longitude: 27.9 } } as GeolocationPosition)
    expect(nav.getState()).toBe('päällä')
    expect(map.panTo).toHaveBeenCalledWith([65.6, 27.9])
  })
})
