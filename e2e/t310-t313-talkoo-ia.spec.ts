/**
 * T310/B122/V222 + T313/V225 — talkoolaisen IA: paluupolku hubiin + moodin säilyminen.
 *
 * T310: talkoolainen ei ole umpikujassa — ⋯-valikossa on "🧭 Kaikki pätkät" → /patkat
 *       MOLEMMISSA view-moodeissa (koti JA kartta), sama sessio (ei uutta kirjautumista).
 * T313: view-moodi säilyy saman session refreshissä (sessionStorage per slug); tuore
 *       toinen pätkä alkaa kodista (V174).
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockTalkoolainenSegment } from './helpers/auth'

async function openTalkooSegment(page: import('playwright/test').Page, code = 'TEST01') {
  await mockAuthAsTalkoolainen(page, code)
  await mockTalkoolainenSegment(page, { code, withMarker: true })
  await page.route('/api/faq', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ markdown: '# Info' }) }))
  await page.route(/\/api\/segments$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'seg-e2e', routeIds: ['smtb-30'], startDist: 0, endDist: 100000, assignedCode: code,
        displayName: 'E2E-pätkä', equipment: [], phase: 'asettaminen' },
    ]) }))
  await page.goto(`/s/${code}`)
  await expect.poll(() => page.evaluate(() => document.body.dataset.role), { timeout: 8000 })
    .toBe('talkoolainen')
}

test.describe('T310/V222 — talkoolaisen paluupolku hubiin', () => {
  test('koti-moodi: ⋯ → "🧭 Kaikki pätkät" näkyy ja on /patkat-linkki', async ({ page }) => {
    await openTalkooSegment(page)
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode))
      .toBe('koti')
    await page.locator('#btn-menu').click()
    const link = page.locator('#toolbar-menu .account-menu-patkat')
    await expect(link).toBeVisible()
    await expect(link).toHaveText('🧭 Kaikki pätkät')
    await expect(link).toHaveAttribute('href', '/patkat')
  })

  test('kartta-moodi: ⋯-nappi on käytettävissä ja hub-linkki latautuu kirjautuneena', async ({ page }) => {
    await openTalkooSegment(page)
    await page.locator('#btn-to-map').click()
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode))
      .toBe('kartta')
    // V222: yläpalkin ⋯ ei ole piilotettu karttamoodissa
    await expect(page.locator('#btn-menu')).toBeVisible()
    await page.locator('#btn-menu').click()
    await page.locator('#toolbar-menu .account-menu-patkat').click()
    // Hubi latautuu ILMAN uutta kirjautumista (sessio cookiessa; /api/auth/me → 200)
    await expect(page).toHaveURL(/\/patkat$/)
    await expect(page.locator('.patkat-login-input')).toHaveCount(0)
    await expect(page.locator('.patkat-row-name')).toContainText('E2E-pätkä')
  })

  test('🏠 (moodinvaihto) ja hub-linkki ovat eri kontrolleja — ei kahta "kotia"', async ({ page }) => {
    await openTalkooSegment(page)
    await page.locator('#btn-to-map').click()
    await expect(page.locator('#btn-home-view')).toBeVisible()
    await page.locator('#btn-home-view').click()
    // 🏠 vaihtaa moodin saman pätkän sisällä, EI sivua
    await expect(page).toHaveURL(/\/s\/TEST01$/)
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode))
      .toBe('koti')
  })
})

test.describe('T313/V225 — view-moodi säilyy refreshissä', () => {
  test('Kartalle → reload → kartta näkyvissä (kartta ei jää väärän kokoiseksi)', async ({ page }) => {
    await openTalkooSegment(page)
    await page.locator('#btn-to-map').click()
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode))
      .toBe('kartta')

    await page.reload()
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode), { timeout: 8000 })
      .toBe('kartta')
    await expect(page.locator('#map')).toBeVisible()
    // V176: invalidateSize ajettu → Leaflet-kontti on viewportin levyinen (ei 0-kokoinen)
    const w = await page.locator('#map').evaluate(el => el.getBoundingClientRect().width)
    expect(w).toBeGreaterThan(200)
  })

  test('tuore toinen pätkä alkaa kodista (slug-kohtainen muisti, V174)', async ({ page }) => {
    await openTalkooSegment(page, 'TEST01')
    await page.locator('#btn-to-map').click()
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode))
      .toBe('kartta')

    await mockTalkoolainenSegment(page, { code: 'TEST02', withMarker: true })
    await page.goto('/s/TEST02')
    await expect.poll(() => page.evaluate(() => document.getElementById('app')?.dataset.viewMode), { timeout: 8000 })
      .toBe('koti')
  })
})
