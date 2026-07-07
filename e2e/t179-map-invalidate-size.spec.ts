/**
 * T179 (B79/V112) — map.invalidateSize() kartan resize-tilanteissa.
 * Ilman invalidateSizea Leaflet ei havaitse kontainerin koon muutosta —
 * leaflet-container-elementin koko kasvaa CSS:llä mutta map._size pysyy vanhana,
 * jolloin karttaa renderöityy vain osittain.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

async function mapPixelSize(page: import('playwright/test').Page) {
  return page.evaluate(() => {
    const m = (window as unknown as Record<string, unknown>)['__testMap'] as
      { getSize(): { x: number; y: number } } | undefined
    const size = m?.getSize()
    return size ? { x: size.x, y: size.y } : null
  })
}

test.describe('Kartan invalidateSize', () => {
  test('window resize → leaflet map._size päivittyy kontainerin kokoiseksi', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    const before = await mapPixelSize(page)
    expect(before).not.toBeNull()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(400) // debounce (150ms) + margin

    const after = await mapPixelSize(page)
    const containerBox = await page.locator('#map').boundingBox()

    expect(after).not.toBeNull()
    expect(containerBox).not.toBeNull()
    expect(Math.round(after!.x)).toBe(Math.round(containerBox!.width))
    expect(Math.round(after!.y)).toBe(Math.round(containerBox!.height))
  })

  test('left-panel toggle → map._size päivittyy välittömästi', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.click('#left-panel-toggle')
    await page.waitForTimeout(100)

    const after = await mapPixelSize(page)
    const containerBox = await page.locator('#map').boundingBox()

    expect(Math.round(after!.x)).toBe(Math.round(containerBox!.width))
    expect(Math.round(after!.y)).toBe(Math.round(containerBox!.height))
  })
})
