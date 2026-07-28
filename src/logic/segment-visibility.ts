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
