import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockMarkers } from './helpers/auth'

// T409/V292 (VISION §Kenttätyö): talkoolaisen VALIKOIVA bulk-kuittaus koti-tabissa.
// Kyky oli poissa tuotannosta T264:stä asti (`#btn-list` piilotettiin & `.bulk-action-bar` jäi
// kuolleeksi koodiksi poistuneeseen `marker-list.ts`:ään). Tämä testi ajaa koko ketjun oikeassa
// sovelluksessa: valinta → `bulkSetStatus` → lista & ryhmät päivittyvät. Vitest todistaa
// komponentin sopimuksen; tämä todistaa että KYTKENTÄ sovellukseen on olemassa.

function marker(id: string, dist: number, status: string) {
  return {
    id, type: 'right', lat: 65.62, lon: 27.62, distance_from_start: dist,
    route_ids: ['smtb-30'], status, location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }
}

test.use({ viewport: { width: 390, height: 844 } })

test('koti-tab: valitse 2 → "Aseta valituille" → statukset muuttuvat (T409)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await mockTalkoolainenSegment(page)
  // 2 asettamatonta + 1 terminaali (kerätty) — terminaali ⊥ saa checkboxia.
  await mockMarkers(page, [
    marker('mk-a', 3000, 'suunniteltu'),
    marker('mk-b', 5000, 'suunniteltu'),
    marker('mk-kerätty', 7000, 'kerätty'),
  ])
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1500)

  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
  await expect(page.locator('.segment-view-markers')).toBeVisible()
  await expect(page.locator('.segment-view-markers-row')).toHaveCount(3)

  // Terminaali rivi ⊥ ole valittavissa ∴ checkboxeja on 2, ei 3.
  await expect(page.locator('.segment-view-markers-item .marker-item-checkbox')).toHaveCount(2)
  await expect(page.locator('.bulk-action-bar')).toBeVisible()

  // 0 valittua → napit disabloitu (klikki ilman valintaa olisi hiljainen no-op).
  const aseta = page.locator('.btn-bulk-checkin-aseta')
  await expect(aseta).toBeDisabled()

  await page.locator('.segment-view-markers-item[data-id="mk-a"] .marker-item-checkbox').click()
  await page.locator('.segment-view-markers-item[data-id="mk-b"] .marker-item-checkbox').click()
  await expect(aseta).toHaveText('✓ Aseta valituille (2)')
  await aseta.click()

  // Molemmat siirtyivät "Asetetut"-ryhmään & valinta nollautui.
  await expect(page.locator('.segment-view-markers-item[data-id="mk-a"] .segment-view-markers-meta'))
    .toContainText('Asetettu')
  await expect(page.locator('.segment-view-markers-item[data-id="mk-b"] .segment-view-markers-meta'))
    .toContainText('Asetettu')
  await expect(page.locator('.segment-view-markers-group', { hasText: 'Asettamatta' })).toHaveCount(0)
  await expect(aseta).toBeDisabled()
})

test('koti-tab: "Valitse kaikki" + "Ei tarpeen" ohittaa valitut (T409)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await mockTalkoolainenSegment(page)
  await mockMarkers(page, [marker('mk-a', 3000, 'suunniteltu'), marker('mk-b', 5000, 'suunniteltu')])
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1500)

  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
  await page.locator('.bulk-select-all').click()
  const ohita = page.locator('.btn-bulk-checkin-ohita')
  await expect(ohita).toHaveText('Ei tarpeen (2)')
  await ohita.click()

  await expect(page.locator('.segment-view-markers-group', { hasText: 'Ei tarpeen' })).toHaveCount(1)
  await expect(page.locator('.segment-view-markers-item[data-id="mk-a"] .segment-view-markers-meta'))
    .toContainText('Ei tarpeen')
})
