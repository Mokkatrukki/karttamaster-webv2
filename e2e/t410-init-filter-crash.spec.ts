import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers } from './helpers/auth'

// T410/V300/V301 (B169): järjestäjän init kaatui kun localStoragessa oli persistoitu
// karttasuodatin jossa `visibleRouteIds` ≠ undefined. `MapFilterBar`in ctor kutsuu `onChange`in
// synkronisesti → `routeVis.setVisibleRoutes` → `markerManager.onUpdate` → `progressBar` jota
// ⊥ vielä ollut → koko `wireMarkers` heitti ∴ `MarkerOverviewPanel` jäi rakentamatta:
// tyhjä sivupalkki & kuollut `#btn-list`. Oletussuodattimella `visibleRouteIds` on undefined
// ∴ mikään aiempi testi ⊥ osunut tähän — tämä testi seedaa PERSISTOIDUN tilan ennen latausta.

const MARKERS = [
  {
    id: 'mk-t410-a', type: 'right', lat: 65.62, lon: 27.62, distance_from_start: 1000,
    route_ids: ['smtb-30'], status: 'suunniteltu', location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  },
  {
    id: 'mk-t410-b', type: 'left', lat: 65.63, lon: 27.63, distance_from_start: 2000,
    route_ids: ['smtb-30'], status: 'asetettu', location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  },
]

test('persistoitu visibleRouteIds ⊥ kaada järjestäjän initiä (B169)', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', e => pageErrors.push(e.message))

  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, MARKERS)

  // Suodatin PITÄÄ olla kannassa ennen ensimmäistä latausta — kaato tapahtui initissä.
  await page.addInitScript(() => {
    localStorage.setItem('karttamaster-map-filter', JSON.stringify({
      visibleRouteIds: ['smtb-30'],
      markerStatuses: ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen'],
      segmentStates: ['ei_alkanut', 'kesken', 'valmis'],
      dimLevel: 'kevyt',
      onlyOrphans: false,
    }))
    localStorage.setItem('karttamaster-marker-overview-open', '0')
  })

  await page.goto('/')
  await page.waitForSelector('#btn-list', { state: 'visible' })

  // V301: init ⊥ saa heittää.
  expect(pageErrors, `init heitti: ${pageErrors.join(' | ')}`).toEqual([])

  // V300: paneeli on KONSTRUOITU (luokka tulee ctorista) — ei pelkkä tyhjä <div hidden>.
  const overview = page.locator('#marker-overview')
  await expect(overview).toHaveClass(/marker-overview/)

  // #btn-list ⊥ ole kuollut nappi & merkit näkyvät sivupalkissa.
  await page.locator('#btn-list').click()
  await expect(overview).toBeVisible()
  await expect(overview.locator('.marker-overview-item')).toHaveCount(MARKERS.length)
})
