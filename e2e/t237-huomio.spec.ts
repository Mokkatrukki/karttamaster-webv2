import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockAuthAsJarjestaja, mockTalkoolainenSegment } from './helpers/auth'

// T237/V245 — huomio-sisääntulot. Diagnostiikkatesti: käyttäjä ⊥ löytänyt "💬 Huomio" -riviä
// kentältä, ja jsdom-testit menivät silti läpi ∴ vika on renderin ja NÄKYVYYDEN välissä
// (rooli-piilotus, moodi, valikon tila) — juuri se rako jota vain selain näyttää.

test.describe('T237 — huomio-sisääntulot selaimessa', () => {
  test('talkoolainen: yläpalkin ⋯ sisältää "💬 Huomio" ja se on näkyvä', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.goto('/s/TEST01')

    const btn = page.locator('#btn-tk-add-note')
    await expect(btn).toHaveCount(1)

    // Avaa ⋯-valikko (yläpalkki).
    await page.locator('#btn-menu').click()
    await expect(btn).toBeVisible()
  })

  test('talkoolainen: hero-⋯ sisältää "💬 Huomio"', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.goto('/s/TEST01')

    // Hero elää kartta-moodissa (koti on oletus, V174) → siirry kartalle.
    await page.click('#btn-to-map')

    await page.locator('.segment-view-next-more').click()
    await expect(page.locator('.segment-view-next-note')).toBeVisible()
  })

  test('järjestäjä: sivupalkissa on Huomiot-osio', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.goto('/')
    await expect(page.locator('#comment-panel-container')).toHaveCount(1)
    await expect(page.locator('.comment-panel-title')).toBeVisible()
  })
})
