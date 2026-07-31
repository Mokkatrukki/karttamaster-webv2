/**
 * T458/V343 — `/kasat`-kartalla on reittijäljet TAUSTALLA.
 *
 * Käyttäjä 2026-07-31: "kasat-näkymä autoporukalle olisi hyvä sisältää gps-jäljet reiteistä
 * niin on helpompi navigoida reittejä." T448 jätti reitit tahallaan pois — tyhjä tausta ⊥ ole
 * selkeys vaan tiedon puute: kasa on reitin varrella & jälki kertoo miten sinne pääsee.
 *
 * Jälki on APU ⊥ EHTO ∴ testi todistaa myös että lista renderöityy vaikka GPX ⊥ tulisi.
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'
import { pointAtDistance } from './helpers/route-points'

const at = (m: number): { lat: number; lon: number } => {
  const [lat, lon] = pointAtDistance(m)
  return { lat, lon }
}

const KASA_BASE = {
  type: 'kerayskasa', template_id: 'kerayskasa', route_ids: [], location_note: null,
  color: null, icon_id: null, image_id: null, parts_json: null, description: null,
  images: [], created_by: null,
}

async function mockKasat(page: Page): Promise<void> {
  const kasat = [
    { ...KASA_BASE, id: 'kasa-1', ...at(1000), distance_from_start: 1000, status: 'suunniteltu', label: 'Kasa A', pile_marker_ids: ['a', 'b'] },
    { ...KASA_BASE, id: 'kasa-2', ...at(9000), distance_from_start: 9000, status: 'suunniteltu', label: 'Kasa B', pile_marker_ids: ['c'] },
  ]
  await page.route(/\/api\/phase$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phase: 'purku' }) }))
  await page.route(/\/api\/markers(\?|\/|$)/, r =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kasat) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await mockAuthAsTalkoolainen(page, 'KASAT1')
}

test.use({ viewport: { width: 390, height: 844 } })

test('T458/V343 — reittijäljet piirtyvät kasakartalle taustaksi', async ({ page }) => {
  await mockKasat(page)
  await page.goto('/kasat')
  await page.waitForTimeout(2500)

  // Lista on ruudulla — se ⊥ odota GPX:iä.
  await expect(page.locator('.kasat-row').first()).toBeVisible()

  // Reittijälki: SyöteMTB 30 km:n väri (`route-defs.ts`). Ohut & himmennetty = TAUSTA.
  const trace = page.locator('#kasat-map path[stroke="#1D8CB4"]').first()
  await expect(trace).toBeVisible()
  expect(await trace.getAttribute('stroke-width')).toBe('3')
  expect(Number(await trace.getAttribute('stroke-opacity') ?? '1')).toBeLessThan(0.6)

  // Kasapiste on jäljen PÄÄLLÄ: molemmat ovat SVG-polkuja ∴ järjestys ratkaisee kumpi peittää.
  const paths = page.locator('#kasat-map path')
  const strokes = await paths.evaluateAll(els => els.map(e => e.getAttribute('stroke')))
  const firstPile = strokes.indexOf('#8A5CD1')
  const firstTrace = strokes.indexOf('#1D8CB4')
  expect(firstPile).toBeGreaterThan(-1)
  expect(firstTrace).toBeGreaterThan(-1)
  expect(firstTrace).toBeLessThan(firstPile)
})

test('T458 — GPX:n kaatuminen ⊥ vie listaa eikä karttaa (apu ⊥ ehto)', async ({ page }) => {
  await mockKasat(page)
  await page.route(/\.gpx$/, r => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/kasat')
  await page.waitForTimeout(2000)

  await expect(page.locator('.kasat-row').first()).toBeVisible()
  await expect(page.locator('#kasat-map path[stroke="#8A5CD1"]').first()).toBeVisible()
  // ⊥ virhebanneria: reitittömyys ⊥ ole asia jolle autoporukka voi tehdä mitään metsässä.
  await expect(page.locator('.kasat-error')).toHaveCount(0)
})
