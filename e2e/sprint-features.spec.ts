/**
 * Sprint E2E — T42/T49/T15/T28/T38
 * Validoi demo-sprintin featuuret selaimessa.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('T28 — Status panel (tilannekuva)', () => {
  test('näkyy järjestäjälle toolbarin alla', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Varmista järjestäjä-rooli (default)
    await expect(page.locator('#btn-role')).toHaveText('Järjestäjä')

    // Status panel näkyy
    const panel = page.locator('#status-panel')
    await expect(panel).toBeVisible()

    // Sisältää rivi per reitti
    const rows = panel.locator('.status-panel-row')
    await expect(rows).toHaveCount(2)

    // Prosentit näkyvissä
    const pcts = panel.locator('.status-panel-pct')
    await expect(pcts.first()).toContainText('%')
  })

  test('piilossa talkoolaiselta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Vaihda talkoolaiseksi
    await page.click('#btn-role')
    await expect(page.locator('#btn-role')).toHaveText('Talkoolainen')

    // Status panel piilotettu
    const panel = page.locator('#status-panel')
    await expect(panel).not.toBeVisible()
  })

  test('päivittyy kun merkki lisätään', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lue alkutila
    const detail = page.locator('.status-panel-detail').first()
    const before = await detail.textContent()
    expect(before).toBe('0/0')

    // Lisää merkki
    await page.click('#btn-add-sign')
    await page.waitForTimeout(300)
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(300)

    const map = page.locator('#map')
    const box = await map.boundingBox()
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.waitForTimeout(500)

    // Detail päivittynyt
    const after = await detail.textContent()
    expect(after).not.toBe('0/0')
  })
})

test.describe('T38 — Merkin tyyppi vaihdettavissa', () => {
  test('järjestäjä näkee type-select merkkilistassa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki ensin
    await page.click('#btn-add-sign')
    await page.waitForTimeout(200)
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(200)
    const map = page.locator('#map')
    const box = await map.boundingBox()
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.waitForTimeout(400)

    // Avaa lista
    await page.click('#btn-list')
    await page.waitForTimeout(300)

    // Type-select näkyy järjestäjälle
    const sel = page.locator('.marker-type-select')
    await expect(sel).toHaveCount(1)
    await expect(sel).toHaveValue('right')

    // 4 vaihtoehtoa
    const opts = sel.locator('option')
    await expect(opts).toHaveCount(4)
  })

  test('talkoolainen ei näe type-selectiä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki järjestäjänä
    await page.click('#btn-add-sign')
    await page.waitForTimeout(200)
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(200)
    const map = page.locator('#map')
    const box = await map.boundingBox()
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    }
    await page.waitForTimeout(400)

    // Vaihda talkoolaiseksi
    await page.click('#btn-role')
    await expect(page.locator('#btn-role')).toHaveText('Talkoolainen')

    // Avaa lista
    await page.click('#btn-list')
    await page.waitForTimeout(300)

    // Ei type-selectiä
    await expect(page.locator('.marker-type-select')).toHaveCount(0)
  })
})

test.describe('T49 — Kartta-tila badge', () => {
  test('badge-alue on olemassa toolbarissa järjestäjälle', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // #map-state-badge renderöidään järjestäjälle (vaikka backend puuttuu)
    const badge = page.locator('#map-state-badge')
    await expect(badge).toBeAttached()
  })
})

test.describe('Touch targets — sprint features', () => {
  test('uudet elementit eivät riko 44px touch-vaatimusta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    const buttons = await page.locator('button').all()
    for (const btn of buttons) {
      const visible = await btn.isVisible()
      if (!visible) continue
      const box = await btn.boundingBox()
      const text = (await btn.innerText()).trim()
      if (box) {
        expect(
          Math.min(box.width, box.height),
          `TOUCH SMALL: "${text}"`,
        ).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
