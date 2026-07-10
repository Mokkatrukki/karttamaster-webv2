// T224 (D) — "tässä on sun pätkä": latauksessa kartta fitataan OMAAN pätkään, ei koko karttaan.
// Puhdas logiikka: päätä mihin etäisyysväliin kartta zoomataan. Jos pätkä on lyhyt → fittaa koko
// pätkä (mode 'fit'). Jos pätkä on niin pitkä ettei sitä saa "riittävän lähelle" ilman että merkit
// jäävät pikkuruisiksi → aloita pätkän ALKUPÄÄSTÄ (mode 'anchor'): fittaa vain ikkuna
// [startDist, startDist+maxFitLengthM]. Näin talkoolaiselle tulee fiilis että hän tekee tätä pätkää.
//
// Leaflet-vapaa ∴ Vitest-pure. Map-glue (markers-wiring) muuntaa etäisyysvälin latlng-boundeiksi.

export interface SegmentZoomPlan {
  // 'fit' = koko pätkä mahtuu käyttökelpoiselle zoomille; 'anchor' = liian pitkä, aloita alkupäästä
  mode: 'fit' | 'anchor'
  // etäisyysväli (metreinä) johon kartta fitataan
  startDist: number
  endDist: number
}

export interface SegmentZoomOpts {
  // pisin pätkä (m) jonka vielä fittaa kokonaan; pidemmät ankkuroidaan alkupäähän. Default 4000 m.
  maxFitLengthM?: number
}

// Palauttaa etäisyysvälin johon kartta zoomataan pätkän latauksessa.
export function planSegmentZoom(
  startDist: number | undefined,
  endDist: number | undefined,
  opts: SegmentZoomOpts = {},
): SegmentZoomPlan | null {
  // Reititön tehtävä tms. → ei etäisyysväliä → ei zoom-suunnitelmaa (kutsuja fallback markkereihin).
  if (
    startDist === undefined ||
    endDist === undefined ||
    !Number.isFinite(startDist) ||
    !Number.isFinite(endDist) ||
    endDist <= startDist
  ) {
    return null
  }

  const maxFit = opts.maxFitLengthM ?? 4000
  const length = endDist - startDist

  if (length <= maxFit) {
    return { mode: 'fit', startDist, endDist }
  }
  // Liian pitkä → ankkuroi alkupäähän: näytä ensimmäinen maxFit-metrinen ikkuna.
  return { mode: 'anchor', startDist, endDist: startDist + maxFit }
}
