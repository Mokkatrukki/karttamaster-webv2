/**
 * T181 (B81/V114) — left-panel mobiili-drawer, ei kartan kutistus.
 * 260px kiinteä left-panel flex-siblingina jätti kartalle sliverin 375px-viewportissa.
 * Ratkaisu: mobiilissa (≤480px) panel overlayaa kartan (position:absolute), ei kutista sitä,
 * ja panel käynnistyy collapsed-tilassa jotta kartta näkyy täysleveänä heti latauksella.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('Left-panel mobiili-drawer', () => {
  test('mobiili (375px) → paneeli käynnistyy kiinni, kartta täysleveä heti', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await expect(page.locator('#left-panel')).toHaveClass(/collapsed/)

    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox!.width).toBeGreaterThan(340) // lähes koko 375px viewport, ei ~115px sliver
  })

  test('mobiili → paneelin avaus overlayaa kartan, kartan leveys ei kutistu', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    const mapWidthBefore = (await page.locator('#map').boundingBox())!.width

    await page.click('#left-panel-toggle')
    await page.waitForTimeout(300)

    await expect(page.locator('#left-panel')).not.toHaveClass(/collapsed/)
    const mapWidthAfter = (await page.locator('#map').boundingBox())!.width

    // Kartta ei kutistu — paneeli on overlay (position:absolute), ei flex-sibling
    expect(mapWidthAfter).toBeGreaterThan(340)
    expect(Math.abs(mapWidthAfter - mapWidthBefore)).toBeLessThan(5)
  })

  test('desktop (1280px) → paneeli käynnistyy auki kuten ennen', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await expect(page.locator('#left-panel')).not.toHaveClass(/collapsed/)
  })
})
