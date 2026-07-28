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
    // T372: osio on haitari (kiinni oletuksena) ∴ otsikko on section-header, ⊥ pelkkä title-div.
    // Laskuri-span (.comment-panel-title) on tyhjä kun huomioita ⊥ ole ∴ tarkistetaan header.
    const header = page.locator('#comment-panel-container .left-panel-section-header')
    await expect(header).toBeVisible()
    await expect(header).toContainText('Huomiot')
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.comment-panel-list')).toBeHidden()
    await header.click()
    await expect(page.locator('.comment-panel-list')).toBeVisible()
  })

  // T366/V264 — TALLENNUS PÄÄSTÄ PÄÄHÄN. Yksikkötestit olivat vihreitä vaikka tallennus oli
  // rikki: vika oli wiringissä (kaksi kolmesta sisääntulosta avasi modaalin ilman
  // luonnospinniä ⇒ sijainti luettiin Leafletin `map.getCenter()`-oliosta, jossa pituusaste
  // on `lng` ⇒ POST lähti ilman `lon`ia). Vain selain näkee koko ketjun.
  for (const entry of ['toolbar', 'hero'] as const) {
    test(`talkoolainen: ${entry}-sisääntulosta tallennettu huomio saa lat+lon`, async ({ page }) => {
      await mockAuthAsTalkoolainen(page)
      await mockTalkoolainenSegment(page, { withMarker: true })

      let posted: { lat?: number; lon?: number; text?: string } | null = null
      await page.route(/\/api\/comments(\?|$)/, async (route) => {
        if (route.request().method() === 'POST') {
          posted = route.request().postDataJSON()
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'c-e2e', targetType: 'point', ...posted, createdAt: new Date().toISOString() }),
          })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })

      await page.goto('/s/TEST01')

      if (entry === 'toolbar') {
        await page.locator('#btn-menu').click()
        await page.locator('#btn-tk-add-note').click()
      } else {
        await page.click('#btn-to-map')
        await page.locator('.segment-view-next-more').click()
        await page.locator('.segment-view-next-note').click()
      }

      // Luonnospinni on kartalla ennen tallennusta — sijainti on siirrettävissä (V264).
      await expect(page.locator('.comment-pin-draft')).toHaveCount(1)

      await page.locator('.comment-point-text').fill('E2E: tämä voisi korjata')
      await page.locator('.comment-point-save').click()

      await expect.poll(() => posted?.text).toBe('E2E: tämä voisi korjata')
      expect(typeof posted!.lat).toBe('number')
      expect(typeof posted!.lon).toBe('number')

      // Lähetä sulkee modaalin ja luonnospinni siivotaan (V264).
      await expect(page.locator('.comment-point-modal')).toHaveCount(0)
      await expect(page.locator('.comment-pin-draft')).toHaveCount(0)
    })
  }
})
