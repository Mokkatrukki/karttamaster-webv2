// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { GpsNavigator } from '../src/map/gps-navigator'
import { fakeMap, stubGeolocation } from './helpers/gps-map-mock'

// T406/V295/V296 — Taso 2 (Vitest-jsdom): seuranta, tarkkuus ja elossapito.
// Nämä ovat kaikki "hiljaisen kuoleman" polkuja: ne eivät heitä virhettä, ne vain lakkaavat
// toimimasta. ∴ jokainen niistä ! olla mitattu, ei silmämääräisesti todettu.

// jsdomin `document` on JAETTU tiedoston testien kesken ∴ käynnistetty-mutta-pysäyttämätön
// navigaattori jää kuuntelemaan `visibilitychange`iä seuraavissakin testeissä. Tuotannossa
// `stop()` hoitaa sen; testissä hoitaa tämä. (Ilman: "clear kutsuttiin 7 kertaa".)
const live: GpsNavigator[] = []
function newNav(map: ReturnType<typeof fakeMap>): GpsNavigator {
  const nav = new GpsNavigator(map as never)
  live.push(nav)
  return nav
}

afterEach(() => {
  live.splice(0).forEach(n => n.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('T406/V295 — seuranta panoroi, käyttäjän ele purkaa', () => {
  it('seuranta päällä → JOKAINEN fix keskittää kartan', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    map.fire('moveend')
    geo.fire(65.7, 27.9)
    expect(map.panTo).toHaveBeenCalledTimes(2)
    expect(nav.isFollowing()).toBe(true)
  })

  it('ohjelmallinen pan EI pura seurantaa — muuten GPS sammuisi itsestään 1. fixillä', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    // Leaflet lähettää oman panTo:mme liikkeenä; dragstart tulisi vain sormesta, mutta
    // varmistetaan ettei lippu ole väärinpäin: moveend ennen elettä.
    expect(nav.isFollowing()).toBe(true)
    map.fire('moveend')
    expect(nav.isFollowing()).toBe(true)
  })

  it('käyttäjän dragstart purkaa seurannan mutta EI sammuta paikannusta', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    map.fire('moveend')
    map.fire('dragstart')
    expect(nav.isFollowing()).toBe(false)
    expect(nav.getState()).toBe('päällä')
    const before = map.panTo.mock.calls.length
    geo.fire(65.8, 27.9)
    expect(map.panTo.mock.calls.length).toBe(before) // ei enää seuraa
  })

  it('purku ilmoitetaan kutsujalle (nappi ! vaihtua "Keskitä"-tilaan)', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    const seen: boolean[] = []
    nav.onFollowChange(f => seen.push(f))
    nav.start()
    geo.fire(65.6, 27.9)
    map.fire('moveend')
    map.fire('dragstart')
    expect(seen.at(-1)).toBe(false)
  })

  it('setFollow(true) purun jälkeen keskittää HETI olemassa olevaan fixiin', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    map.fire('moveend')
    map.fire('dragstart')
    const before = map.panTo.mock.calls.length
    nav.setFollow(true)
    expect(map.panTo.mock.calls.length).toBe(before + 1)
    expect(nav.isFollowing()).toBe(true)
  })
})

describe('T406/V296 — GPS ei kuole hiljaa', () => {
  it('45 s ilman fixiä → tila "haetaan" + syy, watch jää PÄÄLLE', () => {
    vi.useFakeTimers()
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    const states: [string, string | undefined][] = []
    nav.start((s, msg) => states.push([s, msg]))
    geo.fire(65.6, 27.9)
    expect(nav.getState()).toBe('päällä')
    vi.advanceTimersByTime(45_000)
    expect(nav.getState()).toBe('haetaan')
    expect(states.at(-1)?.[1]).toMatch(/hukassa/)
    expect(geo.clear).not.toHaveBeenCalled()
  })

  it('fix ennen määräaikaa nollaa vahdin — tuore signaali ei putoa "haetaan"-tilaan', () => {
    vi.useFakeTimers()
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    vi.advanceTimersByTime(40_000)
    geo.fire(65.6, 27.91)
    vi.advanceTimersByTime(40_000)
    expect(nav.getState()).toBe('päällä')
  })

  it('paluu etualalle vanhentuneena → watch käynnistetään uudelleen', () => {
    vi.useFakeTimers()
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    expect(geo.watch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(46_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(geo.clear).toHaveBeenCalledTimes(1)
    expect(geo.watch).toHaveBeenCalledTimes(2)
    expect(nav.getState()).toBe('haetaan')
  })

  it('paluu etualalle TUOREENA ei käynnistä watchia turhaan uudelleen', () => {
    vi.useFakeTimers()
    const map = fakeMap(); const geo = stubGeolocation()
    newNav(map).start()
    geo.fire(65.6, 27.9)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(geo.watch).toHaveBeenCalledTimes(1)
  })

  it('tarkkuus piirtyy halona ja seuraa fixiä', async () => {
    const L = (await import('leaflet')).default
    const circle = vi.spyOn(L, 'circle')
    const map = fakeMap(); const geo = stubGeolocation()
    newNav(map).start()
    geo.fire(65.6, 27.9, 120)
    expect(circle).toHaveBeenCalledTimes(1)
    expect((circle.mock.calls[0][1] as { radius: number }).radius).toBe(120)
    expect((circle.mock.calls[0][1] as { pane: string }).pane).toBe('gps')
    expect((circle.mock.calls[0][1] as { interactive: boolean }).interactive).toBe(false)
    circle.mockRestore()
  })
})

describe('T406 — stop() siivoaa jälkensä', () => {
  it('kaikki karttakuuntelijat irrotetaan (B92-luokan vuoto)', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    expect(map.listenerCount()).toBeGreaterThan(0)
    nav.stop()
    expect(map.listenerCount()).toBe(0)
  })

  it('start→stop→start ei kerrytä kuuntelijoita', () => {
    const map = fakeMap(); stubGeolocation()
    const nav = newNav(map)
    nav.start()
    const n = map.listenerCount()
    nav.stop(); nav.start()
    expect(map.listenerCount()).toBe(n)
  })

  it('stale-ajastin ei laukea stop()in jälkeen', () => {
    vi.useFakeTimers()
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    const states: string[] = []
    nav.start(s => states.push(s))
    geo.fire(65.6, 27.9)
    nav.stop()
    vi.advanceTimersByTime(60_000)
    expect(nav.getState()).toBe('pois')
    expect(states).not.toContain('haetaan_after_stop')
    expect(states.filter(s => s === 'haetaan').length).toBe(1) // vain käynnistyksen "haetaan"
  })

  it('puuttuva wakeLock-API ei kaada mitään (⊥ kaikissa selaimissa)', () => {
    const map = fakeMap(); const geo = stubGeolocation()
    const nav = newNav(map)
    expect(() => { nav.start(); geo.fire(65.6, 27.9); nav.stop() }).not.toThrow()
  })

  it('wakeLock pyydetään seurannassa ja vapautetaan stopissa', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() })
    const geo = stubGeolocation()
    // stubGeolocation asettaa navigatorin ∴ täydennä se wakeLockilla samalla stubilla.
    vi.stubGlobal('navigator', { geolocation: navigator.geolocation, wakeLock: { request } })
    const map = fakeMap()
    const nav = newNav(map)
    nav.start()
    geo.fire(65.6, 27.9)
    await Promise.resolve()
    expect(request).toHaveBeenCalledWith('screen')
    nav.stop()
    await Promise.resolve()
    expect(release).toHaveBeenCalled()
  })
})
