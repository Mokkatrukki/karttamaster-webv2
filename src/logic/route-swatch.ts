// T304/V216: legendan ! näyttää sama KAKSI kanavaa kuin kartan — väri JA viivakuvio. Pelkkä
// väripallo valehtelee sen jälkeen kun kuviosta tuli erottava kanava: kaksi reittiä joilla on
// lähisukuinen sävy näyttäisivät legendassa identtisiltä vaikka kartalla ne erottuvat kuviosta.
//
// Puhdas funktio (⊥ DOM, ⊥ Leaflet) ∴ Vitest-pure. Palauttaa CSS-taustan jonka sekä
// RouteVisibilityControl että RouteBar asettavat samaan swatch-elementtiin — yksi lähde,
// ⊥ kahta eri tulkintaa samasta dashArraysta.

/** Leafletin dashArray ("18 8") → viivan & aukon pituus. undefined/tyhjä = ehjä. */
export function parseDashArray(dashArray?: string): { dash: number; gap: number } | null {
  if (!dashArray) return null
  const parts = dashArray.split(/[\s,]+/).filter(Boolean).map(Number)
  if (parts.length < 2 || parts.some(n => !Number.isFinite(n) || n <= 0)) return null
  return { dash: parts[0], gap: parts[1] }
}

/** Montako jaksoa swatchiin mahtuu. Yksi jakso = yksi viiva + yksi aukko ∴ yhdellä jaksolla
 *  harva kuvio ('3 8') näyttäisi yhdeltä pisteeltä eikä kuviolta. Kolme jaksoa lukee kuvioksi
 *  myös 26px levyisessä swatchissa. */
const SWATCH_PERIODS = 3

/**
 * CSS `background`-arvo reitin swatchille. Ehjä viiva → tasainen väri; katkoviiva →
 * repeating-linear-gradient samassa dash/gap-SUHTEESSA kuin kartalla (⊥ samoissa pikseleissä:
 * swatch on 26px, reitti kilometrejä) ∴ legendan kuvio on tunnistettavasti kartan kuvio.
 */
export function routeSwatchBackground(color: string, dashArray?: string): string {
  const d = parseDashArray(dashArray)
  if (!d) return color
  const period = 100 / SWATCH_PERIODS
  const dashPct = (d.dash / (d.dash + d.gap)) * period
  return `repeating-linear-gradient(90deg, ${color} 0 ${dashPct.toFixed(1)}%, transparent ${dashPct.toFixed(1)}% ${period.toFixed(1)}%)`
}
