/**
 * T117 E2E — V69: MapRectEditor exit + polygon click guard
 * Vaatii dev-serverin (bun run dev) ja Chromium.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

const MOCK_AREA = {
  id: 'area-e2e-01',
  name: 'Testihuolto',
  centerLat: 65.6277,   // GPX-reittien läheisyydessä → näkyy fitBounds-viewissä
  centerLng: 27.6275,
  widthM: 500,
  heightM: 300,
  rotation: 0,
  markdownDescription: '',
  status: 'suunniteltu',
  hashCode: 'testhash',
  features: [],
}

async function setupMocks(page: import('playwright/test').Page) {
  await mockAuthAsJarjestaja(page)
  await page.route('/api/areas', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_AREA]) })
  )
  await page.route('/api/markers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/segments', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

test.describe('T117 — V69: MapRectEditor edit exit + polygon guard', () => {
  test('dblclick alue-polygoni → nurkkahandlet ilmestyvät', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Odota kunnes polygon on renderöity koordinaateilla (ei vain "M0 0")
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.area-polygon')
        return el && el.getAttribute('d') !== 'M0 0' && el.getAttribute('d') !== ''
      },
      { timeout: 8000 },
    )

    const poly = page.locator('.area-polygon').first()

    // Ennen editiä: ei nurkkahandleja
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)

    // dblclick polygonin kulmassa — drag-handle on centerissä, reunassa on vapaa
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)
  })

  async function waitForAreaRendered(page: import('playwright/test').Page) {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.area-polygon')
        return el && el.getAttribute('d') !== 'M0 0' && el.getAttribute('d') !== ''
      },
      { timeout: 8000 },
    )
  }

  // Dblclick polygonin reunaan (ei centeriin missä drag-handle on)
  async function dblclickPolyEdge(page: import('playwright/test').Page, poly: import('playwright/test').Locator) {
    const box = await poly.boundingBox()
    if (!box) throw new Error('polygon bounding box null')
    // Klikkaa top-left-kulmaa (+4px sisälle) — kaukana center drag-handlesta
    await page.mouse.dblclick(box.x + 4, box.y + 4)
  }

  test('edit-tilassa karttaklikki → handleit katoavat (V69)', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)

    const poly = page.locator('.area-polygon').first()

    // Aktivoi edit
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    // Klikkaa tyhjää kohtaa polygonin yläpuolella — page.click('#map', {position}) rekisteröityy
    // Leafletin map-clickinä (toisin kuin raaka page.mouse.click nurkkaan, joka osui kontrolliin/paneeliin).
    // Vältetään zoom-kontrolli (oikea ylänurkka T191) ja polygoni: klikataan vasenta ylälaitaa.
    const mapBox = await page.locator('#map').boundingBox()
    const polyBox = await poly.boundingBox()
    if (!mapBox || !polyBox) throw new Error('map or polygon element not found')
    const clickX = 40 // vasen laita, kaukana zoom-kontrollista ja polygonin keskeltä
    const clickY = Math.max(40, Math.round(polyBox.y - mapBox.y - 40)) // polygonin yläpuolella
    await page.click('#map', { position: { x: clickX, y: clickY } })
    await page.waitForTimeout(500)

    // Handleit poistuvat
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)
  })

  test('edit-tilassa Esc → handleit katoavat', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)

    const poly = page.locator('.area-polygon').first()

    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)
  })

  test('edit-tilassa polygon-klikki ei avaa modaalia (V69)', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)

    const poly = page.locator('.area-polygon').first()

    // Aktivoi edit
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    // Klikki polygonilla — V69: modaali ei saa aueta edit-tilassa
    await poly.click({ force: true })
    await page.waitForTimeout(500)
    await expect(page.locator('.area-details-modal')).toHaveCount(0)
  })
})
