/**
 * T315 / B123 / V226 — koti-moodin pätkänäkymä on RAJATTU scroll-alue.
 * Regressio: `#app[data-view-mode="koti"] #segment-view{max-height:none}` kasvatti elementin
 * sisällön mukaan ∴ sen oma overflow-y ei aktivoitunut, eikä yksikään esivanhempi tarjonnut
 * scrolleria (#map-area overflow:hidden, sivukuori overflow:hidden V187b) → "Kaikki merkit"
 * -listan alimmat rivit jäivät tavoittamattomiin MOLEMMILLA laitteilla.
 * Todiste: 30 merkin pätkä → viimeinen .segment-view-markers-item tavoitettavissa scrollilla
 * 375×667 JA 1280×720, ja kartta-moodin mitoitus (46vh, absolute-container) ei regressoi.
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'

const CODE = 'SCROLL1'
const MANY = 30

async function mockBigSegment(page: Page): Promise<void> {
  const seg = {
    id: 'seg-scroll', routeIds: ['smtb-30'], startDist: 0, endDist: 40000,
    assignedCode: CODE, displayName: 'Scrollipätkä', description: '', equipment: [],
    phase: 'asettaminen', inspected: false, completed: false,
  }
  const markers = Array.from({ length: MANY }, (_, i) => ({
    id: `mk-${i}`, type: i % 2 ? 'right' : 'left', lat: 65.6 + i * 0.001, lon: 27.6 + i * 0.001,
    distance_from_start: 1000 + i * 1000, route_ids: ['smtb-30'], status: 'suunniteltu',
    location_note: null, color: null, label: `Merkki ${i + 1}`, icon_id: null, image_id: null,
    template_id: null, parts_json: null, description: null, images: [], created_by: null,
  }))
  await page.route(new RegExp(`/api/segments/by-code/${CODE}$`), r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seg) }))
  await page.route(/\/api\/markers(\?|$)/, r => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(markers) })
    }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
}

/** Sivukuori ei koskaan scrollaa (V187b) → sisällön täytyy scrollata #segment-viewin sisällä. */
async function assertShellDoesNotScroll(page: Page): Promise<void> {
  const shell = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    bodyScroll: document.body.scrollHeight - document.body.clientHeight,
  }))
  expect(shell.docScroll).toBeLessThanOrEqual(1)
  expect(shell.bodyScroll).toBeLessThanOrEqual(1)
}

for (const vp of [
  { name: 'mobiili 375×667', width: 375, height: 667 },
  { name: 'desktop 1280×720', width: 1280, height: 720 },
]) {
  test(`T315/V226 — koti-moodi: 30 merkin lista scrollaa, viimeinen rivi tavoitettavissa (${vp.name})`, async ({ page }) => {
    await mockAuthAsTalkoolainen(page, CODE)
    await mockBigSegment(page)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(`/s/${CODE}`)
    await page.waitForTimeout(1500)

    await expect(page.locator('#app')).toHaveAttribute('data-view-mode', 'koti')
    await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
    const items = page.locator('.segment-view-markers-item')
    await expect(items).toHaveCount(MANY)

    // (1) #segment-view on OMA scrolleri: korkeus mahtuu viewportiin & sisältö ylittää sen.
    const sv = page.locator('#segment-view')
    const metrics = await sv.evaluate(el => ({
      client: el.clientHeight,
      scroll: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    expect(metrics.overflowY).toBe('auto')
    expect(metrics.client).toBeLessThanOrEqual(vp.height)
    expect(metrics.scroll).toBeGreaterThan(metrics.client)

    // (2) Sivukuori ei tarjoa vaihtoehtoista scrolleria.
    await assertShellDoesNotScroll(page)

    // (3) Viimeinen rivi tavoitettavissa scrollilla JA näkyvissä viewportissa.
    const last = items.last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    const box = await last.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1)

    // (4) "Kartalle →" jää scrollerin ULKOPUOLELLE → aina näkyvissä myös pohjaan scrollattuna.
    await expect(page.locator('#btn-to-map')).toBeVisible()
  })

  test(`T315 — kartta-moodin mitoitus ei regressoi (${vp.name})`, async ({ page }) => {
    await mockAuthAsTalkoolainen(page, CODE)
    await mockBigSegment(page)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(`/s/${CODE}`)
    await page.waitForTimeout(1500)

    await page.click('#btn-to-map')
    await expect(page.locator('#app')).toHaveAttribute('data-view-mode', 'kartta')

    const css = await page.locator('#segment-view-container').evaluate(el => getComputedStyle(el).position)
    expect(css).toBe('absolute')
    const svHeight = await page.locator('#segment-view').evaluate(el => el.getBoundingClientRect().height)
    expect(svHeight).toBeLessThanOrEqual(vp.height * 0.46 + 2)
    await expect(page.locator('#map')).toBeVisible()
  })
}

test('T315/V226 — koti-tabin vaihto nollaa jaetun scrollerin (uusi tabi ei avaudu keskeltä)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page, CODE)
  await mockBigSegment(page)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)

  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
  await page.locator('#segment-view').evaluate(el => { el.scrollTop = el.scrollHeight })
  expect(await page.locator('#segment-view').evaluate(el => el.scrollTop)).toBeGreaterThan(0)

  // T380/V275: vaihto Varustelista-tabiin (Kommentit-tab poistettu) — vahti koskee TAB-VAIHTOA,
  // ⊥ tiettyä tabia ∴ mikä tahansa toinen tabi todistaa saman scroller-nollauksen.
  await page.locator('.segment-koti-tab[data-tab="varuste"]').click()
  expect(await page.locator('#segment-view').evaluate(el => el.scrollTop)).toBe(0)
})
