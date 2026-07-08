/**
 * T201 (B91/V130) — merkkikirjaston uusi/muokkaa-modaalin "Kuva"-galleria mobiilinäkyvyys.
 * Sisäkkäiset scroll-containerit (modaali max-height:80vh;overflow-y:auto + galleria
 * max-height:min(50vh,420px);overflow-y:auto) collapsasivat gallerian matalalla mobiili-
 * viewportilla → thumbnailit eivät näkyneet. Desktopilla näkyi normaalisti.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockTemplates } from './helpers/auth'

async function openNewSignModal(page: import('playwright/test').Page) {
  await page.click('#left-panel-toggle')          // avaa overlay-paneeli mobiililla
  await page.waitForTimeout(300)
  await page.click('#left-panel #sign-type-dropdown .sign-lib-add-btn')
  await expect(page.locator('.sign-lib-modal')).toBeVisible()
  await page.click('.sign-visual-tab >> text=Kuva') // vaihda Kuva-välilehti
  await page.waitForTimeout(200)
}

test.describe('Sign-image-galleria mobiili (T201/B91)', () => {
  test('mobiili 375×667 → "Kuva"-välilehden thumbnailit näkyvissä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await openNewSignModal(page)

    const thumbs = page.locator('.sign-image-gallery .sign-image-thumb')
    expect(await thumbs.count()).toBeGreaterThan(1)

    // Vähintään yksi thumbnail on todella näkyvissä (korkeus > 0 + viewportissa).
    const first = thumbs.nth(1) // nth(0) = "Ei kuvaa"; nth(1) = eka oikea kuva
    await expect(first).toBeVisible()
    const box = await first.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThan(20)
    expect(box!.y).toBeLessThan(667)     // ruudun sisällä pystysuunnassa
    expect(box!.y + box!.height).toBeGreaterThan(0)

    // Galleria-container itse ei saa olla collapsannut 0-korkeuteen.
    const galleryBox = await page.locator('.sign-image-gallery').boundingBox()
    expect(galleryBox!.height).toBeGreaterThan(40)
  })

  test('desktop 1280×720 → thumbnailit näkyvissä (regressio-suoja)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    // Desktopilla paneeli auki jo — avaa suoraan modaali.
    await page.click('#left-panel #sign-type-dropdown .sign-lib-add-btn')
    await expect(page.locator('.sign-lib-modal')).toBeVisible()
    await page.click('.sign-visual-tab >> text=Kuva')
    await page.waitForTimeout(200)

    const first = page.locator('.sign-image-gallery .sign-image-thumb').nth(1)
    const box = await first.boundingBox()
    expect(box!.height).toBeGreaterThan(20)
  })
})
