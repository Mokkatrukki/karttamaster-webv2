/**
 * T309 / V220+V221 (B121) — talkoolaisen merkin siirto ei saa hävittää "Seuraava merkki"
 * -alapalkkia. Serveri hylkää oman pätkän ulkopuolelle siirron 403:lla (V150); client palauttaa
 * merkin entiseen paikkaan → hero (.segment-view-next) pysyy näkyvissä JA merkki pysyy
 * raahattavana (.leaflet-marker-draggable) ∴ tilanne on peruutettavissa ilman reloadia.
 *
 * T307/V218: kartta avautuu KATSELUTILASSA ∴ raahaus vaatii muokkaustilan — talkoolainen avaa
 * sen ⋯-valikon #btn-tk-map-mode -togglesta (enterEditMode alla).
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockTemplates } from './helpers/auth'

const CODE = 'DRG01'

const SEG = {
  id: 'seg-drag', routeIds: ['smtb-30'], primaryRouteId: 'smtb-30',
  startDist: 0, endDist: 20000,
  assignedCode: CODE, displayName: 'Raahauspätkä', description: '', equipment: [],
  phase: 'asettaminen', inspected: false, completed: false,
}

const MARKER = {
  id: 'm-drag', type: 'right', lat: 65.6, lon: 27.6,
  distance_from_start: 2000, distance_by_route: { 'smtb-30': [2000] },
  route_ids: ['smtb-30'], status: 'suunniteltu', label: 'Raahattava',
  location_note: null, color: null, icon_id: null, image_id: null,
  template_id: null, parts_json: null, description: null, images: [], created_by: null,
}

async function mockSegment(page: Page, putStatus: number): Promise<void> {
  await page.route(new RegExp(`/api/segments/by-code/${CODE}$`), r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEG) }))
  await page.route(/\/api\/markers(\/[^/]+)?(\?|$)/, r => {
    const method = r.request().method()
    if (method === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MARKER]) })
    }
    if (method === 'PUT') {
      return r.fulfill({ status: putStatus, contentType: 'application/json', body: JSON.stringify({ error: 'segment_range' }) })
    }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
}

/** T307/V218: talkoolaisen muokkaustila ⋯-valikosta — raahaus on sen alla. */
async function enterEditMode(page: Page): Promise<void> {
  // `title` ilmestyy vasta kun initMapModeToggle on kytkenyt kuuntelijan → klikki ei katoa tyhjään.
  await expect(page.locator('#btn-tk-map-mode')).toHaveAttribute('title', /muokkaustila/i)
  await page.click('#btn-menu')
  await page.click('#btn-tk-map-mode')
  await expect(page.locator('body')).toHaveAttribute('data-map-mode', 'muokkaus')
  await expect(page.locator('#map-mode-pill')).toBeVisible()
}

/**
 * Kartta-moodissa hero-alapalkki (46vh) ja palautewidget peittävät ruudun alaosan. Seedattu merkki
 * osuu 375×667:llä juuri sinne (y≈590) ∴ raahaus tartuttaisi napin, ei merkkiä. Panoroi karttaa
 * ylöspäin kunnes merkki on vapaalla alueella — geometria, ei sovelluslogiikkaa.
 */
async function ensureMarkerClearOfChrome(page: Page): Promise<void> {
  const icon = page.locator('.leaflet-marker-icon').first()
  await expect(icon).toBeVisible()
  for (let i = 0; i < 4; i++) {
    const box = (await icon.boundingBox())!
    const cy = box.y + box.height / 2
    // elementFromPoint palauttaa merkin SISÄelementin (ikonin div/img) ∴ closest, ei classList.
    const topmost = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number)
      return !!el?.closest('.leaflet-marker-icon')
    }, [box.x + box.width / 2, cy])
    if (topmost && cy < 380) return
    // Panorointi: raahaa tyhjää karttaa ylöspäin → sisältö (ja merkki) nousee.
    await page.mouse.move(300, 300)
    await page.mouse.down()
    await page.mouse.move(300, 220, { steps: 5 })
    await page.mouse.move(300, 140, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(400)
  }
  throw new Error('merkkiä ei saatu vapaalle alueelle panoroimalla')
}

/** Raahaa ensimmäinen kartta-merkki dx/dy pikseliä. */
async function dragMarker(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const icon = page.locator('.leaflet-marker-icon').first()
  await expect(icon).toBeVisible()
  const box = (await icon.boundingBox())!
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 })
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  return from
}

test('T309/V220 — serverin 403 palauttaa merkin: hero säilyy & merkki yhä raahattava', async ({ page }) => {
  await mockAuthAsTalkoolainen(page, CODE)
  await mockTemplates(page)
  await mockSegment(page, 403)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  await page.click('#btn-to-map') // hero = kartta-moodin ohjaus (V182)

  const hero = page.locator('.segment-view-next')
  await expect(hero).toBeVisible()

  await ensureMarkerClearOfChrome(page)
  await enterEditMode(page)
  const before = await dragMarker(page, 120, 60)

  // 1) hero EI katoa (B121:n oire) …
  await expect(hero).toBeVisible()
  // 2) … merkki pysyy raahattavana (setDraggablePredicate ei pudottanut sitä pätkästä) …
  const icon = page.locator('.leaflet-marker-icon').first()
  await expect(icon).toHaveClass(/leaflet-marker-draggable/)
  // 3) … ja se on visuaalisesti palannut lähtöpaikkaansa (rollback, ±8px)
  const after = (await icon.boundingBox())!
  expect(Math.abs(after.x + after.width / 2 - before.x)).toBeLessThan(8)
  expect(Math.abs(after.y + after.height / 2 - before.y)).toBeLessThan(8)
  // 4) hylkäys näkyy käyttäjälle, ei hiljaisesti
  await expect(page.locator('#distance-warning')).toContainText(/palautettiin|estetty/i)
})

test('T309/V221 — hyväksytty siirto jää voimaan ja hero pysyy näkyvissä', async ({ page }) => {
  await mockAuthAsTalkoolainen(page, CODE)
  await mockTemplates(page)
  await mockSegment(page, 200)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  await page.click('#btn-to-map')

  const hero = page.locator('.segment-view-next')
  await expect(hero).toBeVisible()

  await ensureMarkerClearOfChrome(page)
  await enterEditMode(page)
  const before = await dragMarker(page, 60, 30)

  await expect(hero).toBeVisible()
  const icon = page.locator('.leaflet-marker-icon').first()
  await expect(icon).toHaveClass(/leaflet-marker-draggable/)
  const after = (await icon.boundingBox())!
  // ei rollbackia: merkki jäi uuteen paikkaan
  expect(Math.abs(after.x + after.width / 2 - before.x)).toBeGreaterThan(20)
})
