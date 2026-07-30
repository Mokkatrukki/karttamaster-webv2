// T341/V247: paikannuksen tila UI:lle. 'haetaan' = watch käynnissä mutta EI vielä fixiä.
// T405: tyyppi siirtyi `map/gps-navigator.ts`:stä TÄNNE — `gps-control.ts` (src/ui/) tarvitsee
// sen eikä src/ui/ saa importata src/map/:ia. `gps-navigator.ts` re-exportaa ∴ vanhat importit
// pysyvät voimassa.
export type GpsState = 'haetaan' | 'päällä' | 'pois'
export type GpsStateListener = (state: GpsState, msg?: string) => void

// T405/V294/V295: seurantatilan PÄÄTÖS. `gps-navigator.ts` on Leaflet-liimaa (pane, circleMarker,
// panTo) — se ei ole paikka jossa päätetään milloin seuranta purkautuu. Tämä tiedosto on puhdas
// ∴ V295:n kiperä osa (ohjelmallinen pan ≠ käyttäjän ele) on testattavissa ilman karttaa.

// T405/V294: neljä UI-tilaa. `GpsState` (paikannus) × seuranta → yksi enum jonka sekä kartan
// `#gps-control` että ⋯-valikon `#btn-tk-gps` lukevat. Kaksi käännöstä = kaksi totuutta (B133).
export type GpsControlState = 'pois' | 'haetaan' | 'seuraa' | 'vapaa'

// T407/V294: napautuksen merkitys riippuu tilasta — kutsuja ei saa päätellä sitä uudelleen.
export type GpsTapAction = 'start' | 'stop' | 'recenter'

export interface GpsFollow {
  get(): boolean
  set(on: boolean): void
  // Käyttäjän ele kartalla (dragstart/wheel/dblclick). Palauttaa true jos seuranta purkautui.
  onUserGesture(): boolean
  beginProgrammaticMove(): void
  endMove(): void
  isProgrammatic(): boolean
}

export function createGpsFollow(initial = false): GpsFollow {
  let following = initial
  // V295: Leaflet ei erottele `map.panTo()`-liikettä sormen vedosta — molemmat tuottavat
  // movestart/moveend. Ilman tätä lippua follow-tilan ensimmäinen fix panoroisi kartan, kartta
  // raportoisi liikkeen ja seuranta purkaisi itsensä → "GPS sammuu itsestään".
  let programmatic = false
  return {
    get: () => following,
    set: (on) => { following = on },
    onUserGesture: () => {
      if (programmatic || !following) return false
      following = false
      return true
    },
    beginProgrammaticMove: () => { programmatic = true },
    // moveend nollaa lipun ∴ SEURAAVA ele on taas käyttäjän. Jos nollaus jäisi tekemättä,
    // seuranta ei purkautuisi enää koskaan (peilikuvavika).
    endMove: () => { programmatic = false },
    isProgrammatic: () => programmatic,
  }
}

// V294: paikannus voittaa seurannan. `pois` + following=true ei ole 'seuraa' — nappi ei saa
// väittää seuraavansa sijaintia jota ei ole (sama sääntö kuin V247: label ei ennakoi fixiä).
export function gpsControlState(gps: GpsState, following: boolean): GpsControlState {
  if (gps === 'pois') return 'pois'
  if (gps === 'haetaan') return 'haetaan'
  return following ? 'seuraa' : 'vapaa'
}

// V294: jokainen tila erottuu SANOIN — aurinko pesee värit, hanskat estävät tarkan katseen.
const CONTROL_LABEL: Record<GpsControlState, string> = {
  pois: '📍 GPS',
  haetaan: '📍 Haetaan…',
  seuraa: '🧭 Seuraa',
  vapaa: '📍 Keskitä',
}

export function gpsControlLabel(state: GpsControlState): string {
  return CONTROL_LABEL[state]
}

// V294: napautuskierto pois→seuraa→(panorointi)→vapaa→seuraa; `seuraa`-napautus sammuttaa,
// `haetaan`-napautus peruu. Yksi lookup ∴ nappi ja valikko eivät voi tulkita eri tavoin.
const TAP_ACTION: Record<GpsControlState, GpsTapAction> = {
  pois: 'start',
  haetaan: 'stop',
  seuraa: 'stop',
  vapaa: 'recenter',
}

export function gpsTapAction(state: GpsControlState): GpsTapAction {
  return TAP_ACTION[state]
}
