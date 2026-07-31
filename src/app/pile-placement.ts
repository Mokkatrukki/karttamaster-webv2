// T452/V335,V336: KASAN SIJOITUSTILAAN SIIRTYMINEN — atominen teko, ⊥ toive ympäristöstä.
//
// B182: sijoitustila armattiin katsomatta näkymämoodia. Kotimoodissa `#map` on `display:none`
// (`style.css` `#app[data-view-mode="koti"]`) ∴ sovellus pyysi napauttamaan pintaa jota ⊥ ollut
// renderöity: ⊥ virhettä, ⊥ vihjettä, ⊥ ulospääsyä. Kaksi eri "moodia" — piirtolupa (`mapMode`)
// & näkymä (`data-view-mode`) — ovat ERI asia; toinen asetettiin, toinen jäi.
//
// Siksi tämä on OMA moduulinsa ⊥ rivi wiringin sisällä: moodinvaihto + ohjerivi + palautus ovat
// yksi jakamaton teko & wiringin sisällä ne olisivat kolme riviä joista yksi voi jäädä pois.
// Palautus ripustetaan `disarm`iin ∴ se kattaa KAIKKI poistumistiet (Peruuta, Esc, sijoitus,
// moodinvaihto) yhdellä kytkennällä — se tie joka jää kytkemättä on se jolla käyttäjä jää jumiin.
//
// DOM ilman Leafletia (kartta tulee `onEnterKartta`-callbackina) → Vitest-jsdom.

import { showPilePlaceHint, removePilePlaceHint } from '../ui/pile-drop'
import { showToast } from '../ui/toast'
import { getViewMode, setViewMode } from './talkoolainen-mode'

/**
 * T453/V337: käyttäjän laukaisema toiminto ! päättyä NÄKYVÄÄN lopputulokseen. Metsässä ⊥ ole
 * konsolia ∴ käsittelijän sisällä kuollut poikkeus on nappi joka "⊥ tee mitään" — käyttäjä
 * painaa uudelleen & soittaa lopulta järjestäjälle. Poikkeus kääntyy viestiksi, ⊥ hiljaisuudeksi.
 */
export function runPileAction(fn: () => void, toast: (msg: string) => void = showToast): void {
  try {
    fn()
  } catch (err) {
    toast(`⚠️ Kasan jättö ei käynnistynyt: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export interface PilePlacementDeps {
  /** Ohjerivin koti. V336: ! olla `pointer-events:auto`-kerroksessa (`#segment-view`). */
  host: HTMLElement
  /** `PlaceMode.armPlacer` — kartan seuraava napautus kutsuu `fn`:ää. */
  armPlacer(fn: (lat: number, lon: number) => void, onDisarm: () => void): void
  /** `PlaceMode.disarm` — peruutus. */
  disarm(): void
  /** Sijainti valittu kartalta. */
  onPlace(lat: number, lon: number): void
  /** Leaflet `invalidateSize` kun kartta paljastuu (V176). */
  onEnterKartta?(): void
}

/**
 * Siirtää käyttäjän kasan sijoitustilaan: kartta näkyviin, ohjerivi heroon, viritys päälle.
 * Palauttaa edellisen näkymämoodin kun tila purkautuu millä tahansa tavalla.
 */
export function startPilePlacement(deps: PilePlacementDeps): void {
  // Vain talkoolaisen layoutilla on `data-view-mode` (V174) — järjestäjällä kartta on aina
  // näkyvissä ∴ ⊥ moodinvaihtoa & ⊥ palautusta.
  const hasViewMode = document.getElementById('app')?.hasAttribute('data-view-mode') ?? false
  const prevMode = hasViewMode ? getViewMode() : null
  if (prevMode === 'koti') setViewMode('kartta', deps.onEnterKartta)

  deps.armPlacer(deps.onPlace, () => {
    removePilePlaceHint(deps.host)
    if (prevMode === 'koti') setViewMode('koti')
  })
  showPilePlaceHint(deps.host, () => deps.disarm())
}
