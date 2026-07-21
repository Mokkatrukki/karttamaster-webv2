/**
 * T25 — SegmentPanel + segment-overlay E2E
 * Validates: 2-click creation flow (T94: modal-based), segment list, delete
 * T94 note: after two map clicks the creation modal enters 'tiedot' phase —
 *           must click "Tallenna" to actually create the segment.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockSegmentWrites } from './helpers/auth'

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

  test('T229/T232 — talkoolainen: hero-overflown "+ Merkki" avaa sign-pickerin', async ({ page }) => {
    // T232/E: "+ Merkki" siirtyi yläpalkista SegmentView-heron ⋯-overflowiin. Seedaa pätkä +
    // asettamaton merkki jotta hero renderöi seuraava-merkki-ohjauksen overflow-valikkoineen.
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    // Talkoolaisen koodi tulee URL-polusta /s/<koodi> (V27), ei /api/auth/me:stä → goto /s/TEST01.
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    // T262/V182: hero on kartta-moodin ohjaus (koti näyttää varustelistan) → siirry kartalle.
    await page.click('#btn-to-map')
    await page.click('.segment-view-next-more')
    const addItem = page.locator('.segment-view-next-add')
    await expect(addItem).toBeVisible()
    await addItem.click()
    await expect(page.locator('#floating-picker')).toHaveClass(/open/)
  })

  test('T254 — talkoolaisen kaksi moodia: koti (ei karttaa) ⇄ kartta (🏠)', async ({ page }) => {
    // R1 keystone (V174–176): /s/koodi → KOTI-landing (kartta piilossa) → "Kartalle →" →
    // KARTTA (kartta näkyvä + 🏠) → "🏠" → KOTI.
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    const app = page.locator('#app')
    // KOTI-landing (V174): oletusmoodi koti, kartta piilossa, "Kartalle →" näkyvä
    await expect(app).toHaveAttribute('data-view-mode', 'koti')
    await expect(page.locator('#map')).toBeHidden()
    await expect(page.locator('#btn-to-map')).toBeVisible()
    await expect(page.locator('#btn-home-view')).toBeHidden()

    // "Kartalle →" → KARTTA (V175): kartta näkyvä, 🏠 näkyvä, "Kartalle →" piilossa
    await page.click('#btn-to-map')
    await expect(app).toHaveAttribute('data-view-mode', 'kartta')
    await expect(page.locator('#map')).toBeVisible()
    await expect(page.locator('#btn-home-view')).toBeVisible()
    await expect(page.locator('#btn-to-map')).toBeHidden()

    // "🏠" → KOTI (paluu)
    await page.click('#btn-home-view')
    await expect(app).toHaveAttribute('data-view-mode', 'koti')
    await expect(page.locator('#map')).toBeHidden()
  })

  test('T262 — KOTI: varustelista näkyy + ei seuraava-merkki-heroa; KARTTA: päinvastoin', async ({ page }) => {
    // R3b/V182: koti-moodi näyttää inline-varustelistan JA piilottaa heron (.segment-view-next);
    // kartta-moodi näyttää heron alapalkkina JA piilottaa varustelistan.
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    const app = page.locator('#app')
    // KOTI: varustelista näkyy, seuraava-merkki-hero piilossa.
    await expect(app).toHaveAttribute('data-view-mode', 'koti')
    await expect(page.locator('.segment-view-equipment')).toBeVisible()
    await expect(page.locator('.segment-view-equipment-title')).toContainText('Varustelista')
    await expect(page.locator('.segment-view-next')).toBeHidden()

    // KARTTA: hero näkyy alapalkkina, varustelista piilossa.
    await page.click('#btn-to-map')
    await expect(app).toHaveAttribute('data-view-mode', 'kartta')
    await expect(page.locator('.segment-view-next')).toBeVisible()
    await expect(page.locator('.segment-view-equipment')).toBeHidden()
  })

  test('T262 — varustarkastus-checkoff persistoi reloadin yli (koti)', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    const firstCheck = page.locator('.segment-view-equipment .equipment-check-box').first()
    await firstCheck.check()
    await expect(page.locator('.segment-view-equipment-progress')).toContainText('otettu')

    await page.reload()
    await page.waitForTimeout(1500)
    await expect(page.locator('.segment-view-equipment .equipment-check-box').first()).toBeChecked()
  })

  test('T232 — järjestäjällä ei talkoolais-heroa (+Merkki sivupalkin kirjastosta)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)
    // Ei hero-+Merkkiä eikä yläpalkin #btn-add-markeria (poistettu T233)
    await expect(page.locator('.segment-view-next-add')).toHaveCount(0)
    await expect(page.locator('#btn-add-marker')).toHaveCount(0)
  })

  test('kaksi klikkausta + Tallenna luo pätkän (T94 modal flow)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    expect(await page.evaluate(() => document.body.dataset.role)).toBe('järjestäjä')

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

  // T77/T199: poisto elää SegmentDetailsModalissa, joka avataan pätkärivin ···-napista
  // (.btn-segment-details-open, segment-panel.ts:319). Robustoitu deterministiseksi DOM-polulla —
  // ei enää synteettistä dispatchEvent-klikkiä Leaflet-polylineen (headless-flaky). Ks. muisti flaky-e2e-tests.
  test('pätkän voi poistaa listasta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockSegmentWrites(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await expect(page.locator('.segment-item')).toHaveCount(1)

    // Poisto siirretty SegmentDetailsModaliin (T77) — avaa se rivin ···-napista ja hyväksy confirm()
    page.once('dialog', dialog => dialog.accept())
    await page.click('.segment-item .btn-segment-details-open')
    await expect(page.locator('.segment-details-modal')).toBeVisible()
    await page.click('.btn-segment-delete-modal')

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

  // T152/V96: pätkän viivatyyli koodaa statuksen kartalla. Uusi pätkä ilman merkkejä
  // = ei_alkanut = katkoviiva (stroke-dasharray). Guard: overlay-render saa merkit + tyylin.
  test('pätkän viivatyyli koodaa statuksen — tyhjä pätkä = katkoviiva (T152)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    // Segmenttikaista renderöi stroke-dasharrayn; reitit + aukot ovat ehjiä (ei dasharrayta)
    const dashedCount = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
      return paths.filter(p => (p.getAttribute('stroke-dasharray') ?? '') !== '').length
    })
    expect(dashedCount).toBeGreaterThan(0)
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

  // T208-talkoolainen / B-lista2: "Seuraava merkki" -hero ohjaa pätkän ENSIMMÄISEEN
  // asettamattomaan merkkiin ja "Aseta" asettaa juuri sen (ei "randomia").
  test('seuraava-merkki-hero: Aseta asettaa pätkän ensimmäisen suunniteltu-merkin', async ({ page }) => {
    const MOCK_SEGMENT = {
      id: 'seg-aset-1', routeIds: ['35km'],
      startDist: 0, endDist: 20000,
      displayName: 'Asetuspätkä', equipment: [],
      phase: 'asettaminen', assignedCode: 'ASET01',
    }
    // Kaksi suunniteltu-merkkiä — 'late' ensin listalla mutta 'early' on pienin distanceFromStart.
    const MARKERS = [
      { id: 'late', type: 'right', lat: 63.1, lon: 27.1, distance_from_start: 9000, route_ids: ['35km'], status: 'suunniteltu' },
      { id: 'early', type: 'left', lat: 63.0, lon: 27.0, distance_from_start: 3000, route_ids: ['35km'], status: 'suunniteltu' },
    ]
    const putCalls: { url: string; body: unknown }[] = []
    await page.route('/api/segments/by-code/ASET01', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEGMENT) }))
    await page.route('/api/markers', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MARKERS) }))
    await page.route('/api/markers/*', r => {
      if (r.request().method() === 'PUT') {
        putCalls.push({ url: r.request().url(), body: r.request().postDataJSON() })
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
      return r.continue()
    })

    await mockAuthAsTalkoolainen(page, 'ASET01')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/s/ASET01')
    await page.waitForTimeout(1500)

    // T262/V182: hero on kartta-moodin ohjaus (koti näyttää varustelistan) → siirry kartalle.
    await page.click('#btn-to-map')

    // Hero näkyy ja osoittaa ensimmäiseen merkkiin (early, 3.0 km)
    await expect(page.locator('.segment-view-next')).toBeVisible()
    await expect(page.locator('.segment-view-next-meta')).toHaveText('3.0 km')
    await expect(page.locator('.segment-view-progress-text')).toHaveText('0/2 asetettu')

    // Aseta → PUT juuri 'early'-merkille statuksella asetettu
    await page.locator('.segment-view-next-set').click()
    await page.waitForTimeout(500)
    expect(putCalls.length).toBeGreaterThan(0)
    expect(putCalls[0].url).toContain('/api/markers/early')
    expect(putCalls[0].body).toMatchObject({ status: 'asetettu' })
  })

  // T78/V43: talkoolainen muokkaa oman pätkän rajoja kentällä → PUT /api/segments/:id
  test('talkoolainen muokkaa pätkän rajoja → PUT /api/segments/:id', async ({ page }) => {
    const MOCK_SEGMENT = {
      id: 'seg-bounds-1', routeIds: ['35km'], startDist: 0, endDist: 10000,
      displayName: 'Rajapätkä', equipment: [], phase: 'asettaminen', assignedCode: 'BND01',
    }
    const segPuts: unknown[] = []
    await page.route('/api/segments/by-code/BND01', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEGMENT) }))
    await page.route('/api/segments/*', r => {
      if (r.request().method() === 'PUT') { segPuts.push(r.request().postDataJSON()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) }
      return r.continue()
    })
    await page.route('/api/markers', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await mockAuthAsTalkoolainen(page, 'BND01')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/s/BND01')
    await page.waitForTimeout(1500)

    // T232/V158: rajojen muokkaus siirtyi "Lisää ⋯" -sekundäärivalikkoon → avaa se ensin.
    await page.locator('.segment-view-more-toggle').click()
    await page.locator('.segment-view-bounds-toggle').scrollIntoViewIfNeeded()
    await page.locator('.segment-view-bounds-toggle').click()
    await page.locator('.segment-view-bounds-end').fill('15')
    await page.locator('.segment-view-bounds-save').click()
    await page.waitForTimeout(500)

    expect(segPuts.length).toBeGreaterThan(0)
    expect(segPuts[0]).toMatchObject({ startDist: 0, endDist: 15000 })
  })
})
