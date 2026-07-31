/**
 * T452/V335,V336 — kasan sijoitus ilman GPS-fixiä oikeassa selaimessa.
 *
 * B182: sijoitustila armattiin kotimoodissa jossa `#map` on `display:none` ∴ sovellus pyysi
 * napauttamaan pintaa jota ei ollut renderöity — kasaa ei voinut luoda lainkaan.
 * B183: ohjerivi meni `#segment-view-containeriin` joka on `pointer-events:none` ∴ "Peruuta"
 * näkyi mutta ei ottanut klikkiä. **jsdom ei tunne `pointer-events`ia — tämä on ainoa taso
 * jolla se näkyy.**
 * B184: ohje + hero peittivät kartan juuri kun karttaa pitää napauttaa.
 *
 * Mobiiliviewport (390×844) on oletus: siellä pystytila loppuu ensin.
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'
import { pointAtDistance } from './helpers/route-points'

const CODE = 'PURKU2'

const at = (m: number): { lat: number; lon: number } => {
  const [lat, lon] = pointAtDistance(m)
  return { lat, lon }
}

const MARKER_BASE = {
  type: 'right', route_ids: ['smtb-30'], location_note: null, color: null,
  icon_id: null, image_id: null, template_id: null, parts_json: null,
  description: null, images: [], created_by: null, pile_marker_ids: null,
}

async function mockPurkuSegment(page: Page): Promise<{ posted: unknown[] }> {
  const seg = {
    id: 'seg-purku2', routeIds: ['smtb-30'], startDist: 0, endDist: 20000,
    assignedCode: CODE, displayName: 'Purkupätkä', description: '', equipment: [],
    phase: 'purku', inspected: false, completed: false,
  }
  const markers = [
    { ...MARKER_BASE, id: 'q-alku', ...at(1000), distance_from_start: 1000, status: 'asetettu', label: 'Alku' },
    { ...MARKER_BASE, id: 'q-keski', ...at(2500), distance_from_start: 2500, status: 'asetettu', label: 'Keski' },
  ]
  const posted: unknown[] = []
  await page.route(new RegExp(`/api/segments/by-code/${CODE}$`), r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seg) }))
  await page.route(/\/api\/markers(\?|\/|$)/, r => {
    const req = r.request()
    if (req.method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(markers) })
    }
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      posted.push(body)
      return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) })
    }
    const patch = req.postDataJSON() as Record<string, unknown>
    const id = req.url().split('/').pop()!
    const m = markers.find(x => x.id === id)
    if (m && typeof patch.status === 'string') m.status = patch.status
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m ?? {}) })
  })
  return { posted }
}

/**
 * Avaa purkupätkän, kerää molemmat merkit kartan herosta & PALAA KOTIIN.
 * GPS:ää ei kytketä päälle ∴ kasa vaatii karttanapautuksen (T430-polku) — ja juuri se polku
 * oli kotimoodissa umpisolmu (B182).
 */
async function collectThenGoHome(page: Page): Promise<void> {
  await page.route(/\/api\/phase$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phase: 'purku' }) }))
  await mockAuthAsTalkoolainen(page, CODE)
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)

  const toMap = page.locator('#btn-to-map')
  if (await toMap.isVisible()) await toMap.click()
  await page.waitForTimeout(400)

  // Kuittaus herosta (T422) — sama polku kuin t420-t425-purku.spec.ts:ssä.
  for (let i = 0; i < 2; i++) {
    await page.locator('.segment-view-next-set').click()
    await page.waitForTimeout(300)
  }

  await page.locator('#btn-home-view').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app')).toHaveAttribute('data-view-mode', 'koti')
}

test.use({ viewport: { width: 390, height: 844 } })

test('T452/V335 — kotimoodissa kasanappi tuo kartan näkyviin (B182: ennen umpisolmu)', async ({ page }) => {
  await mockPurkuSegment(page)
  await collectThenGoHome(page)

  const pile = page.locator('.segment-view-pile-btn')
  await expect(pile).toBeVisible()
  await pile.click()
  await page.waitForTimeout(500)

  // Kartta ON näkyvissä — muuten sijoitustila pyytää napauttamaan pintaa jota ei ole.
  await expect(page.locator('#app')).toHaveAttribute('data-view-mode', 'kartta')
  const map = page.locator('#map')
  await expect(map).toBeVisible()
  const mapBox = await map.boundingBox()
  expect(mapBox!.height).toBeGreaterThan(0)

  // B184: kartta jää MERKITTÄVÄSTI näkyviin — ohje ei saa työntää sitä ulos (390×844).
  expect(mapBox!.height).toBeGreaterThan(844 * 0.35)

  // Ohjerivi on paneelin sisällä (V336) & kasanappi on poissa tieltä sijoitustilan ajan.
  await expect(page.locator('#segment-view .pile-place-hint')).toBeVisible()
  await expect(pile).toBeHidden()
})

test('T452/V336 — "Peruuta" on oikeasti klikattava & palauttaa kotimoodin (B183)', async ({ page }) => {
  await mockPurkuSegment(page)
  await collectThenGoHome(page)

  await page.locator('.segment-view-pile-btn').click()
  await page.waitForTimeout(500)

  const cancel = page.locator('.pile-place-hint-cancel')
  await expect(cancel).toBeVisible()
  const box = await cancel.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)

  // TÄMÄ on testin ydin: klikki menee perille. `pointer-events:none` -kontissa se ei mennyt,
  // eikä yksikään jsdom-testi voinut nähdä sitä.
  await cancel.click({ timeout: 3000 })
  await page.waitForTimeout(400)

  await expect(page.locator('.pile-place-hint')).toBeHidden()
  // Peruutus palauttaa käyttäjän sinne mistä hän tuli.
  await expect(page.locator('#app')).toHaveAttribute('data-view-mode', 'koti')
  await expect(page.locator('.segment-view-pile-btn')).toBeVisible()
})

test('T452/V336 — karttamoodissa aloitettu sijoitus: Peruuta ottaa klikin (B183:n ydin)', async ({ page }) => {
  await mockPurkuSegment(page)
  await collectThenGoHome(page)
  // Takaisin kartalle: sijoitus alkaa NYT karttamoodista ∴ ohjerivi syntyy siihen kerrokseen
  // jossa vanha koodi asetti sen `#segment-view-containeriin` = `pointer-events:none`.
  await page.locator('#btn-to-map').click()
  await page.waitForTimeout(400)

  await page.locator('.segment-view-pile-btn').click()
  await page.waitForTimeout(500)

  const cancel = page.locator('.pile-place-hint-cancel')
  await expect(cancel).toBeVisible()
  // Klikki ilman `force`ia: kuollut kerros hylkää sen (Playwright odottaa osumatestiä).
  await cancel.click({ timeout: 4000 })
  await page.waitForTimeout(400)
  await expect(page.locator('.pile-place-hint')).toBeHidden()
  await expect(page.locator('.segment-view-pile-btn')).toBeVisible()
})

test('T452 — karttanapautus → vahvistus → kasa syntyy (V320 ilman GPS-fixiä)', async ({ page }) => {
  const { posted } = await mockPurkuSegment(page)
  await collectThenGoHome(page)

  await page.locator('.segment-view-pile-btn').click()
  await page.waitForTimeout(500)

  const mapBox = (await page.locator('#map').boundingBox())!
  await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 3)
  await page.waitForTimeout(700)

  const confirm = page.locator('.pile-confirm')
  await expect(confirm).toBeVisible()
  await expect(confirm.locator('.pile-contents-total')).toContainText('2 merkkiä')
  await confirm.locator('.pile-confirm-ok').click()
  await page.waitForTimeout(700)

  const kasat = posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')
  expect(kasat.length).toBe(1)
  expect((kasat[0] as { pile_marker_ids: string[] }).pile_marker_ids).toHaveLength(2)
})
