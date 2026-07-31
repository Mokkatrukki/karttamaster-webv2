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

  // T434/V321: valitsin on KATSELUSUODIN. Jos se joskus taas kirjoittaa serverille,
  // järjestäjän vilkaisu siirtää koko talkooporukan toiseen vaiheeseen — tämä on se vahti.
  test('valinta ei kirjoita serverille & pilleri kertoo eron', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })

    const phaseWrites: string[] = []
    page.on('request', req => {
      if (req.url().includes('/api/phase') && req.method() !== 'GET') phaseWrites.push(req.method())
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.click('#btn-menu')
    await expect(page.locator('.phase-switcher-pill')).toBeHidden()

    await page.locator('.phase-switcher-select').selectOption('purku')
    await page.waitForTimeout(300)

    expect(phaseWrites).toEqual([])
    const pill = page.locator('.phase-switcher-pill')
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('Katselet: Purku')
    await expect(pill).toContainText('käynnissä: Asetus')

    await pill.click()
    await expect(pill).toBeHidden()
    await expect(page.locator('.phase-switcher-select')).toHaveValue('asettaminen')
    expect(phaseWrites).toEqual([])
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
