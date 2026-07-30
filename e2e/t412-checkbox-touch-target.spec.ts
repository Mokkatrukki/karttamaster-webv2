import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockMarkers } from './helpers/auth'

// T412/V303 (B171): `.marker-item-checkbox` oli niputettu `.bulk-action-bar`-säännön kanssa &
// ne tyylit ovat BARIN tyylejä. Natiivi checkbox (`appearance:auto`) ⊥ kunnioita paddingia ∴
// järjestäjän ruutu jäi selaimen oletukseen: MITATTU 13×13 vaikka CSS-kommentti lupasi 44×44.
// Vika selvisi 2004 vitestistä & koko e2e-sviitistä koska mikään ⊥ mitannut pikseleitä.
// V303: **luvattu kosketuskohde ! olla mitattu.** Tämä testi on se mitta — molemmille pinnoille.

const MIN = 44

function marker(id: string, dist: number, status = 'suunniteltu') {
  return {
    id, type: 'right', lat: 65.62, lon: 27.62, distance_from_start: dist,
    route_ids: ['smtb-30'], status, location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }
}

test.use({ viewport: { width: 390, height: 844 } })

test('järjestäjän merkkijono: checkbox ≥44×44 & valinta toimii (B171)', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [marker('mk-a', 1000), marker('mk-b', 2000)])
  await page.goto('/')
  await page.waitForSelector('#map-filter-bar', { state: 'visible' })
  await page.locator('#btn-list').click()

  const cb = page.locator('.marker-overview-item .marker-item-checkbox').first()
  await expect(cb).toBeVisible()
  const box = await cb.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(MIN)
  expect(box!.height).toBeGreaterThanOrEqual(MIN)

  // Ruutu on yhä toimiva checkbox — `appearance:none` ⊥ saa viedä toiminnallisuutta.
  await cb.click()
  await expect(cb).toBeChecked()
})

test('järjestäjän rivi mahtuu 390px:iin leveämmän ruudun kanssa (⊥ vaakascrollia)', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [marker('mk-a', 1000), marker('mk-b', 2000)])
  await page.goto('/')
  await page.waitForSelector('#map-filter-bar', { state: 'visible' })
  await page.locator('#btn-list').click()

  const row = page.locator('.marker-overview-item').first()
  await expect(row).toBeVisible()
  // Rivin sisältö ⊥ saa vuotaa paneelin ulkopuolelle (13px→44px vei 31px riviltä).
  const overflow = await row.evaluate(el => el.scrollWidth - el.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  // Nimi pysyy näkyvissä ⊥ nollalevyisenä.
  const label = await row.locator('.marker-type-label').boundingBox()
  expect(label!.width).toBeGreaterThan(40)
})

test('talkoolaisen pätkälista: checkbox ≥44×44 (sama jaettu sääntö)', async ({ page }) => {
  await mockAuthAsTalkoolainen(page)
  await mockTalkoolainenSegment(page)
  await mockMarkers(page, [marker('mk-a', 3000), marker('mk-b', 5000)])
  await page.goto('/s/TEST01')
  await page.waitForTimeout(1500)
  await page.locator('.segment-koti-tab[data-tab="merkit"]').click()

  const cb = page.locator('.segment-view-markers-item .marker-item-checkbox').first()
  const box = await cb.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(MIN)
  expect(box!.height).toBeGreaterThanOrEqual(MIN)

  // "Valitse kaikki" -label on myös kosketuskohde, ⊥ vain 22px ruutu.
  const all = await page.locator('.bulk-action-bar > label').boundingBox()
  expect(all!.height).toBeGreaterThanOrEqual(MIN)
})
