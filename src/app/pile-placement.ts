// T452/V335,V336 + T454/V338,V339: KASAN SIJOITUS — yksi virta, kartta näkyvissä koko ajan.
//
// B182: sijoitustila armattiin katsomatta näkymämoodia. Kotimoodissa `#map` on `display:none`
// (`style.css` `#app[data-view-mode="koti"]`) ∴ sovellus pyysi napauttamaan pintaa jota ⊥ ollut
// renderöity: ⊥ virhettä, ⊥ vihjettä, ⊥ ulospääsyä. Kaksi eri "moodia" — piirtolupa (`mapMode`)
// & näkymä (`data-view-mode`) — ovat ERI asia; toinen asetettiin, toinen jäi.
//
// T454 (B185,B186,B187) teki virrasta YHDEN — käyttäjäpäätös 2026-07-31: "laita kasa → sanoo
// klikkaa näytölle → klikkaat ja se tulee siihen → sit voit siirtää sitä, aina niin että on
// näytöllä":
//   napautus → esikatselupiste SIIHEN → vahvistuspalkki heroon (kartta jää näkyviin) →
//   napautus/raahaus siirtää samaa pistettä → Vahvista luo kasan, Peruuta ⊥ jätä jälkeä.
// GPS ⊥ enää luo kasaa (B185): se saa keskittää kartan & antaa etäisyyslukeman — ehdotus ⊥
// päätös. Yksi virta ∀ tapauksessa: se joka laukeaa harvemmin olisi se joka on rikki.
//
// V339: `armPlacer`in `onDisarm` on TILAN siivous ⊥ virityksen siivous. `PlaceMode` purkaa
// virityksen heti napautuksesta (⊥ tuplasijoitusta) mutta jättää TÄMÄN siivouksen odottamaan
// kunnes tulos on käytetty — muuten kartta katoaisi juuri sillä napautuksella joka antoi
// koordinaatin (B186). Siivous ripustetaan yhä `disarm`iin ∴ se kattaa KAIKKI poistumistiet
// (Peruuta, Esc, moodinvaihto) yhdellä kytkennällä — se tie joka jää kytkemättä on se jolla
// käyttäjä jää jumiin.
//
// DOM ilman Leafletia (kartta & esikatselupiste tulevat callbackeina) → Vitest-jsdom.

import { showPilePlaceHint, removePilePlaceHint, openPileConfirmBar, type PileConfirmBarHandle } from '../ui/pile-drop'
import { showToast } from '../ui/toast'
import { getViewMode, setViewMode } from './talkoolainen-mode'
import type { SignMarker } from '../logic/types'

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

/** Kartalla elävä aikomus — ⊥ vielä kasa. Toteutus `src/map/pile-preview.ts` (Leaflet-raja). */
export interface PilePreviewHandle {
  move(lat: number, lon: number): void
  position(): { lat: number; lon: number }
  remove(): void
}

export interface PilePlacementDeps {
  /** Ohjerivin & vahvistuspalkin koti. V336: ! olla `pointer-events:auto`-kerroksessa (`#segment-view`). */
  host: HTMLElement
  /** Mitä kasaan on menossa — palkin lukema & sisältölista. */
  contents: SignMarker[]
  /** `PlaceMode.armPlacer` — kartan seuraava napautus kutsuu `fn`:ää. */
  armPlacer(fn: (lat: number, lon: number) => void, onDisarm: () => void): void
  /** `PlaceMode.disarm` — purkaa virityksen JA tilan (siivous ripustettu `onDisarm`iin). */
  disarm(): void
  /** Esikatselupiste kartalle. `onMove` = raahaus. */
  showPreview(lat: number, lon: number, onMove: (lat: number, lon: number) => void): PilePreviewHandle
  /** Kasa syntyy tähän — vasta Vahvista laukaisee tämän. */
  onConfirm(lat: number, lon: number): void
  /** Metrit käyttäjästä pisteeseen; `null` = ⊥ fixiä ∴ lukemaa ⊥ näytetä (⊥ arvata nollaa). */
  distanceFrom?(lat: number, lon: number): number | null
  /** Leaflet `invalidateSize` kun kartta paljastuu (V176). */
  onEnterKartta?(): void
}

/**
 * Siirtää käyttäjän kasan sijoitustilaan: kartta näkyviin, ohjerivi heroon, viritys päälle.
 * Palauttaa edellisen näkymämoodin kun tila purkautuu — PAITSI vahvistuksen jälkeen: juuri
 * syntynyt kasa ! jäädä ruudulle (V340) ∴ kotiin heittäminen piilottaisi teon tuloksen.
 */
export function startPilePlacement(deps: PilePlacementDeps): void {
  // Vain talkoolaisen layoutilla on `data-view-mode` (V174) — järjestäjällä kartta on aina
  // näkyvissä ∴ ⊥ moodinvaihtoa & ⊥ palautusta.
  const hasViewMode = document.getElementById('app')?.hasAttribute('data-view-mode') ?? false
  const prevMode = hasViewMode ? getViewMode() : null
  if (prevMode === 'koti') setViewMode('kartta', deps.onEnterKartta)

  let preview: PilePreviewHandle | null = null
  let bar: PileConfirmBarHandle | null = null
  let confirmed = false

  const distance = (lat: number, lon: number): number | null => deps.distanceFrom?.(lat, lon) ?? null

  // Yksi siivous ∀ poistumistielle. Vahvistettu kasa jättää näkymän kartalle (V340).
  const cleanup = (): void => {
    bar?.remove()
    bar = null
    preview?.remove()
    preview = null
    removePilePlaceHint(deps.host)
    if (!confirmed && prevMode === 'koti') setViewMode('koti')
  }

  const onPlace = (lat: number, lon: number): void => {
    if (preview) preview.move(lat, lon)
    else preview = deps.showPreview(lat, lon, onPreviewMoved)

    if (bar) bar.setDistance(distance(lat, lon))
    else {
      // Ohje on tehnyt tehtävänsä — palkki kertoo seuraavan teon & kaksi ohjetta yhtä aikaa
      // olisi kaksi eri vastausta kysymykseen "mitä nyt".
      removePilePlaceHint(deps.host)
      bar = openPileConfirmBar(deps.host, deps.contents, { onConfirm, onCancel }, distance(lat, lon))
    }

    // V338: seuraava napautus SIIRTÄÄ saman pisteen ⊥ luo toista kasaa. Viritys ! uusia joka
    // kerta — `PlaceMode` purkaa sen napautuksessa (⊥ vahingossa kahta sijoitusta yhdestä).
    deps.armPlacer(onPlace, cleanup)
  }

  const onPreviewMoved = (lat: number, lon: number): void => {
    bar?.setDistance(distance(lat, lon))
  }

  function onConfirm(): void {
    // Totuus on KARTALLA: raahaus liikutti pistettä ilman että kukaan kertoi siitä kutsujalle.
    const at = preview?.position()
    if (!at) return
    confirmed = true
    deps.disarm()
    deps.onConfirm(at.lat, at.lon)
  }

  function onCancel(): void {
    deps.disarm()
  }

  deps.armPlacer(onPlace, cleanup)
  showPilePlaceHint(deps.host, () => deps.disarm())
}
