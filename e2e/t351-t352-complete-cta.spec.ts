/**
 * T351/V254 (B137) + T352/V255 (B138) — "merkitse pätkä valmiiksi" -sisääntulot.
 * T351: talkoolaisen valmis-toggle hero:n done-rivillä; ⋯-valikon duplikaatti poistettu.
 * T352: järjestäjän valmis-toggle pätkämodaalissa (ennen: ⊥ mitään reittiä).
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen, mockSegmentWrites, mockMarkers } from './helpers/auth'

const SEG = {
  id: 'seg-e2e', routeIds: ['smtb-30'], startDist: 0, endDist: 100000,
  assignedCode: 'TEST01', displayName: 'E2E-pätkä', description: '', equipment: [],
  phase: 'asettaminen', inspected: false, completed: false,
}

const doneMarker = {
  id: 'mk-e2e', type: 'right', lat: 65.62, lon: 27.62, distance_from_start: 5000,
  route_ids: ['smtb-30'], status: 'asetettu', location_note: null, color: null,
  label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
  description: null, images: [], created_by: null,
}

test.describe('T351 — talkoolaisen valmis-toggle hero:ssa', () => {
  test('kaikki merkit asetettu → nappi done-rivillä, ⊥ enää ⋯-valikossa', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await page.route(/\/api\/segments\/by-code\/TEST01$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEG) }))
    await mockSegmentWrites(page)
    await mockMarkers(page, [doneMarker])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)
    // T262/V182: hero on kartta-moodin ohjaus (koti näyttää varustelistan) → siirry kartalle.
    await page.click('#btn-to-map')
    await page.waitForTimeout(500)

    // Done-rivi + sen nappi samassa näkymässä (B137: ennen erillään).
    await expect(page.locator('.segment-view-next-done-title')).toContainText('Kaikki asetettu')
    const heroBtn = page.locator('.segment-hero-complete-btn')
    await expect(heroBtn).toBeVisible()
    await expect(heroBtn).toHaveText('✓ Merkitse pätkä valmiiksi')

    // 44px touch (talkoolainen metsässä, hanskat).
    const box = await heroBtn.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    // ⋯-valikon duplikaatti poistettu — ⊥ palauta (kaksi label-synkkaa ajautuu erilleen).
    await expect(page.locator('#btn-tk-complete')).toHaveCount(0)
  })

  test('klikki → PUT {completed:true} + label kääntyy', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await page.route(/\/api\/segments\/by-code\/TEST01$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEG) }))
    const puts: unknown[] = []
    await page.route(/\/api\/segments\/seg-e2e$/, r => {
      if (r.request().method() === 'PUT') puts.push(r.request().postDataJSON())
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await mockMarkers(page, [doneMarker])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)
    await page.click('#btn-to-map')
    await page.waitForTimeout(500)

    await page.locator('.segment-hero-complete-btn').click()
    await page.waitForTimeout(500)
    expect(puts).toContainEqual(expect.objectContaining({ completed: true }))
    await expect(page.locator('.segment-hero-complete-btn')).toHaveText('↩ Merkitse keskeneräiseksi')
  })
})

test.describe('T353 — kuittaus näkyy järjestäjän tilannekuvassa (B139)', () => {
  test('kuitattu pätkä = vihreä ehjä viiva + ✓-lappu VAIKKA merkit kesken', async ({ page }) => {
    const keskenMarker = { ...doneMarker, status: 'suunniteltu' }
    await mockAuthAsJarjestaja(page)
    await page.route(/\/api\/segments(\?|$)/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...SEG, completed: true }]) }))
    await mockMarkers(page, [keskenMarker])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Kartta: kuittaus voittaa laskurin (0/1 asetettu, silti valmis-viiva).
    const doneStroke = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
      return paths
        .map(p => ({ stroke: (p.getAttribute('stroke') ?? '').toLowerCase(), dash: p.getAttribute('stroke-dasharray') ?? '' }))
        .find(s => s.stroke === '#1f8a50')
    })
    expect(doneStroke).toBeDefined()
    expect(doneStroke!.dash).toBe('')
    await expect(page.locator('.segment-label', { hasText: 'E2E-pätkä' })).toHaveText('✓ E2E-pätkä')

    // Lista: kuittaus omana merkintänään, laskuri EI korvaudu (ristiriita näkyviin).
    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.segment-kuitattu')).toBeVisible()
    await expect(page.locator('.segment-km')).toHaveText('0/1 asetettu')
  })

  test('kuittaamaton pätkä → ⊥ kuittausmerkintää listassa', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.route(/\/api\/segments(\?|$)/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SEG]) }))
    await mockMarkers(page, [doneMarker])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)
    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.segment-kuitattu')).toBeHidden()
  })
})

test.describe('T352 — järjestäjän valmis-toggle pätkämodaalissa', () => {
  test('modaalista voi kuitata pätkän valmiiksi (⊥ ⋯-valikkoa järjestäjälle)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.route(/\/api\/segments(\?|$)/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SEG]) }))
    const puts: unknown[] = []
    await page.route(/\/api\/segments\/seg-e2e$/, r => {
      if (r.request().method() === 'PUT') puts.push(r.request().postDataJSON())
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await mockMarkers(page, [doneMarker])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    // Talkoolaisen ⋯-toiminnot piilossa järjestäjältä (data-role-hide) — juuri siksi
    // järjestäjä tarvitsee modaalin sisääntulon (B138).
    await expect(page.locator('#tk-menu-actions')).toBeHidden()

    await page.locator('.segment-panel-header').click()
    await page.waitForTimeout(200)
    await page.locator('.segment-info').first().click()
    await page.waitForTimeout(300)

    const toggle = page.locator('.btn-segment-complete-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveText('✓ Merkitse pätkä valmiiksi')

    await toggle.click()
    await page.waitForTimeout(500)
    expect(puts).toContainEqual(expect.objectContaining({ completed: true }))
    await expect(toggle).toHaveText('↩ Merkitse keskeneräiseksi')
    await expect(page.locator('.segment-details-complete-status')).toHaveText('Pätkä merkitty valmiiksi ✓')
  })
})
