/**
 * T25 — SegmentPanel + segment-overlay E2E
 * Validates: 2-click creation flow (T94: modal-based), segment list, delete
 * T94 note: after two map clicks the creation modal enters 'tiedot' phase —
 *           must click "Tallenna" to actually create the segment.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen } from './helpers/auth'

/** Helper: create a segment via 2-click modal flow + Tallenna */
async function createSegmentViaModal(page: import('playwright/test').Page) {
  // T73: panel collapsed by default — expand before touching its footer button
  await page.locator('.segment-panel-header').click()
  await page.waitForTimeout(200)
  await page.click('#btn-segment-create')
  await page.waitForTimeout(200)

  const routePath = page.locator('.leaflet-overlay-pane path').first()
  const routeBox = await routePath.boundingBox()
  const mapBox = await page.locator('#map').boundingBox()
  if (!routeBox || !mapBox) throw new Error('route path or map not found')

  const midY = Math.round(routeBox.y + routeBox.height * 0.5 - mapBox.y)
  await page.click('#map', { position: { x: Math.round(routeBox.x + routeBox.width * 0.20 - mapBox.x), y: midY } })
  await page.waitForTimeout(300)
  await page.click('#map', { position: { x: Math.round(routeBox.x + routeBox.width * 0.60 - mapBox.x), y: midY } })
  await page.waitForTimeout(300)

  // T94: now in 'tiedot' phase — click Tallenna to confirm
  await page.click('.btn-segment-creation-save')
  await page.waitForTimeout(400)
}

test.describe('T25 — SegmentPanel', () => {
  test('segment-panel on DOM ja näkyy järjestäjälle', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Panel on olemassa — collapsed by default (T73)
    const panel = page.locator('#segment-panel')
    await expect(panel).toBeAttached()
    await expect(panel).toBeVisible()

    // Avaa panel klikkaamalla header
    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)

    // Tyhjä tila näyttää ohjeen
    const emptyEl = panel.locator('.segment-empty')
    await expect(emptyEl).toBeVisible()
  })

  test('talkoolaiselta segment-panel piilotettu (V13)', async ({ page }) => {
    // V13: talkoolainen ei näe järjestäjän UI:ta — autentikoi suoraan talkoolaisena
    await mockAuthAsTalkoolainen(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Talkoolaisella ei segment-panel näkyvissä (data-role="talkoolainen")
    const panel = page.locator('#segment-panel')
    await expect(panel).not.toBeVisible()
  })

  test('kaksi klikkausta + Tallenna luo pätkän (T94 modal flow)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await expect(page.locator('#btn-role')).toHaveText('Järjestäjä')

    // Avaa panel (T73: collapsed by default), sitten luontimodaali
    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    // T94: luontimodaali avautuu heti
    await expect(page.locator('[data-testid="creation-modal"]')).toBeVisible()
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa kartalta aloituspiste')

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    expect(routeBox).not.toBeNull()
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()

    const midY = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)

    // Ensimmäinen klikkaus — vaihe2
    await page.click('#map', { position: { x: Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x), y: midY } })
    await page.waitForTimeout(300)
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa kartalta lopetuspiste')

    // Toinen klikkaus — tiedot-vaihe
    await page.click('#map', { position: { x: Math.round(routeBox!.x + routeBox!.width * 0.60 - mapBox!.x), y: midY } })
    await page.waitForTimeout(300)
    await expect(page.locator('.btn-segment-creation-save')).toBeVisible()

    // Tallenna
    await page.click('.btn-segment-creation-save')
    await page.waitForTimeout(400)

    // Modaali suljettu, pätkä listassa
    await expect(page.locator('[data-testid="creation-modal"]')).not.toBeAttached()
    const items = page.locator('#segment-list .segment-item')
    await expect(items).toHaveCount(1)
    // T142/B61: .segment-km näyttää nyt status-lukumäärän, km-alue on title-attribuutissa (hover)
    const kmSpan = items.first().locator('.segment-km')
    await expect(kmSpan).toContainText('ei merkkejä')
    expect(await kmSpan.getAttribute('title')).toContain('km')
  })

  test('T56a — ensimmäisen klikkauksen jälkeen circleMarker kartalla (T94)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    await expect(page.locator('.segment-creation-marker')).toHaveCount(0)

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    await page.click('#map', { position: {
      x: Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x),
      y: Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y),
    }})
    await page.waitForTimeout(300)

    // T94: modal now shows vaihe2 instruction
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa kartalta lopetuspiste')
    await expect(page.locator('.segment-creation-marker')).toHaveCount(1)
  })

  test('T56a — Esc peruuttaa luonnin ja sulkee modaalin (T94)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    await expect(page.locator('[data-testid="creation-modal"]')).toBeVisible()

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    await page.click('#map', { position: {
      x: Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x),
      y: Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y),
    }})
    await page.waitForTimeout(300)

    await expect(page.locator('.segment-creation-marker')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await expect(page.locator('[data-testid="creation-modal"]')).not.toBeAttached()
    await expect(page.locator('.segment-creation-marker')).toHaveCount(0)
  })

  test('T56b — "Muokkaa pisteitä" -nappi näkyy SegmentDetailsModalissa (siirretty T77-modaaliin)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await page.evaluate(() => {
      const paths = document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path')
      const last = paths[paths.length - 1]
      if (last) last.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)

    const editBtn = page.locator('.btn-segment-edit-pts-modal')
    await expect(editBtn).toBeVisible()
    await expect(editBtn).toHaveText('Muokkaa pisteitä kartalla')
  })

  test('T77 — klikkaus pätkän polylineen avaa SegmentDetailsModal', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await page.evaluate(() => {
      const paths = document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path')
      const last = paths[paths.length - 1]
      if (last) last.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)

    await expect(page.locator('.segment-details-modal-backdrop')).toBeVisible()
    await expect(page.locator('.segment-details-modal')).toBeVisible()
  })

  test('T77 — Esc sulkee SegmentDetailsModal', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await page.evaluate(() => {
      const paths = document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path')
      const last = paths[paths.length - 1]
      if (last) last.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)

    await expect(page.locator('.segment-details-modal-backdrop')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    await expect(page.locator('.segment-details-modal-backdrop')).not.toBeVisible()
  })

  test('pätkän voi poistaa listasta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await expect(page.locator('.segment-item')).toHaveCount(1)

    // Poisto siirretty SegmentDetailsModaliin (T77) — avaa se ja hyväksy confirm()
    page.once('dialog', dialog => dialog.accept())
    await page.evaluate(() => {
      const paths = document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path')
      const last = paths[paths.length - 1]
      if (last) last.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)
    await page.click('.btn-segment-delete-modal')
    await page.waitForTimeout(300)

    await expect(page.locator('.segment-empty')).toBeVisible()
  })

  // T141/B61/V88: main.ts wiring regression guard — T95 died silently this exact way (B60).
  // Status-lukumäärä näkyy suoraan pätkäjako-listan rivillä (.segment-km), ei enää erillisenä kartan-alle-palkkina.
  test('pätkärivi näyttää status-lukumäärän km-alueen tilalla (T141/B61)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    const kmSpan = page.locator('.segment-item .segment-km').first()
    await expect(kmSpan).toBeVisible()
    await expect(kmSpan).toContainText('ei merkkejä')
  })

  // T147: tarkastus-vaiheen pätkäjako (luotu T146:n klooni-mekanismilla) näyttää
  // talkoolaisen segment-view:ssä tarkastus-UI:n numeerisen X/N-progressin sijaan.
  test('tarkastus-segmentti näyttää segment-view:ssä "Merkitse tarkastetuksi" -UI:n', async ({ page }) => {
    const MOCK_TARKASTUS_SEGMENT = {
      id: 'seg-tarkastus-1', routeIds: ['35km'],
      startDist: 0, endDist: 12500,
      displayName: 'Tarkastuspätkä', equipment: [],
      phase: 'tarkastus', assignedCode: 'INSP01', inspected: false,
    }
    await page.route('/api/segments/by-code/INSP01', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TARKASTUS_SEGMENT) }))
    await page.route('/api/markers', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }))

    await mockAuthAsTalkoolainen(page, 'INSP01')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/s/INSP01')
    await page.waitForTimeout(1500)

    const inspectSection = page.locator('.segment-view-inspect')
    await expect(inspectSection).toBeVisible()
    await expect(page.locator('.segment-view-inspect-status')).toHaveText('Ei vielä tarkastettu')
    await expect(page.locator('.btn-mark-inspected')).toHaveText('Merkitse tarkastetuksi')
  })
})
