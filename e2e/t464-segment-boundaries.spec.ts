/**
 * T464/V352/V353 (B200) — pätkän raja näkyy kartalta.
 *
 * Tuotannossa 13 purkupätkää jaettiin 4 värin paletista `hash(id) % 4`:llä ∴ kolme PERÄKKÄISTÄ
 * sai saman värin & 16 km:n matkalta ⊥ näkynyt yhtään rajaa. Väri tulee nyt naapurisuhteesta
 * (V352) & raja saa toisen, geometrisen kanavan: rako + päätepistemerkit (V353).
 *
 * Miksi Playwright ⊥ Vitest: väritysalgoritmin todistaa Vitest-pure (`tests/segments.test.ts`).
 * TÄSSÄ todistetaan se mitä puhdas testi ⊥ näe — että arvot päätyvät oikeisiin SVG-attribuutteihin,
 * että merkkejä on oikea määrä & ETTEI päätepiste varasta klikkiä casingilta (V345/T460).
 */
import { test, expect, type Page } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

// Kolme PERÄKKÄISTÄ pätkää jaetuin päätepistein — täsmälleen B200:n kuvio (Pätkä 1 → 2 → 3).
// Km-välit ovat reitin alkupäässä tarkoituksella: e2e-ympäristön GPX ⊥ ulotu koko 30 km:iin ∴
// kauempi pätkä ⊥ saisi siivua lainkaan & testi mittaisi puuttuvaa dataa ⊥ väritystä.
const SEGMENTS = [
  { id: 'seg-a', startDist: 1000, endDist: 2000, displayName: 'Purkupätkä A' },
  { id: 'seg-b', startDist: 2000, endDist: 3000, displayName: 'Purkupätkä B' },
  { id: 'seg-c', startDist: 3000, endDist: 4000, displayName: 'Purkupätkä C' },
].map(s => ({
  ...s, routeIds: ['smtb-30'], primaryRouteId: 'smtb-30', equipment: [],
  phase: 'asettaminen', description: '', inspected: false, completed: false,
}))

async function openMap(page: Page): Promise<void> {
  await mockAuthAsJarjestaja(page)
  await page.route(/\/api\/segments(\?|$)/, route =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEGMENTS) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route(/\/api\/markers(\?|$)/, route =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }))
  await page.goto('/')
  await page.waitForTimeout(2500)
}

/** Casingit = leveimmät pätkäpolut. Erotin (valkoinen) & reitin sisus ⊥ kanna tunnistetta. */
function casingStrokes(page: Page): Promise<string[]> {
  return page.locator('#map path').evaluateAll(els =>
    els.filter(e => e.getAttribute('stroke-width') === '15').map(e => e.getAttribute('stroke') ?? ''))
}

/** Päätepiste = valkoreunainen ympyrä pätkän omassa värissä (`fill`). */
function capFills(page: Page): Promise<string[]> {
  return page.locator('#map path').evaluateAll(els =>
    els
      .filter(e => e.getAttribute('stroke') === '#FFFFFF' && e.getAttribute('stroke-width') === '2')
      .map(e => e.getAttribute('fill') ?? ''))
}

test.use({ viewport: { width: 1280, height: 720 } })

test('V352 — peräkkäiset pätkät saavat ERI värin (B200-regressio)', async ({ page }) => {
  await openMap(page)

  const strokes = await casingStrokes(page)
  expect(strokes.length).toBe(3)
  // Naapuruus ⊥ globaali uniikkius: A≠B & B≠C riittää (A & C ⊥ kosketa toisiaan).
  expect(strokes[0]).not.toBe(strokes[1])
  expect(strokes[1]).not.toBe(strokes[2])
})

test('V353 — jokaisella pätkällä on päätepistemerkki molemmissa päissä', async ({ page }) => {
  await openMap(page)

  // 3 pätkää × 2 päätä = 6.
  const caps = await capFills(page)
  expect(caps.length).toBe(6)

  // Merkin täyttö on pätkän OMA väri ⊥ kiinteä ∴ raja lukee myös silloin kun rako jää huomaamatta.
  const strokes = await casingStrokes(page)
  for (const c of caps) expect(strokes).toContain(c)

  // V353(d): merkki lukee SAMAA alfaa kuin casing ∴ himmennys (V142/V270) & suodattimen dim
  // seuraavat ilman toista totuutta — merkki ⊥ voi jäädä kirkkaaksi himmennetyn viivan päähän.
  const alphas = await page.locator('#map path').evaluateAll(els => {
    const casing = els.find(e => e.getAttribute('stroke-width') === '15')
    const cap = els.find(e => e.getAttribute('stroke') === '#FFFFFF' && e.getAttribute('stroke-width') === '2')
    return {
      line: casing?.getAttribute('stroke-opacity'),
      capStroke: cap?.getAttribute('stroke-opacity'),
      capFill: cap?.getAttribute('fill-opacity'),
    }
  })
  expect(alphas.capStroke).toBe(alphas.line)
  expect(alphas.capFill).toBe(alphas.line)
})

test('V353/V345 — päätepiste ei varasta klikkiä: pätkämodaali aukeaa yhä', async ({ page }) => {
  await openMap(page)

  // Klikkaa pätkäviivaa sen OMASTA päätepisteestä — juuri se kohta jonka merkki peittäisi jos
  // se olisi `interactive`. Leaflet piirtää merkin viimeisenä ∴ se olisi klikin päällimmäinen.
  const at = await page.locator('#map path').evaluateAll(els => {
    const cap = els.find(e => e.getAttribute('stroke') === '#FFFFFF' && e.getAttribute('stroke-width') === '2')
    if (!cap) return null
    const r = cap.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  expect(at).not.toBeNull()

  await page.mouse.click(at!.x, at!.y)
  await expect(page.locator('.segment-details-modal').first()).toBeVisible()
})

test('V353 — uudelleenpiirto ⊥ jätä orpoja päätepisteitä (clear() vie ne)', async ({ page }) => {
  await openMap(page)
  expect((await capFills(page)).length).toBe(6)

  // Vaiheen vaihto piirtää pätkäkerroksen UUDELLEEN. Pätkät ovat `asettaminen`-vaiheessa ∴
  // `purku`ssa niitä ⊥ ole & päätepisteitäkään ⊥ jää; takaisin → tasan 6, ⊥ 12. Orpo merkki
  // väittäisi rajaa jota ⊥ enää ole & määrä kasvaisi joka renderissä.
  await page.click('#btn-menu')
  await page.locator('.phase-switcher-select').selectOption('purku')
  await page.waitForTimeout(600)
  expect((await capFills(page)).length).toBe(0)

  await page.locator('.phase-switcher-select').selectOption('asettaminen')
  await page.waitForTimeout(600)
  expect((await capFills(page)).length).toBe(6)
})
