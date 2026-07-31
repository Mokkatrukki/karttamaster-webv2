/**
 * T420–T425 — purkuvaiheen kenttäpolku talkoolaisen silmin.
 *
 * Kenttätilanne: pätkä on merkattu, tapahtuma ohi, talkoolainen ajaa saman pätkän SAMAAN
 * suuntaan uudelleen ja kerää merkit pois. Kun kädet ovat täynnä, hän jättää kasan maastoon.
 * Toinen porukka ajaa autolla kasat pois — he näkevät montako merkkiä kasassa on ja saavat
 * navigointilinkin.
 *
 * Ennen T422:ta purussa ei ollut heroa lainkaan (`segment-hero.ts:61`) ∴ tämä polku ei ollut
 * olemassa. Ennen T420:tä lista kulki lopusta alkuun (B172).
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsTalkoolainen } from './helpers/auth'
import { pointAtDistance } from './helpers/route-points'

const CODE = 'PURKU1'
const KASAT = 'KASAT1'

const at = (m: number): { lat: number; lon: number } => {
  const [lat, lon] = pointAtDistance(m)
  return { lat, lon }
}

const MARKER_BASE = {
  type: 'right', route_ids: ['smtb-30'], location_note: null, color: null,
  icon_id: null, image_id: null, template_id: null, parts_json: null,
  description: null, images: [], created_by: null, pile_marker_ids: null,
}

/** Purkupätkä: kolme ASETETTUA merkkiä (purettavia) pätkän eri kohdissa. */
async function mockPurkuSegment(page: Page): Promise<{ posted: unknown[] }> {
  const seg = {
    id: 'seg-purku', routeIds: ['smtb-30'], startDist: 0, endDist: 20000,
    assignedCode: CODE, displayName: 'Purkupätkä', description: '', equipment: [],
    phase: 'purku', inspected: false, completed: false,
  }
  const markers = [
    { ...MARKER_BASE, id: 'p-alku', ...at(1000), distance_from_start: 1000, status: 'asetettu', label: 'Alku' },
    { ...MARKER_BASE, id: 'p-keski', ...at(2500), distance_from_start: 2500, status: 'asetettu', label: 'Keski' },
    { ...MARKER_BASE, id: 'p-loppu', ...at(4000), distance_from_start: 4000, status: 'asetettu', label: 'Loppu' },
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
    // PUT (status-kuittaus) → sama merkki takaisin, päivitetyllä statuksella.
    const patch = req.postDataJSON() as Record<string, unknown>
    const id = req.url().split('/').pop()!
    const m = markers.find(x => x.id === id)
    if (m && typeof patch.status === 'string') m.status = patch.status
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m ?? {}) })
  })
  return { posted }
}

async function mockPhase(page: Page, phase = 'purku'): Promise<void> {
  // T426/V317: vaihe on järjestelmän tila ∴ client lukee sen ennen ensimmäistä renderiä.
  await page.route(/\/api\/phase$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ phase }) }))
}

async function openPurku(page: Page): Promise<void> {
  await mockPhase(page)
  await mockAuthAsTalkoolainen(page, CODE)
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 65.627, longitude: 27.628 })
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  const toMap = page.locator('#btn-to-map')
  if (await toMap.isVisible()) await toMap.click()
}

test.use({ viewport: { width: 390, height: 844 } })

test('T422 — purussa on hero: "Seuraava purettava" + yhden napin kuittaus', async ({ page }) => {
  await mockPurkuSegment(page)
  await openPurku(page)

  const hero = page.locator('.segment-view-next')
  await expect(hero).toBeVisible()
  await expect(page.locator('.segment-view-next-label')).toContainText('Seuraava purettava')

  // Kuittausnappi on vaiheen verbi, ei "Aseta".
  const set = page.locator('.segment-view-next-set')
  await expect(set).toContainText('Kerätty')
  const box = await set.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

test('T420 — purku kulkee SAMAAN suuntaan kuin merkkaaminen (B172)', async ({ page }) => {
  await mockPurkuSegment(page)
  await openPurku(page)

  // Ensimmäinen purettava on pätkän ALUSTA, ei lopusta.
  await expect(page.locator('.segment-view-next-name')).toHaveText('Alku')
  await expect(page.locator('.segment-view-next-label')).toContainText('1/3')

  // ▶ etenee kohti loppua.
  await page.locator('.segment-view-next-fwd').click()
  await expect(page.locator('.segment-view-next-name')).toHaveText('Keski')
  await page.locator('.segment-view-next-fwd').click()
  await expect(page.locator('.segment-view-next-name')).toHaveText('Loppu')
  await expect(page.locator('.segment-view-next-fwd')).toBeDisabled()
})

test('T424 — kerää merkkejä → "Jätä kasa tähän" ilmestyy määrän kanssa', async ({ page }) => {
  const { posted } = await mockPurkuSegment(page)
  await openPurku(page)

  // Aluksi mitään ei ole kerätty ∴ kasaan ei ole mitään pantavaa.
  const pile = page.locator('.segment-view-pile-btn')
  await expect(pile).toBeHidden()

  // Kuittaa kaksi merkkiä kerätyksi.
  await page.locator('.segment-view-next-set').click()
  await page.waitForTimeout(300)
  await page.locator('.segment-view-next-set').click()
  await page.waitForTimeout(300)

  await expect(pile).toBeVisible()
  await expect(pile).toContainText('2 merkkiä')
  const box = await pile.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)

  // GPS päälle & kasa maastoon.
  const gps = page.locator('#gps-control')
  if (await gps.isVisible()) {
    await gps.click()
    await page.waitForTimeout(1200)
  }
  await pile.click()
  await page.waitForTimeout(600)

  // T454/V338 (B185): GPS EI enää luo kasaa — se keskittää kartan & antaa etäisyyslukeman.
  // Sijainnin valitsee ihminen napauttamalla, myös fixin kanssa: yksi virta ∀ tapauksessa.
  await expect(page.locator('.pile-place-hint')).toBeVisible()
  const mapBox0 = (await page.locator('#map').boundingBox())!
  await page.mouse.click(mapBox0.x + mapBox0.width / 2, mapBox0.y + mapBox0.height / 3)
  await page.waitForTimeout(600)

  // T450b: kasa on lupaus toiselle porukalle ("tule tänne, täällä on nämä") ∴ se tarkistetaan
  // ennen kuin se lähtee. T454: vahvistus on PALKKI & kartta jää näkyviin sen alle (B187).
  const confirm = page.locator('.pile-confirm-bar')
  await expect(confirm).toBeVisible()
  await expect(confirm.locator('.pile-confirm-bar-lead')).toContainText('Jätetäänkö kasa tähän?')
  await expect(page.locator('.pile-preview-pin')).toBeVisible()
  await expect(page.locator('#map')).toBeVisible()
  await confirm.locator('.pile-confirm-bar-contents > summary').click()
  expect(posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')).toHaveLength(0)

  // Sisältö on RYHMITELTY: kaksi samanlaista merkkiä on YKSI rivi "×2", ei kahta identtistä
  // riviä joista ihminen laskee itse (T450 — kasassa on tusina merkkiä joista puolet samoja).
  await expect(confirm.locator('.pile-contents-row')).toHaveCount(1)
  await expect(confirm.locator('.pile-contents-count')).toHaveText('×2')
  await expect(confirm.locator('.pile-contents-total')).toContainText('2 merkkiä')

  await confirm.locator('.pile-confirm-ok').click()
  await page.waitForTimeout(600)

  const kasat = posted.filter((b) => (b as { template_id?: string }).template_id === 'kerayskasa')
  expect(kasat.length).toBe(1)
  expect((kasat[0] as { pile_marker_ids: string[] }).pile_marker_ids).toHaveLength(2)

  // V314-idempotenssi: kasan jälkeen ehdokkaita ei ole ∴ nappi katoaa.
  await expect(pile).toBeHidden()
})

test('T450 — vahvistuksen "Peruuta": ei kasaa & merkit jäävät keräyslistalle', async ({ page }) => {
  const { posted } = await mockPurkuSegment(page)
  await openPurku(page)

  await page.locator('.segment-view-next-set').click()
  await page.waitForTimeout(300)
  await page.locator('.segment-view-next-set').click()
  await page.waitForTimeout(300)

  const gps = page.locator('#gps-control')
  if (await gps.isVisible()) {
    await gps.click()
    await page.waitForTimeout(1200)
  }

  const pile = page.locator('.segment-view-pile-btn')
  await expect(pile).toContainText('2 merkkiä')
  await pile.click()
  await page.waitForTimeout(600)

  const mapBox1 = (await page.locator('#map').boundingBox())!
  await page.mouse.click(mapBox1.x + mapBox1.width / 2, mapBox1.y + mapBox1.height / 3)
  await page.waitForTimeout(600)

  const confirm = page.locator('.pile-confirm-bar')
  await expect(confirm).toBeVisible()
  await confirm.locator('.pile-confirm-cancel').click()
  await page.waitForTimeout(600)

  // Kasaa ei synny — eikä puoliksi tehtyä jää: merkit ovat yhä kasaan pantavissa.
  await expect(confirm).toBeHidden()
  expect(posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')).toHaveLength(0)
  await expect(pile).toBeVisible()
  await expect(pile).toContainText('2 merkkiä')
})

test('T425 — autoporukan kasalista: määrä, navigointilinkki, lähin kasa', async ({ page }) => {
  const seg = {
    id: 'seg-kasat', routeIds: undefined, startDist: undefined, endDist: undefined,
    assignedCode: KASAT, displayName: 'Keräyskasat', description: '', equipment: [],
    phase: 'purku', inspected: false, completed: false, markerTypeFilter: 'kerayskasa',
  }
  const kasat = [
    {
      ...MARKER_BASE, id: 'kasa-1', type: 'kerayskasa', template_id: 'kerayskasa',
      ...at(1000), distance_from_start: 1000, route_ids: [], status: 'suunniteltu',
      label: 'Kasa A', pile_marker_ids: ['a', 'b', 'c'],
    },
    {
      ...MARKER_BASE, id: 'kasa-2', type: 'kerayskasa', template_id: 'kerayskasa',
      ...at(9000), distance_from_start: 9000, route_ids: [], status: 'suunniteltu',
      label: 'Kasa B', pile_marker_ids: ['d'],
    },
  ]
  await page.route(new RegExp(`/api/segments/by-code/${KASAT}$`), r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seg) }))
  await page.route(/\/api\/markers(\?|\/|$)/, r =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kasat) })
      : r.fulfill({ status: 201, contentType: 'application/json', body: '{}' }))

  await mockPhase(page)
  await mockAuthAsTalkoolainen(page, KASAT)
  await page.context().grantPermissions(['geolocation'])
  const [lat1, lon1] = pointAtDistance(1000)
  await page.context().setGeolocation({ latitude: lat1, longitude: lon1 })
  await page.goto(`/s/${KASAT}`)
  await page.waitForTimeout(1500)
  const toMap = page.locator('#btn-to-map')
  if (await toMap.isVisible()) await toMap.click()

  // Määrä rivillä — hakija tietää mitä kasa vaatii ennen ajoa.
  await expect(page.locator('.segment-view-collect-count').first()).toHaveText('3 merkkiä')

  // Navigointilinkki (V286: yksi ankkuri, ei appivalitsinta).
  const nav = page.locator('.segment-view-collect-nav').first()
  await expect(nav).toHaveAttribute('target', '_blank')
  expect(await nav.getAttribute('href')).toContain('google.com/maps/dir/')
  const navBox = await nav.boundingBox()
  expect(navBox!.height).toBeGreaterThanOrEqual(44)

  // Hero ei kaappaa keräystehtävää (T218/V143 säilyy).
  await expect(page.locator('.segment-view-next')).toBeHidden()
})


test('T429 — purussa merkillä on TASAN kaksi toimintoa (V319)', async ({ page }) => {
  await mockPurkuSegment(page)
  await openPurku(page)

  await page.locator('.segment-view-next-more').click()
  const items = page.locator('.segment-view-next-menu-item')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toHaveText('Ei löytynyt')
  // Suunnittelun työkalut eivät ole purussa olemassa (⊥ disabloituina, V250).
  await expect(page.locator('.segment-view-next-add')).toHaveCount(0)
  await expect(page.locator('.segment-view-next-move')).toHaveCount(0)
})

test('T428 — varustelista ei ole purussa olemassa', async ({ page }) => {
  await mockPurkuSegment(page)
  await openPurku(page)

  // Koti-moodiin (varustepinta elää siellä).
  const home = page.locator('#btn-to-home')
  if (await home.isVisible()) await home.click()
  await expect(page.locator('.segment-koti-tab[data-tab="varuste"]')).toBeHidden()
})

test('T430 — ilman GPS-fixiä kasa syntyy kartan napautuksesta (V320)', async ({ page }) => {
  const { posted } = await mockPurkuSegment(page)
  await mockPhase(page)
  await mockAuthAsTalkoolainen(page, CODE)
  // EI geolocation-oikeutta ∴ fixiä ei tule koskaan.
  await page.goto(`/s/${CODE}`)
  await page.waitForTimeout(1500)
  const toMap = page.locator('#btn-to-map')
  if (await toMap.isVisible()) await toMap.click()

  await page.locator('.segment-view-next-set').click()
  await page.waitForTimeout(300)

  const pile = page.locator('.segment-view-pile-btn')
  await expect(pile).toBeVisible()
  await pile.click()
  await page.waitForTimeout(300)

  // Kasaa ei ole vielä — kartta odottaa napautusta. T450a: ohje on ISO laatikko (⊥ toast joka
  // ehtii kadota) & "Peruuta" on samassa paikassa koko tilan ajan.
  expect(posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')).toHaveLength(0)
  await expect(page.locator('.pile-place-hint')).toBeVisible()
  await expect(page.locator('.pile-place-hint-text')).toContainText('hakea autolla')

  const map = page.locator('#map')
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(600)

  // T450b: napautus valitsee sijainnin, vahvistus luo kasan. Ohjerivi väistyy palkin tieltä.
  const confirm = page.locator('.pile-confirm-bar')
  await expect(confirm).toBeVisible()
  await expect(page.locator('.pile-place-hint')).toBeHidden()
  expect(posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')).toHaveLength(0)

  await confirm.locator('.pile-confirm-ok').click()
  await page.waitForTimeout(600)

  const kasat = posted.filter(b => (b as { template_id?: string }).template_id === 'kerayskasa')
  expect(kasat).toHaveLength(1)
  expect((kasat[0] as { pile_marker_ids: string[] }).pile_marker_ids).toHaveLength(1)
})
