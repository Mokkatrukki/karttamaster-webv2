/**
 * T191 (B86/V122) — zoom-kontrolli oikeaan yläkulmaan.
 * Leaflet-default zoom (+/-) oli vasemmassa yläkulmassa (topleft) ja peitti sivupalkin
 * ▶-toggle-napin mobiililla → talkoolainen ei saanut sivupalkkia auki. Ratkaisu: zoom → topright.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('Zoom-kontrolli topright', () => {
  test('mobiili (375px) → zoom-kontrolli oikeassa yläkulmassa, ei vasemmassa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await expect(page.locator('.leaflet-top.leaflet-right .leaflet-control-zoom')).toHaveCount(1)
    await expect(page.locator('.leaflet-top.leaflet-left .leaflet-control-zoom')).toHaveCount(0)
  })

  test('mobiili → ▶-toggle klikattavissa, zoom-napit eivät peitä sitä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    // Paneeli käynnistyy kiinni (V114) — toggle näyttää ▶
    await expect(page.locator('#left-panel')).toHaveClass(/collapsed/)

    const toggleBox = (await page.locator('#left-panel-toggle').boundingBox())!
    const zoomBox = (await page.locator('.leaflet-control-zoom').boundingBox())!

    // Zoom-kontrolli oikealla, toggle vasemmalla → ei päällekkäisyyttä x-akselilla
    expect(zoomBox.x).toBeGreaterThan(toggleBox.x + toggleBox.width)

    // Toggle avaa paneelin (ei jää zoom-nappien alle)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(300)
    await expect(page.locator('#left-panel')).not.toHaveClass(/collapsed/)
  })
})
