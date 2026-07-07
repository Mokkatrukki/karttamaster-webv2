/**
 * T180 (B80/V113, korjattu juurisyy) — PhaseSwitcher-select overflow-menun sisällä
 * ei saa katketa dokumentti-tason ulkoklikki-sulkijasta.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('PhaseSwitcher overflow-menussa', () => {
  test('vaihe-select interaktio ei sulje overflow-menua kesken', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.click('#btn-menu')
    await expect(page.locator('#toolbar-menu')).toHaveClass(/open/)

    await page.locator('.phase-switcher-select').selectOption('tarkastus')

    // Menu pysyy auki heti valinnan jälkeen — ei sulkeudu ulkoklikki-listenerin takia
    await expect(page.locator('#toolbar-menu')).toHaveClass(/open/)
    await expect(page.locator('.phase-switcher-select')).toHaveValue('tarkastus')
  })

  test('regressio: muu overflow-item (Lista) sulkee menun kuten ennen', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.click('#btn-menu')
    await expect(page.locator('#toolbar-menu')).toHaveClass(/open/)

    await page.click('#btn-list')
    await page.waitForTimeout(200)

    await expect(page.locator('#toolbar-menu')).not.toHaveClass(/open/)
  })
})
