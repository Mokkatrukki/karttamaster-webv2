// T224 (D) / T265 (B107) — "tässä on sun pätkä": latauksessa kartta fitataan OMAAN pätkään, ei koko
// karttaan. Fittaa AINA KOKO pätkä [startDist,endDist] (käyttäjäpäätös 2026-07-21, V185: pätkän oikea
// pituus > merkkien koko). Aiempi anchor-clamp (pitkä pätkä → vain alkupää) poistettu — näytti pätkän
// "liian lyhyenä" (B107).
//
// Leaflet-vapaa ∴ Vitest-pure. Map-glue (markers-wiring) muuntaa etäisyysvälin latlng-boundeiksi.

export interface SegmentZoomPlan {
  // T265/V185: aina 'fit' — koko pätkä. (Kenttä säilyy API-vakioina; kutsuja lukee start/endDistin.)
  mode: 'fit'
  // etäisyysväli (metreinä) johon kartta fitataan = koko pätkä
  startDist: number
  endDist: number
}

// Palauttaa koko pätkän etäisyysvälin johon kartta zoomataan latauksessa (aina fit, V185).
// null jos rajat puuttuvat/epäkelpo (reititön tehtävä tms.) → kutsuja fallback markkereihin.
export function planSegmentZoom(
  startDist: number | undefined,
  endDist: number | undefined,
): SegmentZoomPlan | null {
  if (
    startDist === undefined ||
    endDist === undefined ||
    !Number.isFinite(startDist) ||
    !Number.isFinite(endDist) ||
    endDist <= startDist
  ) {
    return null
  }
  return { mode: 'fit', startDist, endDist }
}
