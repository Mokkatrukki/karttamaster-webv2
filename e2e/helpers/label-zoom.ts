import { expect, type Page } from 'playwright/test'

/**
 * T418/V309 — pätkän nimilappu näkyy vain `zoom ≥ 14`.
 *
 * Järjestäjän oletusnäkymä on `fitBounds` ∀ reitille → zoom ~13,4 ∴ ∀ lappua koskeva
 * E2E ! zoomata ensin lähemmäs, muuten lappu on `.segment-label--hidden`
 * (`opacity:0` + `pointer-events:none`) & klikki ⊥ osu lainkaan.
 *
 * Zoom asetetaan kartan API:sta (`__testMap`) ⊥ näppäimillä/rullalla: testi mittaa lapun
 * käytöstä, ⊥ zoom-kontrollia (sillä on omat testit, t191/t408). Yksi apuri ⊥ N kopiota
 * `setZoom`ia — kynnyksen muutos osuu silloin yhteen paikkaan.
 *
 * **Zoom kohdistetaan LAPPUUN, ⊥ kartan keskipisteeseen:** `setZoom` yksin siirtää pätkän
 * ruudun ulkopuolelle (mitattu: `element is outside of the viewport` → klikki jumittaa
 * 30 s), koska keskipiste on ∀ reitin yhteinen keskus ⊥ tämän pätkän kohta.
 */
export async function zoomToShowSegmentLabels(
  page: Page,
  opts: { text?: string; zoom?: number } = {},
): Promise<void> {
  const { text, zoom = 15 } = opts
  await page.evaluate(({ z, t }) => {
    const map = (window as unknown as Record<string, unknown>)['__testMap'] as {
      getContainer(): HTMLElement
      containerPointToLatLng(p: { x: number; y: number }): unknown
      setView(ll: unknown, z: number, o?: unknown): void
    } | undefined
    if (!map) return
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.segment-label'))
    const el = t ? labels.find(l => (l.textContent ?? '').includes(t)) : labels[0]
    if (!el) return
    const r = el.getBoundingClientRect()
    const mr = map.getContainer().getBoundingClientRect()
    const ll = map.containerPointToLatLng({ x: r.left + r.width / 2 - mr.left, y: r.top + r.height / 2 - mr.top })
    map.setView(ll, z, { animate: false })
  }, { z: zoom, t: text })
  // Portti ajetaan `zoomend`-kuuntelijassa ∴ odota EHTOA (luokka poistunut) ⊥ kelloa.
  await expect(page.locator('.segment-label').first()).not.toHaveClass(/segment-label--hidden/)
}
