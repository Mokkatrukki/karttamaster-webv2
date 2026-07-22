/**
 * Sprint E2E — T42/T49/T15/T28/T38
 * Validoi demo-sprintin featuuret selaimessa.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen, mockTemplates, mockMarkers, mockTalkoolainenSegment } from './helpers/auth'

test.describe('T28 — Status panel (tilannekuva)', () => {
  test('näkyy järjestäjälle toolbarin alla', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Varmista järjestäjä-rooli (default)
    expect(await page.evaluate(() => document.body.dataset.role)).toBe('järjestäjä')

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

    expect(await page.evaluate(() => document.body.dataset.role)).toBe('talkoolainen')

    // Status panel piilotettu
    const panel = page.locator('#status-panel')
    await expect(panel).not.toBeVisible()
  })

  test('päivittyy kun merkki lisätään', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
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
  // Robustoitu 2026-07-10: pudotettu flaky dblclick→picker-marker-luonti (headless-chromium ei
  // rekisteröi Leaflet-dblclickia luotettavasti, ks. flaky-e2e-tests-muisti). Merkki seedataan
  // /api/markers-mockilla → testaa aidon invariantin (type-select roolin mukaan) DOM-polulla:
  // #btn-list (aina toolbarissa, ei enää turha #btn-menu) → .marker-item → detail-modaali.
  const seededMarker = {
    id: 'mk-t38', type: 'right', lat: 65.62, lon: 27.62, distance_from_start: 5000,
    route_ids: ['35km'], status: 'suunniteltu', location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }

  test('järjestäjä näkee type-selectin merkin detail-modaalissa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
    await mockMarkers(page, [seededMarker])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.locator('#auth-screen')).not.toHaveClass(/open/)

    // T277/B110: `#auth-screen` menettää `open`-luokan (auth-screen.hide()) ENNEN kuin
    // `init()` awaittaa fetchMarkers+loadGpx ja kiinnittää `#btn-list`-handlerin. Race →
    // ensimmäinen klikki voi kadota ennen handleria/merkkien latausta ja `.marker-item`
    // jää renderöimättä (flaky, 1/3). Retry avaus kunnes lista on auki — deterministinen.
    await expect(async () => {
      await page.click('#btn-list')
      await expect(page.locator('.marker-item')).toHaveCount(1, { timeout: 1000 })
    }).toPass({ timeout: 15000 })
    await page.click('.marker-item')

    // Type-select näkyy järjestäjälle
    const sel = page.locator('.marker-detail-type-select')
    await expect(sel).toHaveCount(1)
    await expect(sel).toHaveValue('right')
  })

  test('talkoolainen ei näe type-selectiä', async ({ page }) => {
    // V27: talkoolaisen pätkä tulee URL-polusta /s/<koodi>, ei /api/auth/me-mockista.
    await mockAuthAsTalkoolainen(page)
    await mockTemplates(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/s/TEST01')
    await expect(page.locator('#auth-screen')).not.toHaveClass(/open/)
    expect(await page.evaluate(() => document.body.dataset.role)).toBe('talkoolainen')

    // T264/V184: talkoolaisen "Kaikki merkit" = koti-tab (yläpalkin #btn-list piilotettu).
    await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
    await page.locator('.segment-view-markers-row').first().click()

    // Ei type-selectiä talkoolaiselle
    await expect(page.locator('.marker-detail-type-select')).toHaveCount(0)
  })
})

test.describe('Touch targets — sprint features', () => {
  test('uudet elementit eivät riko 44px touch-vaatimusta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
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
