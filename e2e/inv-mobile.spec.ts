import { test, expect } from 'playwright/test'

// 1x1 PNG — pikkukuva jonka mock-endpoint palauttaa (todistaa että <img> renderöityy).
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

// Inventaario mobiili-regressio (375px, järjestäjä). Vartioi ettei mikään tila vuoda
// vaakasuunnassa yli näytön (B: .inv-f-name flex:1 ilman min-width:0 työnsi "+ Lisää"n
// ~47px yli reunan). Mockaa auth + inventory-endpointit stateless.
test.describe('inventaario mobiili', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('ei vaakavuotoa missään tilassa', async ({ page }) => {
    await page.route('/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'järjestäjä', display_name: 'Testi' }) }))
    await page.route('/api/inventory/locations', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'l1', name: 'Kärry', sort_order: 0 },
        { id: 'l2', name: 'Varasto pitkä nimi tosi', sort_order: 1 },
      ]) }))
    await page.route('/api/templates', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'right', label: 'Oikealle', color: '#16a34a', description: '', favorite: true }]) }))
    await page.route(/\/api\/inventory(\?.*)?$/, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'i1', name: 'Teippirulla oranssi merkintänauha pitkä nimi', qty: 250, unit: 'kpl', note: 'iso rulla', location_id: 'l1', template_id: null },
        { id: 'i2', name: 'Merkki Oikealle', qty: 40, unit: null, note: null, location_id: 'l1', template_id: 'right' },
      ]) }))

    await page.goto('/inventory.html')
    await page.waitForSelector('#inv-location-bar', { timeout: 10000 })
    await page.waitForTimeout(200)

    const noOverflow = async (label: string): Promise<void> => {
      const offenders = await page.evaluate(() => {
        const w = document.documentElement.clientWidth
        const out: string[] = []
        document.querySelectorAll('*').forEach(el => {
          if ((el as HTMLElement).getBoundingClientRect().right > w + 1) out.push((el as HTMLElement).className || el.tagName)
        })
        return out.slice(0, 6)
      })
      expect(offenders, `${label} vuotaa: ${offenders.join(', ')}`).toEqual([])
    }

    await noOverflow('perustila')

    await page.click('.inv-loc-tab[data-location-id="all"]'); await page.waitForTimeout(150)
    await noOverflow('kaikki-kokooma')

    await page.click('.inv-loc-tab[data-location-id="l1"]'); await page.waitForTimeout(150)
    await page.click('#inv-loc-edit-toggle'); await page.waitForTimeout(150)
    await noOverflow('paikka-editori')
    await page.click('#inv-loc-edit-toggle')

    await page.click('.inv-card:first-child .inv-btn-details'); await page.waitForTimeout(150)
    await noOverflow('tiedot-editori')
    await page.click('.inv-card:first-child .inv-btn-details')

    await page.click('#inv-add-sign-btn'); await page.waitForTimeout(200)
    await noOverflow('merkki-picker')
  })

  // B: merkin ladattu kuva (imageId = backend-URL) ei näkynyt inventaariokortissa — kortti
  // ohitti imageId:n ja putosi ikoniin/lyhenteeseen. Fix: type = imageId ?? id (T200-konventio).
  test('merkin kuva näytetään ensisijaisesti kortissa', async ({ page }) => {
    await page.route('/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'järjestäjä', display_name: 'Testi' }) }))
    await page.route('/api/inventory/locations', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'l1', name: 'Kärry', sort_order: 0 }]) }))
    const imgUrl = '/api/templates/t1/images/img1'
    // iconId on myös asetettu → jos kuva ohitetaan, ikoni voittaisi. Kuvan pitää voittaa.
    await page.route('/api/templates', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 't1', label: 'Kuvamerkki', color: '#16a34a', description: '', favorite: true, iconId: 'arrow-right', imageId: imgUrl }]) }))
    await page.route(imgUrl, r => r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }))
    await page.route(/\/api\/inventory(\?.*)?$/, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'i1', name: 'Kuvamerkki', qty: 5, unit: null, note: null, location_id: 'l1', template_id: 't1' }]) }))

    await page.goto('/inventory.html')
    await page.waitForSelector('.inv-card', { timeout: 10000 })
    await page.waitForTimeout(200)

    const src = await page.locator('.inv-card .marker-visual-row-sv img').first().getAttribute('src')
    expect(src).toContain(imgUrl)
  })
})
