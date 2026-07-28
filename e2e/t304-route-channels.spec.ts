/**
 * T304/V216 — reitit erottuvat kahdella kanavalla kartalla JA legendassa.
 *
 * V216:n juurisyy: 3 SMTB-reittiä olivat sama sininen kolmella vaaleudella ∴ jaetulla osuudella
 * ylempi peitti alemman TÄYSIN (yksi kanava kantoi kaiken) ja aurinko söi vaaleuseron.
 * Yksikkötesti tarkistaa paletin; tämä tarkistaa että kuvio päätyy oikeasti kartalle ja legendaan.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('T304/V216 — reittien kaksi kanavaa', () => {
  test('kartan reittiviivat: uniikki väri+kuvio -pari, katkoviivat paljastavat alemman', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Reittiviivat = weight 6 (pätkät 9/11, aukot 8) — ei sekaannu muihin polylineihin.
    const routes = await page.evaluate(() =>
      Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
        .filter(p => p.getAttribute('stroke-width') === '6')
        .map(p => ({
          stroke: (p.getAttribute('stroke') ?? '').toUpperCase(),
          dash: p.getAttribute('stroke-dasharray') ?? 'solid',
        })))

    expect(routes.length).toBe(6)
    // Kanava 1: jokainen väri uniikki.
    expect(new Set(routes.map(r => r.stroke)).size).toBe(6)
    // Kanava 2: kuvioita on useampi kuin yksi — muuten 2. kanavaa ei ole olemassa kartalla.
    expect(new Set(routes.map(r => r.dash)).size).toBeGreaterThan(1)
    // Katkoviivallisia ≥ 4/6 ∴ päällekkäisellä osuudella alempi reitti näkyy aukoista.
    expect(routes.filter(r => r.dash !== 'solid').length).toBeGreaterThanOrEqual(4)
  })

  test('legenda vastaa karttaa: reittivalitsimen swatchit kantavat saman kuvion', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    // T377: reittivalitsin muutti suodatinbariin (kartan yläpuoli) — legendan sopimus säilyy.
    await page.locator('.map-filter-dropdown[data-filter="routes"] .map-filter-trigger').click()
    await page.waitForTimeout(400)

    const swatches = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.map-filter-swatch'))
        .map(el => getComputedStyle(el).backgroundImage))

    expect(swatches.length).toBe(6)
    // Katkoviivalliset reitit → gradientti; ehjät → 'none'. Molempia ! esiintyä, muuten
    // legenda näyttää kaikki samanlaisina vaikka kartalla ne eroavat (V216 c).
    expect(swatches.filter(s => s.includes('gradient')).length).toBeGreaterThanOrEqual(4)
    expect(swatches.filter(s => s === 'none').length).toBeGreaterThanOrEqual(1)
  })
})
