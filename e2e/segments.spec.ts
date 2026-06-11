/**
 * T25 — SegmentPanel + segment-overlay E2E
 * Validates: 2-click creation flow, segment list, delete
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

test.describe('T25 — SegmentPanel', () => {
  test('segment-panel on DOM ja näkyy järjestäjälle', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Järjestäjä on default rooli
    await expect(page.locator('#btn-role')).toHaveText('Järjestäjä')

    // Panel on olemassa
    const panel = page.locator('#segment-panel')
    await expect(panel).toBeAttached()
    await expect(panel).toBeVisible()

    // Tyhjä tila näyttää ohjeen
    const emptyEl = panel.locator('.segment-empty')
    await expect(emptyEl).toBeVisible()
  })

  test('talkoolaiselta panel piilotettu', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Vaihda talkoolaiseksi
    await page.click('#btn-role')
    await expect(page.locator('#btn-role')).toHaveText('Talkoolainen')

    const panel = page.locator('#segment-panel')
    await expect(panel).not.toBeVisible()
  })

  test('kaksi klikkausta reitillä luo pätkän', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Järjestäjärooli varmistettu
    await expect(page.locator('#btn-role')).toHaveText('Järjestäjä')

    // Aloita luomismoodi
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    // Statusviesti näkyy: "1. piste"
    const status = page.locator('.segment-panel-status')
    await expect(status).toBeVisible()
    await expect(status).toContainText('1. piste')

    // Hae reittipolun bounding box ensimmäistä klikkausta varten
    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    expect(routeBox).not.toBeNull()
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()

    // Ensimmäinen klikkaus reitillä (20% leveydestä)
    const click1X = Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x)
    const click1Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click1X, y: click1Y } })
    await page.waitForTimeout(300)

    // Statusviesti päivittynyt: "2. piste"
    await expect(status).toContainText('2. piste')

    // Toinen klikkaus reitillä (50% leveydestä)
    const click2X = Math.round(routeBox!.x + routeBox!.width * 0.50 - mapBox!.x)
    const click2Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click2X, y: click2Y } })
    await page.waitForTimeout(300)

    // Statusviesti piilotettu (creation done)
    await expect(status).not.toBeVisible()

    // Pätkä ilmestyy listaan
    const list = page.locator('#segment-list')
    await expect(list).toBeVisible()
    const items = list.locator('.segment-item')
    await expect(items).toHaveCount(1)

    // Pätkä-rivi sisältää km-tiedon
    const infoText = await items.first().locator('.segment-info').innerText()
    expect(infoText).toContain('km')
  })

  test('T56a — ensimmäisen klikkauksen jälkeen circleMarker kartalla', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    // Ennen klikkausta ei creation-markeria
    await expect(page.locator('.segment-creation-marker')).toHaveCount(0)

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    const click1X = Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x)
    const click1Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click1X, y: click1Y } })
    await page.waitForTimeout(300)

    // Statusviesti: "2. piste" (ensimmäinen ok)
    await expect(page.locator('.segment-panel-status')).toContainText('2. piste')

    // CircleMarker ilmestyi
    await expect(page.locator('.segment-creation-marker')).toHaveCount(1)
  })

  test('T56a — Esc peruuttaa luonnin ja poistaa circleMarkerin', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    const click1X = Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x)
    const click1Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click1X, y: click1Y } })
    await page.waitForTimeout(300)

    // Creation marker näkyy
    await expect(page.locator('.segment-creation-marker')).toHaveCount(1)

    // Esc peruuttaa
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await expect(page.locator('.segment-panel-status')).not.toBeVisible()
    // CircleMarker poistettu
    await expect(page.locator('.segment-creation-marker')).toHaveCount(0)
  })

  test('T56b — "Muokkaa pisteitä" -nappi näkyy pätkärivillä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Luo pätkä
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    await page.click('#map', { position: {
      x: Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x),
      y: Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y),
    }})
    await page.waitForTimeout(300)

    await page.click('#map', { position: {
      x: Math.round(routeBox!.x + routeBox!.width * 0.50 - mapBox!.x),
      y: Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y),
    }})
    await page.waitForTimeout(300)

    // Pätkä luotu — tarkista nappi
    const editBtn = page.locator('.btn-segment-edit-pts')
    await expect(editBtn).toBeVisible()
    await expect(editBtn).toHaveText('Muokkaa pisteitä')
  })

  test('pätkän voi poistaa listasta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Luo pätkä (duplikoi luontiflow)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()

    const click1X = Math.round(routeBox!.x + routeBox!.width * 0.20 - mapBox!.x)
    const click1Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click1X, y: click1Y } })
    await page.waitForTimeout(300)

    const click2X = Math.round(routeBox!.x + routeBox!.width * 0.50 - mapBox!.x)
    const click2Y = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: click2X, y: click2Y } })
    await page.waitForTimeout(300)

    // Pätkä luotu
    await expect(page.locator('.segment-item')).toHaveCount(1)

    // Poista
    await page.click('.btn-segment-delete')
    await page.waitForTimeout(200)

    // Lista tyhjä taas
    await expect(page.locator('.segment-empty')).toBeVisible()
  })
})
