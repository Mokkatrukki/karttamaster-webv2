/**
 * T419/V309 — pätkän nimilappu kutistuu zoomin mukana & EI KATOA MILLOINKAAN.
 *
 * Miksi E2E (⊥ pelkkä Vitest): kaari on jo Taso-1-testattu (`t419-segment-label-scale.test.ts`).
 * Se mitä VAIN selain voi kertoa on että skaala päätyy PIKSELEIKSI: `--label-scale` +
 * `calc()`-kimppu voi olla oikea & silti tehoton (väärä kohde-elementti, Leafletin oma tyyli
 * päällä, tooltipin uudelleenluonti). Sama katvealueluokka kuin B171/V303: CSS-lupaus ⊥ ole
 * väite jonka `tsc` tai jsdom voi tarkistaa — se ! mitata.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockTemplates, mockMarkers } from './helpers/auth'

const SEG = {
  id: 'seg-scale', routeIds: ['smtb-30'], primaryRouteId: 'smtb-30',
  startDist: 2000, endDist: 8000, linkedMarkerIds: [],
  assignedCode: 'SCL01', displayName: 'Skaalapätkä', description: '', equipment: [],
  phase: 'asettaminen', inspected: false, completed: false,
}

/** Zoomaa lapun kohdalle (⊥ kartan keskipisteeseen — pätkä valuisi ruudun ulkopuolelle). */
async function zoomAtLabel(page: import('playwright/test').Page, z: number) {
  await page.evaluate(zoom => {
    const map = (window as unknown as Record<string, unknown>)['__testMap'] as {
      getContainer(): HTMLElement
      containerPointToLatLng(p: { x: number; y: number }): unknown
      setView(ll: unknown, z: number, o?: unknown): void
    }
    const el = document.querySelector<HTMLElement>('.segment-label')!
    const r = el.getBoundingClientRect()
    const mr = map.getContainer().getBoundingClientRect()
    const ll = map.containerPointToLatLng({ x: r.left + r.width / 2 - mr.left, y: r.top + r.height / 2 - mr.top })
    map.setView(ll, zoom, { animate: false })
  }, z)
  await page.waitForTimeout(300)
}

const labelMetrics = (page: import('playwright/test').Page) =>
  page.locator('.segment-label').first().evaluate(el => {
    const cs = getComputedStyle(el)
    return { fontSize: parseFloat(cs.fontSize), width: el.getBoundingClientRect().width, opacity: parseFloat(cs.opacity) }
  })

test.describe('T419 — nimilapun zoom-skaala (V309)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await mockTemplates(page)
    await page.route(/\/api\/segments$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SEG]) }))
    await mockMarkers(page, [])
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(1500)
  })

  test('kaukana pieni, lähellä täysi 11px — & lappu näkyvissä MOLEMMISSA', async ({ page }) => {
    await zoomAtLabel(page, 12)
    const far = await labelMetrics(page)
    // ⊥ katoa milloinkaan: näkyvä & mitattava myös kauimmaisella zoomilla (V309-amend).
    await expect(page.locator('.segment-label')).toBeVisible()
    expect(far.opacity).toBeGreaterThan(0)
    // 11px * 0,25 = 2,75px. Yläraja 4 pitää säädön KIREÄNÄ: jos joku palauttaa 0,4:n (4,4px)
    // tai selain clamppaa minimifonttikokoon, testi kertoo sen — ⊥ hyväksy "suunnilleen pieni".
    expect(far.fontSize).toBeLessThan(4)
    expect(far.fontSize).toBeGreaterThan(0)

    await zoomAtLabel(page, 17)
    const near = await labelMetrics(page)
    expect(near.fontSize).toBeCloseTo(11, 1)
    // Pilleri kutistuu tekstin MUKANA — muuten kaukana olisi iso laatikko pikkutekstin ympärillä.
    expect(near.width).toBeGreaterThan(far.width * 1.5)
  })

  test('lappu on klikattava sisääntulo myös kutistuneena (T347 ⊥ rikkoudu)', async ({ page }) => {
    await zoomAtLabel(page, 12.5)
    await page.locator('.segment-label').first().click()
    await expect(page.locator('.segment-details-modal')).toContainText('Skaalapätkä')
  })
})
