import L from 'leaflet'
import { createGpsFollow, type GpsFollow, type GpsState, type GpsStateListener } from '../logic/gps-follow'

// T405: `GpsState`/`GpsStateListener` asuvat nyt `src/logic/gps-follow.ts`:ssä (src/ui/ tarvitsee
// ne eikä saa importata src/map/:ia). Re-export ∴ olemassa olevat importit pysyvät voimassa.
export type { GpsState, GpsStateListener }

// T341/V247: GeolocationPositionError.code → syy jonka talkoolainen ymmärtää metsässä.
// Metsässä ei ole devtoolsia ∴ console.warn ei ole käyttäjäpalaute.
const ERROR_MSG: Record<number, string> = {
  1: 'Sijaintilupa evätty — salli paikannus selaimen asetuksista',
  2: 'Sijaintia ei saada — tarkista että paikannus on päällä',
  3: 'Sijainnin haku kesti liian kauan — yritä uudelleen aukeammalla paikalla',
}

const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
// T341/V247: puulatvat estävät korkean tarkkuuden fixin — matalampi tarkkuus + pidempi
// aikaikkuna on parempi kuin ei sijaintia lainkaan.
const LOW_ACCURACY: PositionOptions = { enableHighAccuracy: false, maximumAge: 0, timeout: 30000 }

// T406/V296.1: watchPosition EI kutsu error-callbackia kun laite lakkaa toimittamasta sijainteja
// (ruutu lukkoon, tunneli, Android-taustatappo). Ilman omaa vahtia nappi jäisi lukemaan
// "GPS päällä" kunnes käyttäjä huomaa ettei piste liiku — B133 toisessa muodossa.
const STALE_MS = 45_000

// T397/V287 (fix B166): oma pane sijaintipisteelle. Leafletin oletuspanet:
// tilePane 200, overlayPane 400 (reitit, pätkäviivat, aluepolygonit), shadowPane 500,
// markerPane 600 (merkki-ikonit), tooltipPane 650 (pätkälaput), popupPane 700.
// 675 = yli kaiken minkä päällä sijainnin on oltava, alle popupin.
// Ilman omaa panea piste on samassa SVG:ssä kuin pätkäviivat ∴ jokainen
// SegmentOverlay.update() hautaa sen piirtojärjestyksellä (B166).
const GPS_PANE = 'gps'
const GPS_PANE_Z = '675'

const GPS_COLOR = '#2F6FB0' // CSS-peili: --gps-active. Leaflet-vektori ei näe CSS-muuttujaa.

export class GpsNavigator {
  private map: L.Map
  private watchId: number | null = null
  private dot: L.CircleMarker | null = null
  // T406/V296: tarkkuus ei ole piilotietoa — 200 m fix ei saa näyttää samalta kuin 5 m fix.
  private halo: L.Circle | null = null
  private firstFix = true
  private state: GpsState = 'pois'
  private listener: GpsStateListener | null = null
  private retriedLowAccuracy = false

  // T406/V295: seurannan päätös on puhdasta logiikkaa — tämä luokka vain toteuttaa sen.
  private follow: GpsFollow = createGpsFollow(false)
  private followListener: ((following: boolean) => void) | null = null
  private lastFixAt = 0
  private staleTimer: ReturnType<typeof setTimeout> | null = null
  private wakeLock: WakeLockSentinel | null = null
  private wired = false

  // Kuuntelijat nimettyinä kenttinä: `map.off(ev, fn)` vaatii SAMAN funktioviitteen.
  // Anonyymi nuolifunktio jäisi kiinni ikuisiksi ajoiksi (B92-luokan tuplakuuntelija).
  private readonly onUserGesture = (): void => {
    if (this.follow.onUserGesture()) this.followListener?.(false)
  }
  private readonly onMoveEnd = (): void => this.follow.endMove()
  private readonly onVisibility = (): void => this.handleVisible()

  constructor(map: L.Map) {
    this.map = map
  }

  start(onState?: GpsStateListener): void {
    if (this.watchId !== null) return
    if (onState) this.listener = onState
    // Insecure context (http) tai tukematon selain: geolocation puuttuu kokonaan.
    if (!navigator.geolocation) { this.setState('pois', 'GPS vaatii HTTPS-yhteyden'); return }
    this.firstFix = true
    this.retriedLowAccuracy = false
    // V294: käynnistys tarkoittaa "vie minut kartalle ja pysy perässä".
    this.setFollow(true)
    this.wire()
    this.setState('haetaan')
    this.beginWatch(HIGH_ACCURACY)
  }

  stop(): void {
    this.clearWatch()
    this.clearStaleTimer()
    this.unwire()
    void this.releaseWakeLock()
    this.dot?.remove()
    this.dot = null
    this.halo?.remove()
    this.halo = null
    this.firstFix = true
    this.follow.set(false)
    this.followListener?.(false)
    // Käyttäjän oma komento → ei ilmoitusta, kutsuja päivittää napin.
    this.state = 'pois'
  }

  // T341: 'haetaan' on aktiivinen tila (watch käynnissä) ∴ toggle sammuttaa myös sen.
  isActive(): boolean {
    return this.state !== 'pois'
  }

  getState(): GpsState {
    return this.state
  }

  isFollowing(): boolean {
    return this.follow.get()
  }

  // T413/V304: viimeisin fix ULOS kutsujalle. `dot` on privaatti ∴ ilman tätä `src/ui/` ei saa
  // sijaintia ilman että Leaflet-instanssi vuotaa UI-kerrokseen (arkkitehtuuriraja). null =
  // ei vielä fixiä → kutsuja palautuu km-järjestykseen (V304 fallback), ⊥ arvaa nollakoordinaattia.
  getPosition(): { lat: number; lon: number } | null {
    const at = this.dot?.getLatLng()
    return at ? { lat: at.lat, lon: at.lng } : null
  }

  onFollowChange(cb: (following: boolean) => void): void {
    this.followListener = cb
  }

  // T406/V295: seurannan kytkentä. `recenter` = setFollow(true) → seuraava fix keskittää, ja
  // jos fix on jo olemassa keskitetään heti (odottaminen 5 s näyttäisi rikkinäiseltä napilta).
  setFollow(on: boolean): void {
    if (this.follow.get() === on) return
    this.follow.set(on)
    this.followListener?.(on)
    if (on) {
      void this.requestWakeLock()
      const at = this.dot?.getLatLng()
      if (at) this.panProgrammatically(at)
    } else {
      void this.releaseWakeLock()
    }
  }

  private wire(): void {
    if (this.wired) return
    this.wired = true
    // V295: TASAN käyttäjän eleet — `movestart` sisältäisi oman panTo:mme ∴ seuranta
    // purkaisi itsensä ensimmäisellä fixillä.
    this.map.on('dragstart', this.onUserGesture)
    this.map.on('wheel', this.onUserGesture)
    this.map.on('dblclick', this.onUserGesture)
    this.map.on('moveend', this.onMoveEnd)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private unwire(): void {
    if (!this.wired) return
    this.wired = false
    this.map.off('dragstart', this.onUserGesture)
    this.map.off('wheel', this.onUserGesture)
    this.map.off('dblclick', this.onUserGesture)
    this.map.off('moveend', this.onMoveEnd)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private beginWatch(opts: PositionOptions): void {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => this.onError(err),
      opts,
    )
    this.armStaleTimer()
  }

  private clearWatch(): void {
    if (this.watchId !== null) {
      // `?.` tarkoituksella: `stop()` on siivousreitti eikä se saa koskaan heittää. Selain voi
      // olla ilman geolocationia (insecure context) vaikka watch olisi joskus kirjattu.
      navigator.geolocation?.clearWatch(this.watchId)
      this.watchId = null
    }
  }

  private setState(state: GpsState, msg?: string): void {
    this.state = state
    this.listener?.(state, msg)
  }

  private armStaleTimer(): void {
    this.clearStaleTimer()
    this.staleTimer = setTimeout(() => this.onStale(), STALE_MS)
  }

  private clearStaleTimer(): void {
    if (this.staleTimer !== null) { clearTimeout(this.staleTimer); this.staleTimer = null }
  }

  // V296.1: watch jää PÄÄLLE — signaali voi palata itsestään. Vain tila ja teksti kertovat
  // ettei sijainti ole enää tuore.
  private onStale(): void {
    this.staleTimer = null
    if (this.watchId === null) return
    this.setState('haetaan', 'GPS-signaali hukassa — odota hetki tai siirry aukeammalle')
  }

  // V296.2: Android lopettaa taustawatchin toimittamisen ILMAN virhettä. Paluu etualalle on
  // ainoa hetki jolloin sen voi huomata — vanhentunut watch käynnistetään uudelleen.
  private handleVisible(): void {
    if (document.visibilityState !== 'visible') return
    void this.requestWakeLock()
    if (this.watchId === null) return
    if (Date.now() - this.lastFixAt <= STALE_MS) return
    this.clearWatch()
    this.setState('haetaan')
    this.beginWatch(this.retriedLowAccuracy ? LOW_ACCURACY : HIGH_ACCURACY)
  }

  // V296.3: ruutu sammuu → selain jäädyttää sivun → sijainnit lakkaavat. Wake lock VAIN
  // seurannassa: akku on talkoolaisen niukin resurssi. Puuttuva API ei ole virhe.
  private async requestWakeLock(): Promise<void> {
    if (!this.follow.get() || this.wakeLock) return
    try {
      this.wakeLock = await navigator.wakeLock?.request('screen') ?? null
      // Selain voi vapauttaa lukon itse (ruutu sammuu käyttäjän painalluksesta) — nollaa
      // viite, muuten uudelleenhankinta luulee lukkoa voimassa olevaksi.
      this.wakeLock?.addEventListener('release', () => { this.wakeLock = null })
    } catch { this.wakeLock = null }
  }

  private async releaseWakeLock(): Promise<void> {
    const lock = this.wakeLock
    this.wakeLock = null
    try { await lock?.release() } catch { /* jo vapautettu — ei käyttäjän ongelma */ }
  }

  private onError(err: GeolocationPositionError): void {
    // T341/V247: TIMEOUT metsässä = puulatvat, ei vika. Yksi yritys matalalla tarkkuudella
    // ennen luovuttamista — korkea tarkkuus ei saa lukita talkoolaista ulos.
    if (err.code === 3 && !this.retriedLowAccuracy) {
      this.retriedLowAccuracy = true
      this.clearWatch()
      this.beginWatch(LOW_ACCURACY)
      return
    }
    const msg = ERROR_MSG[err.code] ?? `Paikannus epäonnistui: ${err.message}`
    this.stop()
    this.setState('pois', msg)
  }

  // T397/V287: idempotentti — turvallinen kutsua joka fixillä ja stop()/start()-syklin yli.
  // Pane luodaan TÄÄLLÄ eikä map-init.ts:ssä: se on sijaintipisteen toteutusyksityiskohta,
  // ei kartan alustuksen tietoa.
  private ensurePane(): string {
    const pane = this.map.getPane(GPS_PANE) ?? this.map.createPane(GPS_PANE)
    pane.style.zIndex = GPS_PANE_Z
    return GPS_PANE
  }

  private panProgrammatically(to: L.LatLngExpression): void {
    // V295: lippu ylös ENNEN panTo:ta. `moveend` laskee sen ∴ seuraava ele on taas käyttäjän.
    this.follow.beginProgrammaticMove()
    this.map.panTo(to)
  }

  private onPosition(pos: GeolocationPosition): void {
    const { latitude, longitude, accuracy } = pos.coords
    this.lastFixAt = Date.now()
    this.armStaleTimer()
    if (!this.dot) {
      const pane = this.ensurePane()
      // V296: tarkkuushalo ENSIN → piste piirtyy sen päälle samassa panessa.
      this.halo = L.circle([latitude, longitude], {
        pane, radius: accuracy ?? 0, interactive: false,
        color: GPS_COLOR, weight: 1, opacity: 0.35, fillColor: GPS_COLOR, fillOpacity: 0.1,
        className: 'gps-accuracy',
      }).addTo(this.map)
      this.dot = L.circleMarker([latitude, longitude], {
        // Leaflet luo pane-kohtaisen SVG-rendererin itse (Map._getPaneRenderer) ∴
        // pelkkä pane-optio riittää, omaa L.svg()-instanssia ei tarvita.
        pane,
        radius: 8,
        fillColor: '#3b82f6',
        color: '#1d4ed8',
        weight: 2,
        fillOpacity: 0.9,
        opacity: 1,
        className: 'gps-dot',
      }).addTo(this.map)
    } else {
      this.dot.setLatLng([latitude, longitude])
      this.halo?.setLatLng([latitude, longitude])
      if (accuracy != null) this.halo?.setRadius(accuracy)
    }
    // T406/V295: ensimmäinen fix keskittää AINA (käyttäjä pyysi sijaintinsa); sen jälkeen
    // vain jos seuranta on päällä.
    if (this.firstFix || this.follow.get()) this.panProgrammatically([latitude, longitude])
    if (this.firstFix) {
      this.firstFix = false
      void this.requestWakeLock()
    }
    // T341/V247: "päällä" VASTA kun sijainti on kartalla — sitä ennen "Haetaan…".
    // V296.1: sama polku palauttaa tilan stale-pudotuksen jälkeen ilman erillistä haaraa.
    if (this.state !== 'päällä') this.setState('päällä')
  }
}
