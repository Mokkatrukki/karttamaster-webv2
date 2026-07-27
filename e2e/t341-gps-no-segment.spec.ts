/**
 * T341/V247 — GPS toimii vaikka pätkää ei ole (B133-regressio).
 *
 * Kenttätilanne: talkoolainen avaa /s/<koodi> mobiiliverkossa, pätkähaku kaatuu (tai koodilla
 * ei ole pätkää) → ennen korjausta ⋯-valikon GPS-nappi renderöityi ILMAN click-kuuntelijaa
 * (kytkentä eli `if (seg)`-lohkon sisällä) ∴ klikkaus ei tehnyt mitään eikä mikään kertonut siitä.
 * Oma sijainti on laitteen tieto, ei pätkän ominaisuus (V247).
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'

test.describe('T341/V247 — GPS ilman pätkää', () => {
  test('pätkähaku kaatuu → GPS-nappi silti toimii ja piste ilmestyy kartalle', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    // Pätkähaku kaatuu (mobiiliverkko) — tämä on B133:n laukaisin.
    await page.route(/\/api\/segments\/by-code\/.*$/, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }))
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: 65.627, longitude: 27.628 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    // Koti-moodissa #map on display:none (style.css) → siirry kartalle jotta piste on näkyvä.
    const toMap = page.locator('#btn-to-map')
    if (await toMap.isVisible()) await toMap.click()

    await page.click('#btn-menu')
    const gpsBtn = page.locator('#btn-tk-gps')
    await expect(gpsBtn).toBeVisible()
    await expect(gpsBtn).toHaveText('📍 GPS')

    await gpsBtn.click()
    // Label kertoo totuuden: päällä VASTA fixistä (V247) — tässä fix tulee mockista heti.
    await expect(gpsBtn).toHaveText('📍 GPS päällä', { timeout: 5000 })
    await expect(page.locator('.leaflet-overlay-pane .gps-dot')).toBeVisible()
  })

  test('sijaintilupa evätty → näkyvä syy, ei hiljainen no-op', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await page.route(/\/api\/segments\/by-code\/.*$/, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }))
    // Lupa evätty → watchPosition kutsuu error-callbackia koodilla 1.
    await page.context().clearPermissions()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    await page.click('#btn-menu')
    await page.locator('#btn-tk-gps').click()

    // V247: virhe ei saa jäädä console.warniin — talkoolainen näkee syyn.
    await expect(page.locator('text=Sijaintilupa evätty')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#btn-tk-gps')).toHaveText('📍 GPS')
  })
})
