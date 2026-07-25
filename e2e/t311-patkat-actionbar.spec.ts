/**
 * T311 / V223 — /patkat-hubin primary "Kartalle →" sticky-toimintopalkissa.
 * 12 pätkän lista mobiilissa (375×667): nappi on viewportissa ILMAN skrollausta, ja pohjaan
 * scrollattuna se ei peitä viimeistä pätkäriviä (V157/B101: ei orpoa gappia, ei peitettyä sisältöä).
 */
import { test, expect, type Page } from 'playwright/test'

const VP = { width: 375, height: 667 }

async function mockHub(page: Page, count: number): Promise<void> {
  await page.route('/api/auth/me', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'talkoolainen', display_name: 'Talkoolainen' }) }))
  await page.route('/api/faq', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ markdown: '' }) }))
  const segments = Array.from({ length: count }, (_, i) => ({
    id: `s${i}`, routeIds: ['smtb-30'], startDist: i * 1000, endDist: (i + 1) * 1000,
    assignedCode: `PATKA-${i + 1}`, slug: `patka-${i + 1}`, displayName: `Pätkä ${i + 1}`,
    equipment: [], phase: 'asettaminen',
  }))
  await page.route(/\/api\/segments$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(segments) }))
  await page.route(/\/api\/markers(\?|$)/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

test('T311/V223 — 12 pätkän lista: "Kartalle →" viewportissa ilman skrollausta (375×667)', async ({ page }) => {
  await mockHub(page, 12)
  await page.setViewportSize(VP)
  await page.goto('/patkat')
  await expect(page.locator('.patkat-row-name').first()).toBeVisible()

  // Lista on pidempi kuin ruutu → ilman sticky-palkkia nappi olisi taittorajan alla.
  const pageScroll = await page.evaluate(() =>
    document.documentElement.scrollHeight - document.documentElement.clientHeight)
  expect(pageScroll).toBeGreaterThan(0)

  // Primary näkyvissä HETI, ilman scrollausta.
  const btn = page.locator('.patkat-to-map')
  const bar = page.locator('.patkat-actionbar')
  await expect(bar).toBeVisible()
  await expect(btn).toBeInViewport()
  const box = await btn.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(VP.height + 1)
  expect(box!.height).toBeGreaterThanOrEqual(44) // DESIGN §R touch

  // Sticky: palkki pysyy alalaidassa myös keskellä scrollia.
  await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight / 2)))
  await expect(btn).toBeInViewport()

  // Pohjassa: palkki ei peitä viimeistä pätkäriviä (palkki on flow'ssa listan JÄLKEEN).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(150)
  const lastRow = page.locator('.patkat-row').last()
  const rowBox = await lastRow.boundingBox()
  const barBox = await bar.boundingBox()
  expect(rowBox).not.toBeNull()
  expect(barBox).not.toBeNull()
  expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(barBox!.y + 1)
})

test('T311/V157 — lyhyt lista: ei orpoa gappia palkin alla', async ({ page }) => {
  await mockHub(page, 2)
  await page.setViewportSize(VP)
  await page.goto('/patkat')
  await expect(page.locator('.patkat-to-map')).toBeVisible()

  // Palkki on sisällön mukana (ei sivun pohjaan naulattu tyhjän tilan taakse).
  const bar = await page.locator('.patkat-actionbar').boundingBox()
  const list = await page.locator('.patkat-list-section').boundingBox()
  expect(bar!.y).toBeGreaterThan(list!.y)
  // Sivun oma alapadding nollattu palkin läsnäollessa → ei kuollutta tilaa palkin alla.
  const gap = await page.locator('.patkat-page').evaluate(el =>
    parseFloat(getComputedStyle(el).paddingBottom))
  expect(gap).toBe(0)
})
