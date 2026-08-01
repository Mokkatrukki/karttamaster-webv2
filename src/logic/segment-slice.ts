// T464/V353: pätkän piirrettävä geometria km-rajoista. Puhdas ∴ Vitest-pure — kerros erotettu
// `segment-overlay.ts`:stä koska rajatapaukset (lyhyt pätkä, harva GPX) ovat juuri niitä joita
// Playwright ⊥ näe: ne vaativat syötteen jota tuotantoreitillä ⊥ ole.
import type { RoutePoint } from './types'

/**
 * Reitin pisteet km-välillä. Ehto on `>=` & `<=` MOLEMMISSA päissä ∴ jaettu raja kuuluu
 * kumpaankin pätkään & viivat kohtaavat ilman aukkoa datassa.
 *
 * V258/V260: `deriveTrackFromBounds` käyttää TÄSMÄLLEEN samaa ehtoa ∴ jäljen migraatio ⊥ siirrä
 * karttaa pikselilläkään. Jos tätä muuttaa, se ! muuttua molemmissa.
 */
export function sliceRoutePoints(
  points: RoutePoint[],
  startDist: number,
  endDist: number,
): [number, number][] {
  return points
    .filter(p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist)
    .map(p => [p.lat, p.lon])
}

/**
 * V353: rajan GEOMETRINEN kanava. 12 m on ~1.5 px zoomilla 13 (Syötteen leveysasteella ~8 m/px)
 * & ~12 px zoomilla 16 ∴ rako katoaa kaukaa jossa sitä ⊥ tarvita (kaukaa luetaan väriä) & on
 * selvä läheltä jossa raja kiinnostaa. Metreissä ⊥ pikseleinä: rako kasvaa zoomatessa kuten
 * viivakin.
 */
export const SEGMENT_END_GAP_M = 12

/**
 * Sama siivu, molemmista päistä `SEGMENT_END_GAP_M` lyhyempänä ∴ vierekkäiset pätkät ⊥ kosketa
 * toisiaan & jaettu raja lukee rakona myös silloin kun värit ovat lähellä toisiaan.
 *
 * Kaksi peruuttamista lähtötilaan, kumpikin siksi ettei rako saa MAKSAA enempää kuin tuo:
 * (a) lyhyt pätkä — rako söisi siitä merkittävän osan & päätepisteet (r=5px) menisivät päällekkäin;
 * (b) harva GPX ∴ kavennettu siivu jäisi alle kahden pisteen & pätkä katoaisi kartalta kokonaan.
 * Näkyvä väärä raja on parempi kuin näkymätön pätkä.
 */
export function insetRoutePoints(
  points: RoutePoint[],
  startDist: number,
  endDist: number,
): [number, number][] {
  const full = sliceRoutePoints(points, startDist, endDist)
  if (endDist - startDist <= SEGMENT_END_GAP_M * 4) return full
  const inset = sliceRoutePoints(points, startDist + SEGMENT_END_GAP_M, endDist - SEGMENT_END_GAP_M)
  return inset.length >= 2 ? inset : full
}
