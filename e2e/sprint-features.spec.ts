/**
 * Sprint E2E — T42/T49/T15/T28/T38
 * Validoi demo-sprintin featuuret selaimessa.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen } from './helpers/auth'

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
    // V80: #btn-role-toggle on dead code tili-per-rooli-authin jälkeen — kirjaudu suoraan talkoolaisena
    await mockAuthAsTalkoolainen(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

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

    // Lue alkutila — ei merkkejä vielä (status-panel.ts: total===0 → '—')
    const detail = page.locator('.status-panel-detail').first()
    const before = await detail.textContent()
    expect(before).toBe('—')

    // Lisää merkki (T85: dblclick → floating picker → tyyppi)
    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(500)

    // Detail päivittynyt
    const after = await detail.textContent()
    expect(after).not.toBe('—')
  })
})

test.describe('T38 — Merkin tyyppi vaihdettavissa', () => {
  test('järjestäjä näkee type-selectin merkin detail-modaalissa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki ensin (T85: dblclick → floating picker → tyyppi)
    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(400)

    // Avaa overflow-valikko → Lista → merkkirivi → detail-modaali (tyyppi-select siirretty tänne)
    await page.click('#btn-menu')
    await page.waitForTimeout(200)
    await page.click('#btn-list')
    await page.waitForTimeout(300)
    await page.click('.marker-item')
    await page.waitForTimeout(300)

    // Type-select näkyy järjestäjälle
    const sel = page.locator('.marker-detail-type-select')
    await expect(sel).toHaveCount(1)
    await expect(sel).toHaveValue('right')
  })

  test('talkoolainen ei näe type-selectiä', async ({ page }) => {
    // Talkoolainen voi myös lisätä merkin (dblclick ei ole roolirajattu)
    await mockAuthAsTalkoolainen(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)
    await expect(page.locator('#btn-role')).toHaveText('Talkoolainen')

    await page.dblclick('#map', { position: { x: 200, y: 260 } })
    await page.waitForTimeout(500)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(400)

    // Avaa overflow-valikko → Lista → merkkirivi → detail-modaali
    await page.click('#btn-menu')
    await page.waitForTimeout(200)
    await page.click('#btn-list')
    await page.waitForTimeout(300)
    await page.click('.marker-item')
    await page.waitForTimeout(300)

    // Ei type-selectiä
    await expect(page.locator('.marker-detail-type-select')).toHaveCount(0)
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
