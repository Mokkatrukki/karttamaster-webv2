/**
 * T312 / V224 — hero-alapalkin ◀▶ ankkuroitu palkin reunoihin.
 * Todiste: nuolten boundingBox().x on SAMA (±1px) lyhyellä ja pitkällä merkin nimellä ∴ nuoli ei
 * hyppää merkistä toiseen (hanskakäsi/peukalo löytää kohteen). Touch ≥44×44, disabled-clamp päihin.
 * Hero on kartta-moodin ohjaus (V182) → siirry kartalle ennen mittausta.
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'
import { pointAtDistance } from './helpers/route-points'

const CODE = 'NAV01'
const SHORT = 'A'
const LONG = 'Erittäin pitkä merkin nimi joka ei mahdu palkkiin vaan ellipsoituu'

async function mockNavSegment(page: Page): Promise<void> {
  const seg = {
    id: 'seg-nav', routeIds: ['smtb-30'], startDist: 0, endDist: 20000,
    assignedCode: CODE, displayName: 'Navipätkä', description: '', equipment: [],
    phase: 'asettaminen', inspected: false, completed: false,
  }
  const base = {
    type: 'right', route_ids: ['smtb-30'], status: 'suunniteltu', location_note: null,
    color: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }
  // V283: koordinaatti reitin jäljeltä — keksitty ruudukko jää 200 m kynnyksen ulkopuolelle
  // eikä pätkä omista merkkejä ∴ hero ei renderöi nuolia lainkaan.
  const at = (m: number): { lat: number; lon: number } => {
    const [lat, lon] = pointAtDistance(m)
    return { lat, lon }
  }
  const markers = [
    // Etäisyydet mahtuvat testireitin pituuteen ∴ kolme ERI pistettä (clamp veisi kaksi samaan).
    { ...base, id: 'm-short', ...at(1000), distance_from_start: 1000, label: SHORT },
    { ...base, id: 'm-long', ...at(2500), distance_from_start: 2500, label: LONG },
    { ...base, id: 'm-third', ...at(4000), distance_from_start: 4000, label: 'C' },
  ]
  await page.route(new RegExp(`/api/segments/by-code/${CODE}$`), r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seg) }))
  await page.route(/\/api\/markers(\?|$)/, r => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(markers) })
    }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
}

test('T312/V224 — ◀▶ x-sijainti sama lyhyellä ja pitkällä merkin nimellä (±1px)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page, CODE)
  await mockNavSegment(page)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  await page.click('#btn-to-map') // hero = kartta-moodin ohjaus (V182)

  const prev = page.locator('.segment-view-next-prev')
  const fwd = page.locator('.segment-view-next-fwd')
  await expect(fwd).toBeVisible()

  // 1. merkki = lyhyt nimi.
  await expect(page.locator('.segment-view-next-name')).toHaveText(SHORT)
  const prevShort = await prev.boundingBox()
  const fwdShort = await fwd.boundingBox()

  // ▶ → 2. merkki = pitkä nimi (ellipsoituu, ei työnnä nuolta).
  await fwd.click()
  await expect(page.locator('.segment-view-next-name')).toHaveText(LONG)
  const prevLong = await prev.boundingBox()
  const fwdLong = await fwd.boundingBox()

  expect(Math.abs(prevLong!.x - prevShort!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(fwdLong!.x - fwdShort!.x)).toBeLessThanOrEqual(1)

  // Touch-kohteet ≥44×44 (DESIGN §R) molemmilla nimillä.
  for (const b of [prevShort, fwdShort, prevLong, fwdLong]) {
    expect(b!.width).toBeGreaterThanOrEqual(44)
    expect(b!.height).toBeGreaterThanOrEqual(44)
  }

  // ▶ kiinni oikeaan reunaan: sen oikea reuna = rivin oikea reuna.
  const rowBox = await page.locator('.segment-view-next-row').boundingBox()
  expect(Math.abs((fwdLong!.x + fwdLong!.width) - (rowBox!.x + rowBox!.width))).toBeLessThanOrEqual(1)
  expect(Math.abs(prevLong!.x - rowBox!.x)).toBeLessThanOrEqual(1)
})

test('T312/V159 — disabled-clamp päihin säilyy selailussa', async ({ page }) => {
  await mockAuthAsTalkoolainen(page, CODE)
  await mockNavSegment(page)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  await page.click('#btn-to-map')

  const prev = page.locator('.segment-view-next-prev')
  const fwd = page.locator('.segment-view-next-fwd')
  await expect(prev).toBeDisabled()
  await expect(fwd).toBeEnabled()
  await fwd.click()
  await fwd.click()
  await expect(fwd).toBeDisabled()
  await expect(prev).toBeEnabled()
  // aria-labelit säilyvät
  await expect(prev).toHaveAttribute('aria-label', 'Edellinen merkki')
  await expect(fwd).toHaveAttribute('aria-label', 'Seuraava merkki')
})
