import type { Segment } from './segments'
import { segmentPrimaryRouteId } from './segments'

// T374/V269/B157: reitin näkyvyys on YKSI kytkin joka koskee ∀ siihen reittiin ankkuroitua
// kerrosta — reitti-polyline, merkit, pätkäviivat (T336-kolmikko) & nimilaput. Ennen tätä
// `RouteVisibilityControl` hoiti polylinen + merkit, mutta `SegmentOverlay` ⊥ kuullut
// reittinäkyvyydestä lainkaan ∴ piilotetun reitin pätkäviivat jäivät leijumaan kartalle
// ilman reittiä jonka päällä olisivat: kartta väitti pätkän olevan siellä missä ⊥ reittiä.
//
// Sääntö asuu TÄÄLLÄ (`src/logic/`) ⊥ map-kerroksessa: T376:n `map-filter` koostaa tämän
// muiden predikaattien kanssa, & sama sääntö kahdessa paikassa on kaksi eri mieltä olevaa
// karttaa (V271, B114–B129:n juurisyy 9 kertaa).
//
// Jäsenyys ratkeaa `segmentPrimaryRouteId`illa (V211) — `routeIds.includes` toisi mukaan
// jaetun osuuden naapurireitit joiden km-akselilla pätkän [start,end] ⊥ ole vertailukelpoinen
// (sama juurisyy kuin B114:ssä).
//
// Testattavuus: Vitest-pure.
export function segmentVisibleOnRoutes(
  seg: Pick<Segment, 'primaryRouteId' | 'routeIds'>,
  visibleRouteIds: string[] | undefined,
): boolean {
  // Suodatinta ⊥ ole asetettu → kaikki näkyvät. (Ero tyhjään listaan on merkitsevä: tyhjä
  // lista on saavuttamaton tila V6:n takia, mutta jos se joskus syntyy, se piilottaa
  // reitilliset pätkät johdonmukaisesti sen sijaan että vuotaisi "näytä kaikki".)
  if (visibleRouteIds === undefined) return true
  // V139: reititön tehtävä (keräyskasa/autoporukka) ⊥ katoa reittisuodatuksesta — sillä ⊥ ole
  // reittiä jonka mukana kadota. Reittivalitsin ⊥ saa hukata työtä joka ⊥ kuulu millekään reitille.
  const routeId = segmentPrimaryRouteId(seg)
  if (!routeId) return true
  return visibleRouteIds.includes(routeId)
}

// T418/V309: nimilappu on pätkän ainoa luettava kohde kartalla (T347) — mutta järjestäjän
// oletusnäkymä on `fitBounds` ∀ reitille → zoom ~13.4, jolla ∀ lappu piirtyy päällekkäin
// maaston yli & kartta luetaan nimilistana ⊥ karttana. Lappu on siis zoom-ehdollista sisältöä.
//
// Kynnys 14 ≠ `area-overlay.ts`:n 16 TIETOISESTI: pätkä on km-mittainen viiva (lappu ankkuroituu
// pitkään kohteeseen ∴ luettava kauempaa), feature on piste. Ero on päätös, ⊥ epäjohdonmukaisuus.
//
// Sääntö asuu TÄÄLLÄ samasta syystä kuin `segmentVisibleOnRoutes` (V271): kynnys map-kerroksen
// literaalina olisi toinen totuus heti kun toinen kutsupaikka kysyy samaa.
//
// Testattavuus: Vitest-pure.
export const MIN_SEGMENT_LABEL_ZOOM = 14

// `isOwn` = talkoolaisen oma tehtävä (`SegmentOverlay.contextOwnId`) → lappu näkyy ∀ zoomilla:
// orientaatio metsässä > yleisilme (VISION §Talkoolainen). Järjestäjällä `isOwn` on aina false
// ∴ hän saa puhtaan yleiskuvan — juuri se mitä hän pyysi 2026-07-30.
export function segmentLabelVisible(zoom: number, isOwn: boolean): boolean {
  if (isOwn) return true
  // NaN-vuoto: `getZoom()` ⊥ palauta NaN:ia, mutta jos palauttaisi, `>=` on false ∴ lappu
  // piiloutuu — hiljainen piilo on parempi kuin hiljainen näkyminen (kartta ⊥ valehtele
  // täyttä yleiskuvaa jos zoom on tuntematon). Eksplisiittinen ∴ lukija ⊥ arvaa.
  if (!Number.isFinite(zoom)) return false
  return zoom >= MIN_SEGMENT_LABEL_ZOOM
}
