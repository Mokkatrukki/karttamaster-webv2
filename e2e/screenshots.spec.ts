import { test } from 'playwright/test'
import type { Page } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen } from './helpers/auth'
import { snap } from './helpers/snap'

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
const LOAD = 2500

const MOCK_SEGMENT = {
  id: 'seg-01', routeIds: ['35km'],
  startDist: 0, endDist: 12500,
  displayName: 'Pätkä 1', description: 'Testipätkä',
  assignedCode: undefined, equipment: [],
  phase: 'asettaminen',
}

const MOCK_AREA = {
  id: 'area-01', name: 'Huolto', centerLat: 65.627, centerLng: 27.628,
  widthM: 400, heightM: 250, rotation: 0,
  markdownDescription: 'Huoltopiste', status: 'suunniteltu', hashCode: 'h1',
  features: [
    { id: 'f1', name: 'Teltta', centerLat: 65.627, centerLng: 27.628, widthM: 100, heightM: 80, rotation: 0, color: '#3b82f6' },
    { id: 'f2', name: 'WC', centerLat: 65.628, centerLng: 27.629, widthM: 50, heightM: 40, rotation: 0, color: '#10b981' },
  ],
}

// ServerMarker format — fromServer() maps snake_case → camelCase
const MOCK_MARKER = {
  id: 'mk-01', type: 'right', lat: 65.627, lon: 27.628,
  distance_from_start: 3200, route_ids: ['35km'],
  status: 'suunniteltu', location_note: null, color: null, label: null,
}

async function mockAllApis(page: Page) {
  await page.route('/api/segments', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_SEGMENT]) }))
  await page.route('/api/areas', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_AREA]) }))
  await page.route('/api/markers', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_MARKER]) }))
  await page.route('/api/markers/mk-01', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MARKER) }))
}

async function mockAdminWithData(page: Page) {
  await mockAuthAsJarjestaja(page)
  await mockAllApis(page)
}

async function mockTalkoolainenWithData(page: Page) {
  await mockAuthAsTalkoolainen(page)
  await mockAllApis(page)
}

// --- Auth ---

test('auth_screen', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(1000)
  await snap(page, 'auth_screen')
})

// --- Admin desktop ---

test('admin_desktop_initial', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await snap(page, 'admin_desktop_initial')
})

test('admin_desktop_left-panel-closed', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#left-panel-toggle')
  await page.waitForTimeout(300)
  await snap(page, 'admin_desktop_left-panel-closed')
})

test('admin_desktop_sign-library-edit-modal', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  // Merkkikirjasto on auki oletuksena — klikkaa ··· ensimmäisellä rivillä
  await page.locator('.sign-lib-dots-btn').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_sign-library-edit-modal')
})

test('admin_desktop_segment-panel-expanded', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Pätkäjako' }).click()
  await page.waitForTimeout(300)
  await snap(page, 'admin_desktop_segment-panel-expanded')
})

test('admin_desktop_segment-creation-modal', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Pätkäjako' }).click()
  await page.waitForTimeout(300)
  await page.click('#btn-segment-create')
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_segment-creation-modal')
})

test('admin_desktop_segment-details-modal', async ({ page }) => {
  await mockAdminWithData(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Pätkäjako' }).click()
  await page.waitForTimeout(300)
  await page.locator('.btn-segment-details-open').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_segment-details-modal')
})

test('admin_desktop_area-panel-expanded', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Alueet' }).click()
  await page.waitForTimeout(300)
  await snap(page, 'admin_desktop_area-panel-expanded')
})

test('admin_desktop_area-features-expanded', async ({ page }) => {
  await mockAdminWithData(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Alueet' }).click()
  await page.waitForTimeout(300)
  // expand-napilla ei ole class, käytetään aria-label
  await page.locator('[aria-label="Näytä komponentit"]').first().click()
  await page.waitForTimeout(300)
  await snap(page, 'admin_desktop_area-features-expanded')
})

test('admin_desktop_area-details-modal', async ({ page }) => {
  await mockAdminWithData(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.locator('.left-panel-section-header').filter({ hasText: 'Alueet' }).click()
  await page.waitForTimeout(300)
  await page.locator('.btn-area-dots').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_area-details-modal')
})

test('admin_desktop_marker-modal', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await snap(page, 'admin_desktop_marker-modal')
})

test('admin_desktop_marker-detail-modal', async ({ page }) => {
  await mockAdminWithData(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await page.locator('.marker-item').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_marker-detail-modal')
})

test('admin_desktop_snapshot-modal', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-snapshot-panel')
  await page.waitForTimeout(400)
  await snap(page, 'admin_desktop_snapshot-modal')
})

// --- Admin mobile ---

test('admin_mobile_initial', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await snap(page, 'admin_mobile_initial')
})

test('admin_mobile_marker-modal', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await snap(page, 'admin_mobile_marker-modal')
})

// --- Talkoolainen desktop ---

test('talkoolainen_desktop_initial', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await snap(page, 'talkoolainen_desktop_initial')
})

test('talkoolainen_desktop_marker-modal', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await snap(page, 'talkoolainen_desktop_marker-modal')
})

test('talkoolainen_desktop_marker-detail-modal', async ({ page }) => {
  await mockTalkoolainenWithData(page)
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await page.locator('.marker-item').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'talkoolainen_desktop_marker-detail-modal')
})

// --- Talkoolainen mobile ---

test('talkoolainen_mobile_initial', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await snap(page, 'talkoolainen_mobile_initial')
})

test('talkoolainen_mobile_marker-modal', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await snap(page, 'talkoolainen_mobile_marker-modal')
})

test('talkoolainen_mobile_marker-detail-modal', async ({ page }) => {
  await mockTalkoolainenWithData(page)
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await page.waitForTimeout(LOAD)
  await page.click('#btn-menu')
  await page.waitForTimeout(300)
  await page.click('#btn-list')
  await page.waitForTimeout(500)
  await page.locator('.marker-item').first().click()
  await page.waitForTimeout(400)
  await snap(page, 'talkoolainen_mobile_marker-detail-modal')
})
