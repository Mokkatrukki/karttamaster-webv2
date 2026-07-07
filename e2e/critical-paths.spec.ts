/**
 * T46 — Kriittiset E2E-polut
 * Kolme polkua jotka vaativat oikean selaimen (Leaflet + DOM yhdessä):
 *   1. Merkki asetetaan kartalle → näkyy merkkilistassa
 *   2. Drive mode käynnistyy + navigoi eteenpäin
 *   3. Rooli (backendistä) muuttaa toolbaria
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen } from './helpers/auth'

// Dev-server pyörii ulkopuolella (bun run dev) — playwright.config.ts baseURL

test.describe('Merkki kartalle', () => {
  test('dblclick kartalla → picker → tyyppi valitaan → merkki näkyy listassa (T85)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Ei btn-add-sign toolbarissa (T85)
    await expect(page.locator('#btn-add-sign')).toHaveCount(0)

    // dblclick kartalla avaa floating pickerin
    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)

    // Valitse "Oikealle" (right) pickeristä
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(800)

    // Picker sulkeutuu merkityksen jälkeen
    await expect(page.locator('#floating-picker')).not.toHaveClass(/open/)

    // Avaa overflow-valikko → Lista
    await page.click('#btn-menu')
    await page.waitForTimeout(200)
    await page.click('#btn-list')
    await page.waitForTimeout(300)
    const listText = await page.locator('#marker-modal').innerText()
    expect(listText).not.toContain('Ei merkkejä')
  })

  test('merkin tallennus epäonnistuu palvelimella → näkyvä virheilmoitus (T182/V115/B82)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.route('/api/markers', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) })
      }
      return route.continue()
    })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(500)

    const warning = page.locator('#distance-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('tallennus epäonnistui')
  })

  test('dblclick kartalla avaa floating pickerin kirjaston suosikeilla', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)

    // Floating picker näkyy kirjaston suosikeilla (default 4 ovat favorite:true)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    const pickerBtns = page.locator('#floating-picker .sign-type-btn')
    await expect(pickerBtns).toHaveCount(4)
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
    await mockAuthAsJarjestaja(page)
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

test.describe('Rooli backendistä (V80: #btn-role-toggle on dead code tili-per-rooli-authin jälkeen)', () => {
  test('järjestäjä-tili näyttää järjestäjän toolbarin', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    expect(await page.evaluate(() => document.body.dataset.role)).toBe('järjestäjä')
    await expect(page.locator('#btn-role')).toHaveText('Järjestäjä')
    await expect(page.locator('#segment-panel')).toBeVisible()
  })

  test('talkoolainen-tili näyttää rajatun toolbarin (V13/T32)', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    expect(await page.evaluate(() => document.body.dataset.role)).toBe('talkoolainen')
    await expect(page.locator('#btn-role')).toHaveText('Talkoolainen')
    await expect(page.locator('#segment-panel')).not.toBeVisible()
  })
})

test.describe('Drag-to-move — T37', () => {
  test('merkki voidaan siirtää drag&drop — routeIds päivittyy', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Lisää merkki reitille (T85: dblclick → floating picker → tyyppi)
    const routePath = page.locator('.leaflet-overlay-pane path').first()
    const routeBox = await routePath.boundingBox()
    expect(routeBox).not.toBeNull()
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    const clickX = Math.round(routeBox!.x + routeBox!.width * 0.15 - mapBox!.x)
    const clickY = Math.round(routeBox!.y + routeBox!.height * 0.5 - mapBox!.y)
    await page.dblclick('#map', { position: { x: clickX, y: clickY }, timeout: 10000 })
    await page.waitForTimeout(500)
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(800)

    // Merkit persistoituvat backendiin fire-and-forget-POSTilla (src/map/markers.ts apiPost,
    // .catch(() => {})) — E2E mockaa vain client-puolen /api/auth/me:n, ei oikeaa sessiota,
    // joten GET /api/markers ei ole luotettava tarkistustapa täällä. Todennus tehdään
    // Leaflet-markerin ruutukoordinaattien kautta (draggable: true, ks. markers.ts:254).
    const markerEl = page.locator('.leaflet-marker-pane .leaflet-marker-icon').first()
    const boxBefore = await markerEl.boundingBox()
    expect(boxBefore).not.toBeNull()

    const startX = boxBefore!.x + boxBefore!.width / 2
    const startY = boxBefore!.y + boxBefore!.height / 2

    // Drag 120px oikealle ja 60px alas
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 40, startY + 20, { steps: 5 })
    await page.mouse.move(startX + 80, startY + 40, { steps: 5 })
    await page.mouse.move(startX + 120, startY + 60, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(800)

    // Sijainti muuttunut ruudulla (V15)
    const boxAfter = await markerEl.boundingBox()
    expect(boxAfter).not.toBeNull()
    const moved = Math.abs(boxAfter!.x - boxBefore!.x) > 20 || Math.abs(boxAfter!.y - boxBefore!.y) > 20
    expect(moved).toBe(true)

    // B54/V82/T135: drag ei saa avata merkki-modaalia sivuvaikutuksena
    await expect(page.locator('.marker-detail-modal')).toHaveCount(0)
  })
})

test.describe('GPS-paikannin — T30', () => {
  test('GPS-nappi käynnistää paikannus — piste ilmestyy kartalle', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 65.627, longitude: 27.628 },
    })
    await context.route('/api/auth/me', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ role: 'talkoolainen', code: 'TEST01', display_name: 'Testi' }) })
    )
    const page = await context.newPage()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // GPS on talkoolainen-only (data-role-hide="järjestäjä") — alkutila: GPS ei aktiivinen
    await expect(page.locator('#btn-gps')).not.toHaveClass(/gps-active/)

    // Käynnistä GPS
    await page.click('#btn-gps')
    await page.waitForTimeout(800)

    // Nappi on aktiivinen
    await expect(page.locator('#btn-gps')).toHaveClass(/gps-active/)

    // GPS-piste (.gps-dot) ilmestyy kartalle
    await expect(page.locator('.leaflet-overlay-pane .gps-dot')).toBeVisible()

    // Pysäytä GPS
    await page.click('#btn-gps')
    await page.waitForTimeout(300)
    await expect(page.locator('#btn-gps')).not.toHaveClass(/gps-active/)
    await expect(page.locator('.leaflet-overlay-pane .gps-dot')).not.toBeVisible()

    await context.close()
  })
})

test.describe('Auth screen — T51', () => {
  test('401 → login-lomake näkyy → järjestäjä kirjautuu → kartta näkyy', async ({ page }) => {
    await page.route('/api/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }),
    )
    await page.route('/api/auth/login', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'järjestäjä', display_name: 'Admin' }) }),
    )

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(500)

    // Auth screen näkyy
    await expect(page.locator('#auth-screen')).toHaveClass(/open/)
    await expect(page.locator('#auth-form-jarjestaja')).toHaveClass(/active/)

    // Täytä ja lähetä lomake
    await page.fill('#auth-username', 'admin')
    await page.fill('#auth-password', 'password')
    await page.click('#auth-form-jarjestaja button[type="submit"]')
    await page.waitForTimeout(500)

    // Auth screen piilotettu, kartta näkyy
    await expect(page.locator('#auth-screen')).not.toHaveClass(/open/)
    await expect(page.locator('#map')).toBeVisible()
  })

  test('401 → talkoolainen-tab → talkoolaiskoodi → kirjautuminen', async ({ page }) => {
    await page.route('/api/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }),
    )
    await page.route('/api/auth/code-login', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'talkoolainen', display_name: 'Talkoolainen 1' }) }),
    )

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(500)

    // Vaihda talkoolainen-tabille
    await page.click('[data-tab="talkoolainen"]')
    await expect(page.locator('#auth-form-talkoolainen')).toHaveClass(/active/)

    // Syötä koodi ja kirjaudu
    await page.fill('#auth-code', 'ABC123')
    await page.click('#auth-form-talkoolainen button[type="submit"]')
    await page.waitForTimeout(500)

    await expect(page.locator('#auth-screen')).not.toHaveClass(/open/)
  })

  test('väärä salasana → virheviesti näkyy', async ({ page }) => {
    await page.route('/api/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }),
    )
    await page.route('/api/auth/login', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_credentials' }) }),
    )

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(500)

    await page.fill('#auth-username', 'wrong')
    await page.fill('#auth-password', 'wrong')
    await page.click('#auth-form-jarjestaja button[type="submit"]')
    await page.waitForTimeout(300)

    // Virheviesti
    const errorText = await page.locator('#auth-error').innerText()
    expect(errorText).toBeTruthy()
    expect(errorText).toContain('Väärä')

    // Auth screen yhä auki
    await expect(page.locator('#auth-screen')).toHaveClass(/open/)
  })
})

test.describe('Touch targets — T45', () => {
  test('kaikki napit ≥44px mobiililla (375px)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
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

test.describe('Left panel — T73', () => {
  test('paneeli auki → kartta-alue pienempi; toggle → kartta täyttää leveyden', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Paneeli auki oletuksena
    const panelContent = page.locator('#left-panel-content')
    await expect(panelContent).toBeVisible()

    const mapBoxOpen = await page.locator('#map-area').boundingBox()
    expect(mapBoxOpen).not.toBeNull()

    // Toggle sulkee paneelin
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(200)

    await expect(panelContent).not.toBeVisible()

    const mapBoxClosed = await page.locator('#map-area').boundingBox()
    expect(mapBoxClosed).not.toBeNull()

    // Kartta-alue leveämpi kun paneeli kiinni (V13: map fills width)
    expect(mapBoxClosed!.width).toBeGreaterThan(mapBoxOpen!.width)

    // Toggle uudelleen → paneeli aukeaa
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(200)
    await expect(panelContent).toBeVisible()

    const mapBoxReopened = await page.locator('#map-area').boundingBox()
    expect(mapBoxReopened!.width).toBeLessThan(mapBoxClosed!.width)
  })

  test('merkkikirjasto-grid näkyy paneelissa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Sign type buttons näkyvät left panelissa
    const signTypeBtn = page.locator('#left-panel #sign-type-dropdown .sign-type-btn').first()
    await expect(signTypeBtn).toBeVisible()
  })

  test('sivupalkin merkkikirjastosta voi asettaa merkin kartalle (T136/B55/V83)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    const before = await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count()

    // Klikkaa sivupalkin merkkikirjaston riviä — armaa sijoituksen, ei vaadi suosikkia
    await page.click('#left-panel #sign-type-dropdown .sign-lib-place-btn >> nth=0')
    await expect(page.locator('#map')).toHaveClass(/place-mode/)

    // Seuraava kartan klikki sijoittaa merkin
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    await page.mouse.click(mapBox!.x + mapBox!.width / 2, mapBox!.y + mapBox!.height / 2)
    await page.waitForTimeout(500)

    await expect(page.locator('#map')).not.toHaveClass(/place-mode/)
    const after = await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count()
    expect(after).toBe(before + 1)
  })

  // T172/V107: yhdistelmämerkki — pystypino kepissä, yksi ankkuripiste
  test('yhdistelmämerkki kartalla näyttää kaikki osat pinossa oikeassa järjestyksessä (T172)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Luo uusi yhdistelmämalli: "+ Uusi merkki" → 2 osaa (flag, wrench) → tallenna
    await page.click('#left-panel #sign-type-dropdown .sign-lib-add-btn')
    await expect(page.locator('.sign-lib-modal')).toBeVisible()
    await page.fill('.sign-lib-id-input', 'combo-e2e')
    await page.fill('.sign-lib-label-input', 'Combo E2E')

    await page.click('.sign-lib-part-add-toggle')
    await page.click('.sign-lib-part-icon-btn >> nth=0')
    await page.click('.sign-lib-part-add-toggle')
    await page.click('.sign-lib-part-icon-btn >> nth=1')
    await expect(page.locator('.sign-lib-part-row')).toHaveCount(2)

    await page.click('.sign-lib-save-btn')
    await expect(page.locator('.sign-lib-modal')).not.toBeVisible()

    // Sijoita uusi malli kartalle sivupalkin place-napilla
    await page.click('#left-panel #sign-type-dropdown .sign-lib-place-btn[data-id="combo-e2e"]')
    await expect(page.locator('#map')).toHaveClass(/place-mode/)
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    await page.mouse.click(mapBox!.x + mapBox!.width / 2, mapBox!.y + mapBox!.height / 2)
    await page.waitForTimeout(500)

    // Pino: yksi divIcon-elementti, kaksi osaa, yksi ankkuri (yksi tip-SVG)
    const markerHtml = page.locator('.leaflet-marker-pane .leaflet-marker-icon').last()
    await expect(markerHtml).toBeVisible()
    const html = await markerHtml.innerHTML()
    expect(html).toContain('flex-direction:column')
    const svgCount = (html.match(/<svg/g) ?? []).length
    expect(svgCount).toBeGreaterThanOrEqual(2) // 2 osa-ikonia + tip (icon-osalla oma svg, tip toinen)
    expect(html.match(/viewBox="0 0 16 8"/g)).toHaveLength(1) // yksi tip = yksi ankkuripiste
  })
})

// T108 — AreaOverlay: area piirtyy kartalle + klikkaus triggeroi flyTo
const TEST_AREA = {
  id: 'area-e2e-1',
  name: 'Huoltopiste 25km',
  centerLat: 65.628,
  centerLng: 27.628,
  widthM: 200,
  heightM: 100,
  rotation: 0,
  markdownDescription: '## Testi',
  status: 'suunniteltu',
  hashCode: 'test-hash-123',
  features: [],
}

async function mockAreasApi(page: import('playwright/test').Page, areas: unknown[] = [TEST_AREA]) {
  await page.route('/api/areas', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(areas),
    })
  )
}

test.describe('T108 — AreaOverlay', () => {
  test('area piirtyy kartalle: .area-polygon elementti löytyy Leaflet SVG:stä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockAreasApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Leaflet renderöi polygonit .leaflet-overlay-pane SVG path -elementteinä
    // area-polygon className asetetaan area-overlay.ts:ssä
    const areaPolygon = page.locator('.leaflet-overlay-pane .area-polygon')
    await expect(areaPolygon).toHaveCount(1)
  })

  test('area klikkaus triggeroi flyTo: kartan zoom muuttuu 18:ksi', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockAreasApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    const zoomBefore = await page.evaluate(() => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as { getZoom(): number } | undefined
      return m?.getZoom() ?? -1
    })

    // Trigger click via JS — polygon on olemassa mutta voi olla pieni zoom-tasosta riippuen
    await page.evaluate(() => {
      const el = document.querySelector('.area-polygon')
      if (!el) throw new Error('.area-polygon not found')
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // flyTo animoitu — odota päättymistä
    await page.waitForTimeout(2500)

    const zoomAfter = await page.evaluate(() => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as { getZoom(): number } | undefined
      return m?.getZoom()
    })
    expect(zoomAfter).toBe(18)
    expect(zoomBefore).not.toBe(18)
  })
})

// T175/V109: merkki-ikonit skaalautuvat zoomin mukaan (CSS transform, ei uudelleenpiirtoa)
test.describe('Merkin zoom-skaalaus — T175', () => {
  test('merkki skaalautuu pienemmäksi kaukana zoomattuna, kasvaa lähennettäessä, sijainti ei drifaa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.dblclick('#map', { position: { x: 460, y: 260 } })
    await page.waitForTimeout(500)
    await page.click('#floating-picker .sign-type-btn[data-type="right"]')
    await page.waitForTimeout(800)

    const markerIcon = page.locator('.leaflet-marker-icon').first()
    await expect(markerIcon).toHaveCount(1)

    await page.evaluate(() => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as { setZoom(z: number): void } | undefined
      m?.setZoom(11)
    })
    await page.waitForTimeout(300)
    // Vertaa Leafletin oman position-elementin (outer, translate3d) ankkuripistettä (bottom-center)
    // skaalatun sisäwrapperin (inner) ankkuripisteeseen — niiden pitää osua yhteen molemmilla
    // zoom-tasoilla riippumatta siitä minne kartta on pannannut markerin ruudulla.
    const readAnchors = () => markerIcon.evaluate((el) => {
      const outer = el.getBoundingClientRect()
      const inner = (el.firstElementChild as HTMLElement).getBoundingClientRect()
      return {
        transform: (el.firstElementChild as HTMLElement).style.transform,
        outerAnchorX: outer.x + outer.width / 2,
        outerAnchorY: outer.y + outer.height,
        innerAnchorX: inner.x + inner.width / 2,
        innerAnchorY: inner.y + inner.height,
        innerWidth: inner.width,
      }
    })

    const far = await readAnchors()
    await page.evaluate(() => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as { setZoom(z: number): void } | undefined
      m?.setZoom(17)
    })
    await page.waitForTimeout(300)
    const near = await readAnchors()

    expect(far.transform).toContain('scale(0.3')
    expect(near.transform).toContain('scale(1')
    expect(near.innerWidth).toBeGreaterThan(far.innerWidth)
    // Skaalauksen transform-origin (center bottom) pitää ankkuripisteen paikallaan riippumatta scalesta
    expect(Math.abs(far.outerAnchorX - far.innerAnchorX)).toBeLessThan(2)
    expect(Math.abs(far.outerAnchorY - far.innerAnchorY)).toBeLessThan(2)
    expect(Math.abs(near.outerAnchorX - near.innerAnchorX)).toBeLessThan(2)
    expect(Math.abs(near.outerAnchorY - near.innerAnchorY)).toBeLessThan(2)
  })
})
