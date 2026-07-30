import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers, mockTemplates } from './helpers/auth'

// T408/V293 — zoom kuuluu KARTALLE, ei sovelluskehykselle.
// Mittari on kaksikanavainen tarkoituksella: kehyksen ele ⊥ saa muuttaa sivun skaalaa JA
// kartan ele ! muuttaa kartan zoomia. Pelkkä ensimmäinen menisi läpi myös silloin kun
// pinch on tapettu kaikkialta — mukaan lukien kartalta (juuri se olisi regressio).

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

test('V293 — pinch kehyksen päällä ei zoomaa sivua, pinch kartalla zoomaa kartan', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [])
  await mockTemplates(page)
  await page.goto('/')
  await page.waitForSelector('#map.leaflet-container')

  const scaleBefore = await page.evaluate(() => window.visualViewport?.scale ?? 1)

  // Kaksisorminen levitys yläpalkin päällä (CDP: Playwrightin oma API ei tee pinchiä).
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 120, y: 28 }, { x: 240, y: 28 }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 60, y: 28 }, { x: 320, y: 28 }],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBeCloseTo(scaleBefore, 2)

  // Kartta EI saa olla tapettu samalla: Leafletin touchZoom on yhä käytössä.
  const touchZoomEnabled = await page.evaluate(() => {
    const el = document.querySelector('#map') as HTMLElement & { _leaflet_id?: number }
    return el?.classList.contains('leaflet-touch-zoom')
  })
  expect(touchZoomEnabled).toBe(true)

  // ⊥ ID-selektorilla kumottua touch-actionia (V293: `#map{touch-action:manipulation}` = juurisyy).
  const mapTouchAction = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#map')!).touchAction)
  expect(mapTouchAction).not.toBe('manipulation')
})

test('V293 — kehyspinnat julistavat eleensä (⊥ jää selaimen oletukselle)', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [])
  await mockTemplates(page)
  await page.goto('/')
  await page.waitForSelector('#map.leaflet-container')

  const toolbar = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#toolbar')!).touchAction)
  expect(toolbar).toBe('none')

  // Napit: kaksoisnapautus ⊥ saa zoomata sivua (hanskat → epätarkka osuma toistuu).
  const btn = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#btn-menu')!).touchAction)
  expect(btn).toBe('manipulation')
})
