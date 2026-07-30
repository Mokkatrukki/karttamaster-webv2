import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers } from './helpers/auth'

// T415/V305: järjestäjä lisää valitut merkit OLEMASSA OLEVAAN tehtävään merkkijonosta.
// Vitest todistaa paneelin sopimuksen; tämä todistaa ketjun sovelluksessa: valinta → kohde →
// tallennus → merkki vaihtaa alaryhmää "Ei pätkää" → pätkän nimi (jäsenyys muuttui oikeasti).

const SEGMENT = {
  id: 'seg-t415',
  routeIds: ['smtb-30'],
  primaryRouteId: 'smtb-30',
  startDist: 0,
  endDist: 20000,
  assignedCode: null,
  slug: 'kohdepatka',
  displayName: 'Kohdepätkä',
  description: '',
  equipment: [],
  phase: 'asettaminen',
  inspected: false,
  completed: false,
}

/**
 * HUOM: `distance_from_start` ⊥ ratkaise jäsenyyttä — `backfillNearestRoute` (T392/V284) laskee
 * merkin lähimmän reitin & km:n UUDELLEEN sijainnista latauksessa. Orpous tehdään siis
 * KOORDINAATILLA (kauas reitistä), ⊥ syötetyllä km-luvulla.
 */
function marker(id: string, dist: number, lat: number) {
  return {
    id, type: 'right', lat, lon: 27.62, distance_from_start: dist,
    route_ids: ['smtb-30'], status: 'suunniteltu', location_note: null, color: null,
    label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
    description: null, images: [], created_by: null,
  }
}

test('valitse orpo merkki → "Lisää valitut tehtävään" → jäsenyys muuttuu (T415)', async ({ page }) => {
  const puts: Array<{ url: string; body: unknown }> = []
  await mockAuthAsJarjestaja(page)
  // mk-orpo on 0,5° pohjoiseen kaikista reiteistä ∴ se alkaa alaryhmässä "Ei pätkää".
  await mockMarkers(page, [marker('mk-sisalla', 5000, 65.62), marker('mk-orpo', 90000, 66.12)])
  await page.route(/\/api\/segments(\?|$)/, route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SEGMENT]) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route(/\/api\/segments\/[^/]+$/, route => {
    if (route.request().method() === 'PUT') {
      puts.push({ url: route.request().url(), body: route.request().postDataJSON() })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.waitForSelector('#btn-list', { state: 'visible' })
  await page.locator('#btn-list').click()
  const overview = page.locator('#marker-overview')
  await expect(overview).toBeVisible()

  // Lähtötila: orpo merkki on "Ei pätkää" -alaryhmässä.
  await expect(overview.locator('.marker-overview-subhead', { hasText: 'Ei pätkää' })).toHaveCount(1)

  const addBtn = overview.locator('.marker-overview-add-existing')
  await expect(addBtn).toBeVisible()
  // N=0 → disabloitu NÄKYVÄSTI (V250).
  await expect(addBtn).toBeDisabled()

  // Kohdevalikko listaa aktiivisen vaiheen pätkän merkkimäärällä & km-välillä.
  const target = overview.locator('.marker-overview-target-select')
  await expect(target.locator('option')).toHaveCount(1)
  await expect(target.locator('option').first()).toHaveText(/Kohdepätkä · \d+ merkkiä · 0\.0–20\.0 km/)

  await overview.locator('.marker-overview-item[data-id="mk-orpo"] .marker-item-checkbox').click()
  await expect(addBtn).toHaveText('Lisää valitut tehtävään (1)')
  await addBtn.click()

  // Serverille lähti liitos (V305/V307: additiivinen lista). Sama pätkä saa latauksessa myös
  // muita patcheja (esim. T358-jälki/rajojen backfill) ∴ etsitään se joka KANTAA liitoksen.
  const linkedPut = () => puts.find(p => Array.isArray((p.body as { linkedMarkerIds?: string[] }).linkedMarkerIds))
  await expect.poll(() => linkedPut() !== undefined).toBe(true)
  expect((linkedPut()!.body as { linkedMarkerIds: string[] }).linkedMarkerIds).toContain('mk-orpo')

  // Jäsenyys muuttui NÄKYVÄSTI: orpoja ei enää ole & merkki on pätkän alaryhmässä.
  await expect(overview.locator('.marker-overview-subhead', { hasText: 'Ei pätkää' })).toHaveCount(0)
  await expect(addBtn).toBeDisabled() // valinta nollautui
})
