import L from 'leaflet'

// T341/V247: paikannuksen tila UI:lle. 'haetaan' = watch käynnissä mutta EI vielä fixiä —
// nappi ei saa väittää "GPS päällä" ennen kuin sijainti on oikeasti kartalla (B133: label
// valehteli päällä-tilaa vaikka yhtään sijaintia ei koskaan saatu).
export type GpsState = 'haetaan' | 'päällä' | 'pois'
export type GpsStateListener = (state: GpsState, msg?: string) => void

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

// T397/V287 (fix B166): oma pane sijaintipisteelle. Leafletin oletuspanet:
// tilePane 200, overlayPane 400 (reitit, pätkäviivat, aluepolygonit), shadowPane 500,
// markerPane 600 (merkki-ikonit), tooltipPane 650 (pätkälaput), popupPane 700.
// 675 = yli kaiken minkä päällä sijainnin on oltava, alle popupin.
// Ilman omaa panea piste on samassa SVG:ssä kuin pätkäviivat ∴ jokainen
// SegmentOverlay.update() hautaa sen piirtojärjestyksellä (B166).
const GPS_PANE = 'gps'
const GPS_PANE_Z = '675'

export class GpsNavigator {
  private map: L.Map
  private watchId: number | null = null
  private dot: L.CircleMarker | null = null
  private firstFix = true
  private state: GpsState = 'pois'
  private listener: GpsStateListener | null = null
  private retriedLowAccuracy = false

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
    this.setState('haetaan')
    this.beginWatch(HIGH_ACCURACY)
  }

  stop(): void {
    this.clearWatch()
    this.dot?.remove()
    this.dot = null
    this.firstFix = true
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

  private beginWatch(opts: PositionOptions): void {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => this.onError(err),
      opts,
    )
  }

  private clearWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
  }

  private setState(state: GpsState, msg?: string): void {
    this.state = state
    this.listener?.(state, msg)
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

  private onPosition(pos: GeolocationPosition): void {
    const { latitude, longitude } = pos.coords
    if (!this.dot) {
      this.dot = L.circleMarker([latitude, longitude], {
        // Leaflet luo pane-kohtaisen SVG-rendererin itse (Map._getPaneRenderer) ∴
        // pelkkä pane-optio riittää, omaa L.svg()-instanssia ei tarvita.
        pane: this.ensurePane(),
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
    }
    if (this.firstFix) {
      this.map.panTo([latitude, longitude])
      this.firstFix = false
      // T341/V247: "päällä" VASTA kun sijainti on kartalla — sitä ennen "Haetaan…".
      this.setState('päällä')
    }
  }
}
