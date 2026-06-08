/**
 * T46 — Kriittiset E2E-polut
 * Kolme polkua jotka vaativat oikean selaimen (Leaflet + DOM yhdessä):
 *   1. Merkki asetetaan kartalle → näkyy merkkilistassa
 *   2. Drive mode käynnistyy + navigoi eteenpäin
 *   3. Rooli-toggle muuttaa toolbaria
 */
import { test, expect } from 'playwright/test'

// Dev-server pyörii ulkopuolella (bun run dev) — playwright.config.ts baseURL

test.describe('Merkki kartalle', () => {
  test('toolbar-dropdown → map click → näkyy listassa', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Avaa dropdown
    await page.click('#btn-add-sign')
    await page.waitForTimeout(300)

    // Valitse tyyppi
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(300)

    // Odota place mode (cursor muuttuu crosshairiksi)
    await expect(page.locator('#map')).toHaveClass(/place-mode/)

    // Klikkaa suoraan SVG-reittipolun päälle (Leaflet polyline)
    // Ensimmäinen SVG path = orange 55km reitti — bounding box antaa koordinaatin
    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    expect(routeBox).not.toBeNull()
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    // Klikkaa reitin bounding boxin vasenta puolta (missä viiva kulkee)
    const clickX = Math.round(routeBox!.x + routeBox!.width * 0.15 - mapBox!.x)
    const clickY = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: clickX, y: clickY }, timeout: 10000 })
    await page.waitForTimeout(800)

    // Tarkista localStorage — merkki tallennettu
    const ls = await page.evaluate(() => localStorage.getItem('karttamaster-markers'))
    const data = ls ? JSON.parse(ls) : { markers: [] }
    expect(data.markers.length).toBeGreaterThan(0)

    const marker = data.markers[0]
    // T44 ✓: routeIds aina non-empty (V21 — ensureRouteIds fallback)
    expect(marker.routeIds.length).toBeGreaterThan(0)

    // Lista näyttää merkin (T44 ✓)
    await page.click('#btn-list')
    await page.waitForTimeout(300)
    const listText = await page.locator('#marker-modal').innerText()
    expect(listText).not.toContain('Ei merkkejä')
  })

  test('dblclick kartalla avaa floating pickerin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)

    // Floating picker näkyy
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    const pickerText = await page.locator('#floating-picker').innerText()
    expect(pickerText).toContain('Oikealle')
    expect(pickerText).toContain('Vasemmalle')

    // Escape sulkee pickerin
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await expect(page.locator('#floating-picker')).not.toHaveClass(/open/)
  })
})

test.describe('Drive mode', () => {
  test('käynnistyy + navigoi eteenpäin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Alkutila: 0.00 km
    const initialKm = await page.locator('#route-km').innerText()
    expect(initialKm).toContain('0.00')

    // Klikkaa ▶ (btn-route-next)
    await page.click('#btn-route-next')
    await page.waitForTimeout(300)

    const afterKm = await page.locator('#route-km').innerText()
    // Pitää edetä > 0 km
    const km = parseFloat(afterKm.split('/')[0].trim())
    expect(km).toBeGreaterThan(0)

    // Keyboard: ArrowRight etenee
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    const afterArrow = await page.locator('#route-km').innerText()
    const km2 = parseFloat(afterArrow.split('/')[0].trim())
    expect(km2).toBeGreaterThan(km)

    // Escape pysäyttää drive moden — km palaa 0:aan
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const afterEsc = await page.locator('#route-km').innerText()
    expect(afterEsc).toContain('0.00')
  })
})

test.describe('Rooli-toggle', () => {
  test('järjestäjä → talkoolainen muuttaa toolbaria', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    // Alkutila: järjestäjä — +Merkki näkyy
    await expect(page.locator('#btn-add-sign')).toBeVisible()
    expect(await page.locator('#btn-role').innerText()).toBe('Järjestäjä')

    // Toggle → talkoolainen
    await page.click('#btn-role')
    await page.waitForTimeout(300)

    expect(await page.locator('#btn-role').innerText()).toBe('Talkoolainen')

    // Talkoolaisella #btn-add-sign piilotettu (V13/T32)
    await expect(page.locator('#btn-add-sign')).not.toBeVisible()

    // Palauta järjestäjäksi
    await page.click('#btn-role')
    await page.waitForTimeout(300)
    expect(await page.locator('#btn-role').innerText()).toBe('Järjestäjä')
    await expect(page.locator('#btn-add-sign')).toBeVisible()
  })

  test('rooli persistoi localStorageen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.click('#btn-role')
    await page.waitForTimeout(300)

    const stored = await page.evaluate(() => localStorage.getItem('karttamaster-role'))
    expect(stored).toBe('talkoolainen')

    // Reload — rooli säilyy
    await page.reload()
    await page.waitForTimeout(1000)
    expect(await page.locator('#btn-role').innerText()).toBe('Talkoolainen')
  })
})

test.describe('Rotation arm sticky — T40', () => {
  test('karttaklikki ei poista armia — Esc poistaa', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki — se on heti armed
    await page.click('#btn-add-sign')
    await page.waitForTimeout(300)
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(300)
    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    const mapBox = await page.locator('#map').boundingBox()
    const clickX = Math.round(routeBox!.x + routeBox!.width * 0.15 - mapBox!.x)
    const clickY = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: clickX, y: clickY }, timeout: 10000 })
    await page.waitForTimeout(800)

    // Merkki on armed (marker-armed class)
    const armedLocator = page.locator('.leaflet-marker-pane .leaflet-marker-icon.marker-armed')
    await expect(armedLocator).toBeVisible()

    // Klikkaa karttaa kaukana merkistä — arm EI saa poistua (V16)
    await page.click('#map', { position: { x: 100, y: 100 } })
    await page.waitForTimeout(300)
    await expect(armedLocator).toBeVisible()

    // Esc poistaa armin
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(armedLocator).not.toBeVisible()
  })
})

test.describe('Drag-to-move — T37', () => {
  test('merkki voidaan siirtää drag&drop — bearing + routeIds päivittyy', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki reitille
    await page.click('#btn-add-sign')
    await page.waitForTimeout(300)
    await page.click('.sign-type-btn[data-type="right"]')
    await page.waitForTimeout(300)
    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    expect(routeBox).not.toBeNull()
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    const clickX = Math.round(routeBox!.x + routeBox!.width * 0.15 - mapBox!.x)
    const clickY = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.click('#map', { position: { x: clickX, y: clickY }, timeout: 10000 })
    await page.waitForTimeout(800)

    // Lue alkuperäinen sijainti
    const lsBefore = await page.evaluate(() => localStorage.getItem('karttamaster-markers'))
    const dataBefore = JSON.parse(lsBefore!)
    expect(dataBefore.markers.length).toBeGreaterThan(0)
    const latBefore = dataBefore.markers[0].lat
    const lonBefore = dataBefore.markers[0].lon

    // Reload — merkki latautuu ilman arm-tilaa → drag käytössä
    await page.reload()
    await page.waitForTimeout(1500)

    // Hae marker-elementti kartalla
    const markerEl = page.locator('.leaflet-marker-pane .leaflet-marker-icon').first()
    const markerBox = await markerEl.boundingBox()
    expect(markerBox).not.toBeNull()

    const startX = markerBox!.x + markerBox!.width / 2
    const startY = markerBox!.y + markerBox!.height / 2

    // Drag 120px oikealle ja 60px alas
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 40, startY + 20, { steps: 5 })
    await page.mouse.move(startX + 80, startY + 40, { steps: 5 })
    await page.mouse.move(startX + 120, startY + 60, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(800)

    // Tarkista localStorage — sijainti muuttunut
    const lsAfter = await page.evaluate(() => localStorage.getItem('karttamaster-markers'))
    const dataAfter = JSON.parse(lsAfter!)
    expect(dataAfter.markers.length).toBeGreaterThan(0)
    const latAfter = dataAfter.markers[0].lat
    const lonAfter = dataAfter.markers[0].lon

    // Sijainti muuttunut (V15)
    const positionChanged = Math.abs(latAfter - latBefore) > 0.00001 || Math.abs(lonAfter - lonBefore) > 0.00001
    expect(positionChanged).toBe(true)

    // routeIds ei koskaan tyhjä (V21)
    expect(dataAfter.markers[0].routeIds.length).toBeGreaterThan(0)
  })
})

test.describe('Touch targets — T45', () => {
  test('kaikki napit ≥44px mobiililla (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    const buttons = await page.locator('button').all()
    const violations: string[] = []

    for (const btn of buttons) {
      const box = await btn.boundingBox()
      const text = (await btn.innerText().catch(() => '?')).trim().replace(/\n/g, '|')
      if (box && Math.min(box.width, box.height) < 44) {
        violations.push(`"${text}" = ${Math.round(box.width)}x${Math.round(box.height)}px`)
      }
    }

    if (violations.length > 0) {
      console.log('TOUCH TARGET VIOLATIONS:', violations.join(', '))
    }

    // T45 ✓ — kaikki napit ≥44px mobiililla
    expect(violations).toHaveLength(0)
  })
})
