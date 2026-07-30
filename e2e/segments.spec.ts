/**
 * T25 — SegmentPanel + segment-overlay E2E
 * Validates: 2-click creation flow (T94: modal-based), segment list, delete
 * T94 note: after two map clicks the creation modal enters 'tiedot' phase —
 *           must click "Tallenna" to actually create the segment.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockSegmentWrites, mockMarkers } from './helpers/auth'
import { zoomToShowSegmentLabels } from './helpers/label-zoom'

/**
 * T362: klikkaa OIKEITA reittipisteitä. Aiemmin testit klikkasivat reittipolun bounding boxin
 * sisältä — piste joka ⊥ ole viivalla. Se toimi kun luonti snappasi molemmat klikit & lajitteli
 * ne min/max:lla, eli juuri sen arvauksen varassa jonka B144 kirjaa. Ankkuriketju etenee
 * reittiä pitkin ∴ klikkien ! osua reitille oikeasti.
 */
async function routePointPositions(
  page: import('playwright/test').Page,
  fractions: number[],
): Promise<{ x: number; y: number }[]> {
  return page.evaluate((fracs) => {
    const map = (window as unknown as Record<string, unknown>)['__testMap'] as {
      eachLayer(fn: (l: unknown) => void): void
      latLngToContainerPoint(ll: unknown): { x: number; y: number }
    }
    let latlngs: unknown[] | null = null
    map.eachLayer((l) => {
      const layer = l as { getLatLngs?: () => unknown[] }
      if (!latlngs && typeof layer.getLatLngs === 'function') {
        const pts = layer.getLatLngs()
        if (Array.isArray(pts) && pts.length > 10) latlngs = pts
      }
    })
    if (!latlngs) throw new Error('route polyline not found')
    const pts = latlngs as unknown[]
    return fracs.map((f) => {
      const ll = pts[Math.round((pts.length - 1) * f)]
      const p = map.latLngToContainerPoint(ll)
      return { x: Math.round(p.x), y: Math.round(p.y) }
    })
  }, fractions)
}

/** Klikkaa kartalta annetut reittipisteet järjestyksessä. */
async function clickRoutePoints(page: import('playwright/test').Page, fractions: number[]): Promise<void> {
  const positions = await routePointPositions(page, fractions)
  for (const position of positions) {
    await page.click('#map', { position })
    await page.waitForTimeout(250)
  }
}

/** Helper: create a segment via anchor-chain modal flow + Valmis + Tallenna (T362) */
async function createSegmentViaModal(page: import('playwright/test').Page) {
  // T73: panel collapsed by default — expand before touching its footer button
  await page.locator('.segment-panel-header').click()
  await page.waitForTimeout(200)
  await page.click('#btn-segment-create')
  await page.waitForTimeout(200)

  await clickRoutePoints(page, [0.20, 0.60])

  // T362: ankkuriketju päätetään "Valmis"-napilla, sitten tiedot-vaihe
  await page.click('.btn-segment-path-done')
  await page.waitForTimeout(300)
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

  test('T263/T264 — KOTI: "Kaikki merkit" -tab näyttää listan + rivi avaa modaalin; KARTTA: piilossa', async ({ page }) => {
    // R3/V183 + R10/V184: oman pätkän merkkilista koti-Kaikki merkit -tabissa (koti-only).
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    // KOTI: avaa "Kaikki merkit" -tab → lista näkyy + otsikko + 1 rivi.
    await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
    await expect(page.locator('.segment-view-markers')).toBeVisible()
    await expect(page.locator('.segment-view-markers-header')).toContainText('Kaikki merkit')
    await expect(page.locator('.segment-view-markers-row')).toHaveCount(1)

    // Rivi → MarkerDetailModal (jaettu yläpalkin modaalin kanssa).
    await page.locator('.segment-view-markers-row').first().click()
    await expect(page.locator('.marker-detail-modal')).toBeVisible()
    await page.keyboard.press('Escape')

    // KARTTA: tabit + lista piilossa.
    await page.click('#btn-to-map')
    await expect(page.locator('.segment-view-markers')).toBeHidden()
    await expect(page.locator('.segment-koti-tabs')).toBeHidden()
  })

  test('T264/T380 — koti-välilehdet: 2 tabia, tab-vaihto, valmis+rajat Kaikki merkit -tabissa, #btn-varuste pois', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    // T380/V275: 2 tabia (Kommentit poistettu), Varustelista aktiivinen oletuksena.
    await expect(page.locator('.segment-koti-tab')).toHaveCount(2)
    await expect(page.locator('.segment-koti-tab.is-active')).toContainText('Varustelista')
    await expect(page.locator('.segment-view-equipment')).toBeVisible()

    // Yläpalkin 🎒 Varustelista-nappi poistettu (T264).
    await expect(page.locator('#btn-varuste')).toHaveCount(0)
    // #btn-list piilotettu talkoolaiselta (koti-tab korvaa).
    await expect(page.locator('#btn-list')).toBeHidden()

    // "Kaikki merkit" -tab → lista + valmis + rajat samassa tabissa (ei haitarin alla).
    await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
    const merkit = page.locator('.segment-koti-panel[data-tab="merkit"]')
    await expect(merkit.locator('.segment-view-markers')).toBeVisible()
    await expect(merkit.locator('.segment-view-complete')).toBeVisible()
    await expect(merkit.locator('.segment-view-bounds')).toBeVisible()

    // T380/V275: "Kommentit"-tabia ⊥ enää ole — koti-tabit ovat varuste + merkit.
    await expect(page.locator('.segment-koti-tab[data-tab="kommentit"]')).toHaveCount(0)
    await expect(page.locator('.segment-view-comments')).toHaveCount(0)
    await expect(page.locator('.segment-view-equipment')).toBeHidden()
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
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa kartalta pätkän aloituspiste')

    // T362: klikit osuvat OIKEILLE reittipisteille (ks. clickRoutePoints)
    const [p1, p2] = await routePointPositions(page, [0.20, 0.60])

    // T362: ensimmäinen klikkaus LUKITSEE reitin ja näyttää sen (B144(a))
    await page.click('#map', { position: p1 })
    await page.waitForTimeout(300)
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa reittiä pitkin eteenpäin')
    await expect(page.locator('[data-testid="creation-route"]')).toContainText('Reitti:')
    await expect(page.locator('.segment-creation-anchor')).toHaveCount(1)
    // Yhdellä ankkurilla polkua ei voi päättää
    await expect(page.locator('.btn-segment-path-done')).toBeDisabled()

    // Toinen klikkaus — "Valmis" aukeaa
    await page.click('#map', { position: p2 })
    await page.waitForTimeout(300)
    await expect(page.locator('.segment-creation-anchor')).toHaveCount(2)
    await expect(page.locator('.btn-segment-path-done')).toBeEnabled()

    await page.click('.btn-segment-path-done')
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

  test('T362 — klik-klik-pätkä välipisteillä: ankkurilista, peruutus, jälki tallentuu', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    const posted: Record<string, unknown>[] = []
    await page.route(/\/api\/segments$/, route => {
      if (route.request().method() === 'POST') {
        posted.push(route.request().postDataJSON())
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    // Alku + kaksi välipistettä + loppu — neljä ankkuria reittiä pitkin
    await clickRoutePoints(page, [0.20, 0.35, 0.50, 0.65])
    await expect(page.locator('.segment-creation-anchor')).toHaveCount(4)
    await expect(page.locator('.segment-creation-anchor').nth(1)).toContainText('Välipiste 1')
    await expect(page.locator('.segment-creation-anchor').last()).toContainText('Loppu')

    // T388/V280/B162: KARTALLA ! olla merkki jokaisesta ankkurista + kertyvä esikatselujälki.
    // Modaalin `<li>`-määrä yllä ⊥ todista tätä — se oli vihreä koko B162:n ajan.
    await expect(page.locator('#map .segment-creation-marker')).toHaveCount(4)
    await expect(page.locator('#map .segment-creation-preview')).toHaveCount(1)

    // "Poista viimeinen" → 3 ankkuria, viimeinen on taas "Loppu"
    await page.click('.btn-segment-anchor-undo')
    await page.waitForTimeout(200)
    await expect(page.locator('.segment-creation-anchor')).toHaveCount(3)
    await expect(page.locator('.segment-creation-anchor').last()).toContainText('Loppu')
    // Peruttu ankkuri ⊥ jää kartalle haamuksi.
    await expect(page.locator('#map .segment-creation-marker')).toHaveCount(3)

    await page.click('.btn-segment-path-done')
    await page.waitForTimeout(200)
    await page.click('.btn-segment-creation-save')
    await page.waitForTimeout(500)

    // V258: tallennettu pätkä kantaa JÄLJEN, ei vain kahta km-lukua
    expect(posted.length).toBeGreaterThan(0)
    const body = posted[0] as { track?: { lat: number; lon: number; d: number }[]; startDist: number; endDist: number }
    expect(Array.isArray(body.track)).toBe(true)
    expect(body.track!.length).toBeGreaterThan(2)
    expect(body.track![0].d).toBe(0)
    // Jäljen pituus vastaa rajoja (johdettu samasta ankkuriketjusta)
    const trackLen = body.track![body.track!.length - 1].d
    expect(Math.abs(trackLen - (body.endDist - body.startDist))).toBeLessThan(5)
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

    await clickRoutePoints(page, [0.20])

    // T362: ensimmäinen ankkuri → polkutila + circleMarker kartalle
    await expect(page.locator('.segment-creation-modal')).toContainText('Klikkaa reittiä pitkin eteenpäin')
    await expect(page.locator('.segment-creation-marker')).toHaveCount(1)
  })

  // B147: ankkurimarkeri on PALAUTE ⊥ klikkikohde. Leafletin circleMarker on interaktiivinen
  // oletuksena ∴ 18px kiekko söi seuraavan ankkuriklikin hiljaa — ⊥ ankkuria, ⊥ virhetekstiä.
  test('B147 — ankkurimarkeri ei syö seuraavaa klikkiä', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(200)

    const marker = page.locator('.segment-creation-marker')
    await clickRoutePoints(page, [0.20])
    await expect(marker).toHaveCount(1)

    // Leaflet merkitsee klikattavat vektorit `leaflet-interactive`-luokalla → sen puuttuminen
    // on se mitattava sopimus (⊥ pelkkä "klikki näytti toimivan").
    await expect(marker).not.toHaveClass(/leaflet-interactive/)

    // Klikki markerin PÄÄLTÄ menee kartalle asti: uusi ankkuri TAI virheteksti — ⊥ hiljaisuus.
    const box = (await marker.boundingBox())!
    const mapBox = (await page.locator('#map').boundingBox())!
    await page.click('#map', {
      position: { x: Math.round(box.x + box.width / 2 - mapBox.x), y: Math.round(box.y + box.height / 2 - mapBox.y) },
    })
    await page.waitForTimeout(300)

    const anchors = await page.locator('.segment-creation-anchor').count()
    const errVisible = await page.locator('.segment-creation-error').isVisible()
    expect(anchors > 1 || errVisible).toBe(true)
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
    // E2E-NOTES juurisyy 1: ilman kirjoitusmockia luonti-POST → 401 → #auth-screen.open kaappaa
    // klikit. Assertio oli aiemmin pelkkä toBeVisible ∴ puute ei näkynyt; tab-klikki paljasti sen.
    await mockSegmentWrites(page)
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

    // T354/V257: rajojen muokkaus asuu Asetukset-tabissa → tabi ensin, ⊥ kaivaa piilotettua panelia.
    await page.click('.segment-details-modal-tabs .segment-koti-tab[data-tab="asetukset"]')

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
  // (T344: rivin nimi `.segment-info`; T345: `···` avaa pikavalikon). Robustoitu DOM-polulla —
  // ei enää synteettistä dispatchEvent-klikkiä Leaflet-polylineen (headless-flaky). Ks. muisti flaky-e2e-tests.
  test('pätkän voi poistaa listasta', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockSegmentWrites(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)

    await expect(page.locator('.segment-item')).toHaveCount(1)

    // Poisto elää SegmentDetailsModalissa (T77). T298/V209/B113: luotu pätkä AUKAISEE modaalin
    // itse (`segment-panel.ts:63-65`) ∴ ···-nappia ei tarvitse eikä VOI klikata — se on auki
    // olevan backdropin takana (T325/V233: entinen klikki jäi 30 s timeoutiin).
    page.once('dialog', dialog => dialog.accept())
    await expect(page.locator('.segment-details-modal')).toBeVisible()
    await page.click('.btn-segment-delete-modal')

    await expect(page.locator('.segment-empty')).toBeVisible()
  })

  // T354/V257: modaalin välilehdet kapealla ruudulla. Kolme tabia EI saa taittua kahdelle riville
  // — taittunut tabipalkki syö modaalin korkeudesta ja siirtää sisältöä datan mukana.
  // T355/T356 samassa ajossa: footer on jaettu modal-footer ja korostuskytkin headerissa.
  test('T354 — modaalin 3 tabia mahtuvat 390px-ruudulle, tab-vaihto toimii', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockSegmentWrites(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    await createSegmentViaModal(page)
    await expect(page.locator('.segment-details-modal')).toBeVisible()

    // Kapea ruutu VASTA modaalin auettua — luontiflow tarvitsee kartan leveyden.
    await page.setViewportSize({ width: 390, height: 780 })
    await page.waitForTimeout(300)

    const tabs = page.locator('.segment-details-modal-tabs .segment-koti-tab')
    await expect(tabs).toHaveCount(3)

    // Yksi rivi = kaikilla sama y-koordinaatti.
    const tops = await tabs.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)

    // Tabipalkki mahtuu modaalin leveyteen (⊥ vaakascrollia).
    const bar = page.locator('.segment-details-modal-tabs .segment-koti-tabbar')
    const fits = await bar.evaluate(el => el.scrollWidth <= el.clientWidth + 1)
    expect(fits).toBe(true)

    // T357: oletustabi = Asetukset; merkit-tab piilossa kunnes klikataan.
    await expect(page.locator('.segment-koti-panel[data-tab="asetukset"]')).toBeVisible()
    await expect(page.locator('.segment-koti-panel[data-tab="merkit"]')).toBeHidden()
    await page.click('.segment-details-modal-tabs .segment-koti-tab[data-tab="merkit"]')
    await expect(page.locator('.segment-koti-panel[data-tab="merkit"]')).toBeVisible()
    await expect(page.locator('.segment-koti-panel[data-tab="asetukset"]')).toBeHidden()

    // T356: korostuskytkin headerissa, ✕ edelleen 44px.
    await expect(page.locator('.segment-details-modal-header .btn-segment-focus-toggle')).toBeVisible()
    const closeBox = await page.locator('.segment-details-modal-close').boundingBox()
    expect(closeBox!.width).toBeGreaterThanOrEqual(44)
    expect(closeBox!.height).toBeGreaterThanOrEqual(44)

    // T355: footer = secondary Sulje + destructive-rivi, ei primarya.
    await expect(page.locator('.segment-details-modal .modal-footer .modal-btn-secondary')).toHaveText('Sulje')
    await expect(page.locator('.segment-details-modal .modal-btn-primary')).toHaveCount(0)
    await expect(page.locator('.segment-details-modal .modal-footer .modal-btn-destructive')).toHaveText('Poista pätkä')
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

    // T348/V252: tarkista ARVO, ei pelkkää olemassaoloa — `toBeTruthy` katkoviivalle on testi
    // joka ei voi failata (B135: vanha '1 9' oli "katkoviiva" mutta katosi taustakartalle).
    // ei_alkanut = '6 12' (haalea harva katko). Reitit + aukot ovat ehjiä.
    const dashPatterns = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
      return paths.map(p => p.getAttribute('stroke-dasharray') ?? '').filter(d => d !== '')
    })
    expect(dashPatterns.length).toBeGreaterThan(0)
    expect(dashPatterns).toContain('6 12')
  })

  // T348/V96-amend/B135: valmis pätkä saa POSITIIVISEN signaalin — vihreä viiva + ✓-lappu.
  // Ennen: valmis erottui vain katkon PUUTTUMISESTA, ja ✓ vain tarkastus-vaiheessa.
  // Tässä asettaminen-phase (oletusnäkymä) + kaikki pätkän merkit 'asetettu' → 'valmis'
  // ∴ testi todistaa nimenomaan sen että ✓ EI enää ole tarkastus-phasen yksinoikeus.
  test('valmis pätkä = vihreä ehjä viiva + ✓-nimilappu (T348)', async ({ page }) => {
    const VALMIS_SEGMENT = {
      id: 'seg-valmis-1', routeIds: ['smtb-30'],
      startDist: 2000, endDist: 8000,
      displayName: 'Valmispätkä', equipment: [],
      phase: 'asettaminen',
    }
    await page.route(/\/api\/segments(\?|$)/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([VALMIS_SEGMENT]) }))
    // Wire-muoto on snake_case (vrt. mockTalkoolainenSegment) — camelCase jättää route_ids
    // normalisoinnissa undefiniksi ja overlay kaatuu ennen renderiä.
    const doneMarker = (id: string, dist: number) => ({
      id, type: 'right', lat: 65.62, lon: 27.62, distance_from_start: dist,
      route_ids: ['smtb-30'], status: 'asetettu', location_note: null, color: null,
      label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
      description: null, images: [], created_by: null,
    })
    await mockMarkers(page, [doneMarker('mv1', 3000), doneMarker('mv2', 6000)])

    await mockAuthAsJarjestaja(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // T418/V309: lappu näkyy vain zoom ≥ 14 — tämä testi mittaa lapun ULKOASUA ∴ se ! olla
    // portin yllä (piilotettu lappu on `opacity:0`, mitattavat värit säilyisivät mutta testin
    // väite "järjestäjä NÄKEE ✓-lapun" ⊥ pitäisi).
    await zoomToShowSegmentLabels(page, { text: 'Valmispätkä' })

    // Lappu: ✓-prefix + --done-luokka
    const label = page.locator('.segment-label', { hasText: 'Valmispätkä' })
    await expect(label).toBeVisible()
    await expect(label).toHaveText('✓ Valmispätkä')
    await expect(label).toHaveClass(/segment-label--done/)

    // B106: lapun tausta pysyy kiinteänä navynä — vihreä tulee REUNUKSESTA, ei taustasta
    const bg = await label.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(bg).toBe('rgba(15, 23, 42, 0.85)')

    // Viiva: confirm-vihreä + ei dasharrayta
    const doneStroke = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
      return paths
        .map(p => ({ stroke: (p.getAttribute('stroke') ?? '').toLowerCase(), dash: p.getAttribute('stroke-dasharray') ?? '' }))
        .find(s => s.stroke === '#1f8a50')
    })
    expect(doneStroke).toBeDefined()
    expect(doneStroke!.dash).toBe('')
  })

  // T147: tarkastus-vaiheen pätkäjako (luotu T146:n klooni-mekanismilla) näyttää
  // talkoolaisen segment-view:ssä tarkastus-UI:n numeerisen X/N-progressin sijaan.
  test('tarkastus-segmentti näyttää segment-view:ssä "Merkitse tarkastetuksi" -UI:n', async ({ page }) => {
    const MOCK_TARKASTUS_SEGMENT = {
      id: 'seg-tarkastus-1', routeIds: ['smtb-30'],
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
      id: 'seg-aset-1', routeIds: ['smtb-30'],
      startDist: 0, endDist: 20000,
      displayName: 'Asetuspätkä', equipment: [],
      phase: 'asettaminen', assignedCode: 'ASET01',
    }
    // Kaksi suunniteltu-merkkiä — 'late' ensin listalla mutta 'early' on lähempänä pätkän alkua.
    // T361/V259: koordinaatit ovat OIKEILTA smtb-30-reittipisteiltä (982 m & 2994 m). Ennen
    // T358–T361:tä tässä oli lat 63.0/27.0 — ~290 km reitistä — ja järjestys tuli keksitystä
    // `distance_from_start`-skalaarista. Jäljen akselilla (V259) km lasketaan GEOMETRIASTA ∴
    // fixture jonka merkit eivät ole reitillä ei enää mittaa mitään todellista.
    const MARKERS = [
      { id: 'late', type: 'right', lat: 65.622415, lon: 27.627049, distance_from_start: 2994, route_ids: ['smtb-30'], status: 'suunniteltu' },
      { id: 'early', type: 'left', lat: 65.609487, lon: 27.623375, distance_from_start: 982, route_ids: ['smtb-30'], status: 'suunniteltu' },
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

    // Hero näkyy ja osoittaa ensimmäiseen merkkiin (early). V259: lukema on matka PÄTKÄN
    // jälkeä pitkin — pätkä alkaa reitin alusta (startDist 0) ∴ 1.0 km on sama kuin reitin km.
    await expect(page.locator('.segment-view-next')).toBeVisible()
    await expect(page.locator('.segment-view-next-meta')).toHaveText('1.0 km')
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
      id: 'seg-bounds-1', routeIds: ['smtb-30'], startDist: 0, endDist: 10000,
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

    // T264/V184: rajojen muokkaus siirtyi "Kaikki merkit" -tabiin (accordion poistettu) → avaa tab.
    await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
    await page.locator('.segment-view-bounds-toggle').scrollIntoViewIfNeeded()
    await page.locator('.segment-view-bounds-toggle').click()
    await page.locator('.segment-view-bounds-end').fill('15')
    await page.locator('.segment-view-bounds-save').click()
    await page.waitForTimeout(500)

    expect(segPuts.length).toBeGreaterThan(0)
    const patch = segPuts[0] as { startDist: number; endDist: number; track?: { d: number }[] }
    expect(patch).toMatchObject({ startDist: 0, endDist: 15000 })

    // T363/V258: rajat & JÄLKI liikkuvat yhdessä. Jos jälki jäisi jälkeen, jäsenyys (V259)
    // vastaisi rajaa jota ⊥ enää ole — talkoolainen näkisi merkkejä jotka hän juuri rajasi pois.
    expect(Array.isArray(patch.track)).toBe(true)
    expect(patch.track!.length).toBeGreaterThan(1)
    expect(patch.track![0].d).toBe(0)
    // smtb-30 on 4.6 km ∴ 15 km raja typistyy reitin loppuun — jälki kertoo TODELLISEN pituuden,
    // ⊥ pyydettyä `endDist − startDist`iä (V258: pituus on jäljen viimeinen `d`).
    const trackLen = patch.track![patch.track!.length - 1].d
    expect(trackLen).toBeGreaterThan(4000)
    expect(trackLen).toBeLessThan(5000)
  })
})

// T374/V269/B157: reitin näkyvyys on YKSI kytkin joka koskee ∀ siihen reittiin ankkuroitua
// kerrosta. Ennen tätä `RouteVisibilityControl` piilotti polylinen & merkit, mutta pätkäviivat
// & nimilaput jäivät leijumaan kartalle ilman reittiä jonka päällä olisivat.
test.describe('T374 — reitin piilotus vie pätkät mukanaan (V269)', () => {
  const seg = (id: string, routeId: string, name: string) => ({
    id, routeIds: [routeId], primaryRouteId: routeId,
    startDist: 1000, endDist: 4000,
    displayName: name, description: '', equipment: [],
    phase: 'asettaminen', inspected: false, completed: false,
  })
  // V139: reititön tehtävä ⊥ ole minkään reitin varassa ∴ reittisuodatin ⊥ saa hukata sitä.
  const ROUTELESS = {
    id: 'seg-routeless', displayName: 'Keräyskasat', description: '', equipment: [],
    phase: 'asettaminen', inspected: false, completed: false,
  }

  test('piilota reitti → sen pätkän nimilappu katoaa, toisen reitin & reitittömän jää', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.route(/\/api\/segments(\?|$)/, r =>
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([seg('seg-30', 'smtb-30', 'Kolmekymppi'), seg('seg-55', 'smtb-55', 'Viisviitonen'), ROUTELESS]),
      }))
    await mockMarkers(page, [])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    const label30 = page.locator('.segment-label', { hasText: 'Kolmekymppi' })
    const label55 = page.locator('.segment-label', { hasText: 'Viisviitonen' })
    await expect(label30).toHaveCount(1)
    await expect(label55).toHaveCount(1)

    // Piilota 30 km suodatinbarista (T377: Reitit-dropdown → rivi togglaa).
    await page.locator('.map-filter-dropdown[data-filter="routes"] .map-filter-trigger').click()
    await page.locator('.map-filter-route-row[data-route-id="smtb-30"] .map-filter-route-toggle').click()
    await page.waitForTimeout(300)

    // B157: pätkäviiva & lappu katoavat reitin MUKANA — ⊥ jää leijumaan.
    await expect(label30).toHaveCount(0)
    await expect(label55).toHaveCount(1)
    // Reititön tehtävä ⊥ piirrä viivaa lainkaan, mutta se ! säilyä listalla (⊥ katoa suodattimesta).
    await expect(page.locator('#segment-list', { hasText: 'Keräyskasat' })).toHaveCount(1)

    // Takaisin näkyviin → lappu palaa (tila ⊥ jää jumiin).
    await page.locator('.map-filter-route-row[data-route-id="smtb-30"] .map-filter-route-toggle').click()
    await page.waitForTimeout(300)
    await expect(label30).toHaveCount(1)
  })
})
