import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockMarkers, mockSegmentWrites } from './helpers/auth'

// T416/V306: talkoolainen ottaa VIERAAN merkin omaan tehtäväänsä kartalta. Vitest todistaa
// komponentin & managerin sopimukset; tämä todistaa että KYTKENTÄ sovellukseen on olemassa —
// himmeä merkki ottaa klikin, lehtinen avautuu, lisäys näkyy listassa & muokkaus pysyy kiellettynä.

function marker(id: string, dist: number, lat: number) {
  return {
    id, type: 'right', lat, lon: 27.62, distance_from_start: dist,
    route_ids: ['smtb-30'], status: 'suunniteltu', location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }
}

test.use({ viewport: { width: 390, height: 844 } })

/**
 * `mk-vieras` istutetaan KAUAS reitistä (0,5° pohjoiseen) ∴ se ⊥ kuulu pätkään & renderöityy
 * himmeänä (V243). Jäsenyys ratkeaa KOORDINAATISTA ⊥ syötetystä km:stä: `backfillNearestRoute`
 * (T392/V284) laskee lähimmän reitin & km:n uudelleen latauksessa.
 *
 * Kartta fittaa pätkään ∴ vieras merkki on aluksi näkymän ULKOPUOLELLA — Leaflet renderöi sen
 * DOM:iin mutta klikki ⊥ osu. `panToVieras` siirtää näkymän sen kohdalle: sama ele jonka
 * talkoolainen tekee kentällä (hän panoroi karttaa nähdäkseen naapurin merkin).
 */
async function panToVieras(page: import('playwright/test').Page): Promise<void> {
  // Talkoolaisen KOTI-moodissa kartta ⊥ ole näkyvissä (V174-176) ∴ moodi ! vaihtaa ensin —
  // muuten klikki osuu piilotettuun elementtiin.
  await page.click('#btn-to-map')
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const map = (window as unknown as Record<string, unknown>)['__testMap'] as {
      setView(ll: [number, number], z: number): void
    }
    map.setView([66.12, 27.62], 14)
  })
  await page.waitForTimeout(600)
}
test('himmeä merkki → "Lisää tehtävääni" → merkki siirtyy omaan listaan (T416)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await mockTalkoolainenSegment(page)
  await mockSegmentWrites(page)
  await mockMarkers(page, [
    marker('mk-oma', 5000, 65.62),
    marker('mk-vieras', 8000, 66.12),
  ])
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1500)

  // Oma merkki on listalla, vieras ei.
  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
  await expect(page.locator('.segment-view-markers-item[data-id="mk-oma"]')).toHaveCount(1)
  await expect(page.locator('.segment-view-markers-item[data-id="mk-vieras"]')).toHaveCount(0)

  // Vieras merkki on kartalla HIMMEÄNÄ (V243: kartta ⊥ valehtele) & claimable-kanavassa (V306).
  await panToVieras(page)
  const vieras = page.locator('.leaflet-marker-icon.marker-dimmed--claimable').first()
  await expect(vieras).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon.marker-dimmed--locked')).toHaveCount(0)

  await vieras.click({ force: true })

  // Rajoitettu lehtinen: TASAN 2 nappia, ⊥ muokkauskenttiä (V306).
  const sheet = page.locator('.marker-claim-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('button')).toHaveCount(2)
  await expect(sheet.locator('input, textarea, select')).toHaveCount(0)
  await expect(page.locator('.marker-detail-modal')).toHaveCount(0)

  await sheet.locator('.marker-claim-confirm').click()
  await expect(sheet).toHaveCount(0)

  // Lisäys näkyy: merkki on nyt omalla listalla & kartalla kirkkaana.
  await expect(page.locator('.segment-view-markers-item[data-id="mk-vieras"]')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon.marker-dimmed--claimable')).toHaveCount(0)
})

test('himmeä merkki ⊥ tarjoa muokkausta: "Sulje" ⊥ mutatoi & detail-modaali ⊥ avaudu (T416)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await mockTalkoolainenSegment(page)
  await mockSegmentWrites(page)
  await mockMarkers(page, [
    marker('mk-oma', 5000, 65.62),
    marker('mk-vieras', 8000, 66.12),
  ])
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1500)

  await panToVieras(page)
  await page.locator('.leaflet-marker-icon.marker-dimmed--claimable').first().click({ force: true })
  await page.locator('.marker-claim-close').click()
  await expect(page.locator('.marker-claim-sheet')).toHaveCount(0)

  // Takaisin koti-moodiin: lista elää siellä (V174-176).
  await page.click('#btn-home-view')
  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
  await expect(page.locator('.segment-view-markers-item[data-id="mk-vieras"]')).toHaveCount(0)
  // Himmeä merkki ⊥ ole raahattava (V150) — Leaflet asettaa draggable-luokan vain raahattaville.
  await expect(page.locator('.leaflet-marker-icon.marker-dimmed--claimable.leaflet-marker-draggable')).toHaveCount(0)
})
