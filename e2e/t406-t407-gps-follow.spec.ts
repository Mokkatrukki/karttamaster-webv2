/**
 * T406/T407 — V294/V295: GPS-kontrolli kartalla ja kartan seuranta.
 *
 * Kenttätilanne: talkoolainen ajaa pätkäänsä. Ennen tätä kartta keskittyi TASAN kerran
 * (ensimmäinen fix) ja jäi sitten paikalleen ∴ 200 m ajon jälkeen oma sijainti oli ruudun
 * ulkopuolella ja kartta oli hyödytön juuri liikkeessä. Laukaisin oli lisäksi ⋯-valikossa
 * (3 napautusta) — VISION §Talkoolainen sallii kriittiselle toiminnolle 2.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'

test.use({ viewport: { width: 390, height: 844 } })

async function openMap(page: import('playwright/test').Page): Promise<void> {
  await mockAuthAsTalkoolainen(page)
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 65.627, longitude: 27.628 })
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1200)
  const toMap = page.locator('#btn-to-map')
  if (await toMap.isVisible()) await toMap.click()
}

// Kartan siirtymän mittari: `.leaflet-map-pane`n transform liikkuu jokaisen panin mukana.
// Tile-probe (elementFromPoint) ei kelpaa — kartan keskellä on hero/sijaintipiste, ei laatta.
const mapPaneTransform = (page: import('playwright/test').Page) => page.evaluate(() =>
  getComputedStyle(document.querySelector('.leaflet-map-pane')!).transform)

test('V294 — GPS-kontrolli on KARTALLA yhden napautuksen päässä', async ({ page }) => {
  await openMap(page)
  const ctrl = page.locator('#gps-control')
  await expect(ctrl).toBeVisible()
  await expect(ctrl).toHaveText('📍 GPS')
  // §R: hanskat metsässä.
  const box = await ctrl.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)

  await ctrl.click()
  await expect(ctrl).toHaveText('🧭 Seuraa', { timeout: 8000 })
  await expect(ctrl).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.leaflet-gps-pane .gps-dot')).toBeVisible()
})

test('V295 — kartan panorointi purkaa seurannan, ei paikannusta; "Keskitä" palauttaa', async ({ page }) => {
  await openMap(page)
  const ctrl = page.locator('#gps-control')
  await ctrl.click()
  await expect(ctrl).toHaveText('🧭 Seuraa', { timeout: 8000 })

  // Sormen veto kartalla (⊥ ohjelmallinen pan).
  await page.mouse.move(200, 400)
  await page.mouse.down()
  await page.mouse.move(120, 250, { steps: 8 })
  await page.mouse.up()

  await expect(ctrl).toHaveText('📍 Keskitä', { timeout: 5000 })
  await expect(ctrl).toHaveAttribute('aria-pressed', 'false')
  // Paikannus jäi päälle: piste on yhä kartalla.
  await expect(page.locator('.leaflet-gps-pane .gps-dot')).toBeVisible()

  await ctrl.click()
  await expect(ctrl).toHaveText('🧭 Seuraa')
})

test('V295 — kartta SEURAA sijainnin muuttuessa (ei jää 1. fixiin)', async ({ page }) => {
  await openMap(page)
  await page.locator('#gps-control').click()
  await expect(page.locator('#gps-control')).toHaveText('🧭 Seuraa', { timeout: 8000 })
  const before = await mapPaneTransform(page)

  // ~1 km pohjoiseen — talkoolainen ajoi eteenpäin.
  await page.context().setGeolocation({ latitude: 65.637, longitude: 27.628 })
  await page.waitForTimeout(1500)

  const after = await mapPaneTransform(page)
  expect(after).not.toBe(before)
  expect(after).not.toBe('none') // mittari itse ! olla elossa
})

test('V294 — GPS-kontrolli ei näy koti-moodissa (kartta piilossa)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1200)
  // Koti-moodi = oletus; jos sovellus avautui suoraan kartalle, testi ei ole mielekäs.
  const mode = await page.evaluate(() => document.getElementById('app')?.dataset.viewMode)
  test.skip(mode !== 'koti', 'ei koti-moodissa')
  await expect(page.locator('#gps-control')).toBeHidden()
})
