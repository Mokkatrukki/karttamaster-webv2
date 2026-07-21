import { test, expect } from 'playwright/test'

// T253: inventaarion client-only "Kumoa"-undo-toast. Verifioi entry-revert (V173) —
// yksikkötestit kattavat describeUndo (t252) + toast.ts (t253), tämä kattaa integraation:
// mutaatio → toast → Kumoa → revert olemassa oleviin /api/inventory-reitteihin.
// Stateful mockit kirjaavat revert-kutsut. Tärkein: paikan poiston undo (recreate + re-point).
test.describe('inventaario undo-toast', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  const authMock = async (page: import('playwright/test').Page) => {
    await page.route('/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'järjestäjä', display_name: 'Testi' }) }))
    await page.route('/api/templates', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  }

  test('qty-säätö → toast → Kumoa palauttaa vanhan määrän (V173b)', async ({ page }) => {
    const putBodies: any[] = []
    await authMock(page)
    await page.route('/api/inventory/locations', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'l1', name: 'Kärry', sort_order: 0 }]) }))
    await page.route(/\/api\/inventory\/i1$/, async r => {
      if (r.request().method() === 'PUT') putBodies.push(JSON.parse(r.request().postData() || '{}'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route(/\/api\/inventory(\?.*)?$/, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'i1', name: 'Nippuside', qty: 5, unit: 'kpl', note: null, location_id: 'l1', template_id: null }]) }))

    await page.goto('/inventory.html')
    await page.waitForSelector('.inv-card', { timeout: 10000 })

    // Read-tila oletus (V169) → ei stepperiä. Vaihda edit-tilaan.
    await page.click('#inv-mode-toggle'); await page.waitForTimeout(150)
    await page.click('.inv-card:first-child .inv-step-plus'); await page.waitForTimeout(250)

    // Toast + Kumoa näkyy
    const toast = page.locator('.toast')
    await expect(toast).toBeVisible()
    await expect(toast.locator('.toast-msg')).toHaveText('Muutit määrää: Nippuside')
    await expect(toast.locator('.toast-action')).toHaveText('Kumoa')

    expect(putBodies[0].qty).toBe(6) // stepper +1
    await page.click('.toast-action'); await page.waitForTimeout(250)
    expect(putBodies[putBodies.length - 1].qty).toBe(5) // revert → vanha arvo
    await expect(page.locator('.toast')).toHaveCount(0) // sulkeutuu
  })

  test('item-poisto → toast → Kumoa luo rivin uudelleen (V173a)', async ({ page }) => {
    let postCalled = 0
    await authMock(page)
    await page.route('/api/inventory/locations', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'l1', name: 'Kärry', sort_order: 0 }]) }))
    await page.route(/\/api\/inventory\/i1$/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })) // DELETE ok
    await page.route(/\/api\/inventory(\?.*)?$/, async r => {
      if (r.request().method() === 'POST') { postCalled++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'i9' }) }) }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: 'i1', name: 'Teippi', qty: 3, unit: null, note: null, location_id: 'l1', template_id: null }]) })
    })
    // window.confirm → true
    page.on('dialog', d => d.accept())

    await page.goto('/inventory.html')
    await page.waitForSelector('.inv-card', { timeout: 10000 })
    await page.click('#inv-mode-toggle'); await page.waitForTimeout(150)
    await page.click('.inv-card:first-child .inv-btn-delete'); await page.waitForTimeout(250)

    await expect(page.locator('.toast .toast-msg')).toHaveText('Poistit: Teippi')
    await page.click('.toast-action'); await page.waitForTimeout(250)
    expect(postCalled).toBe(1) // POST uudelleenluonti
  })

  test('paikan poisto → toast → Kumoa luo paikan + siirtää itemit takaisin (V173c)', async ({ page }) => {
    let locPost = 0
    const repoints: any[] = []
    await authMock(page)
    await page.route('/api/inventory/locations', async r => {
      if (r.request().method() === 'POST') { locPost++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'l1new', name: 'Kärry', sort_order: 0 }) }) }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'l1', name: 'Kärry', sort_order: 0 }]) })
    })
    await page.route(/\/api\/inventory\/locations\/l1$/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })) // DELETE loc ok
    await page.route(/\/api\/inventory\/(i1|i2)$/, async r => {
      if (r.request().method() === 'PUT') repoints.push({ url: r.request().url(), body: JSON.parse(r.request().postData() || '{}') })
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route(/\/api\/inventory(\?.*)?$/, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'i1', name: 'A', qty: 1, unit: null, note: null, location_id: 'l1', template_id: null },
        { id: 'i2', name: 'B', qty: 2, unit: null, note: null, location_id: 'l1', template_id: null },
      ]) }))
    page.on('dialog', d => d.accept())

    await page.goto('/inventory.html')
    await page.waitForSelector('#inv-mode-toggle', { timeout: 10000 })
    await page.click('#inv-mode-toggle'); await page.waitForTimeout(150) // edit-tila paljastaa paikkanapit (V169)
    // Avaa paikkojen hallinta-modaali → Poista Kärry
    await page.waitForSelector('#inv-loc-edit-toggle', { timeout: 10000 })
    await page.click('#inv-loc-edit-toggle'); await page.waitForTimeout(150)
    await page.click('.inv-manage-del'); await page.waitForTimeout(300)

    await expect(page.locator('.toast .toast-msg')).toHaveText('Poistit paikan: Kärry')
    await page.click('.toast-action'); await page.waitForTimeout(400)

    expect(locPost).toBe(1) // paikka luotu uudelleen
    expect(repoints.length).toBe(2) // molemmat itemit siirretty takaisin
    expect(repoints.every(p => p.body.location_id === 'l1new')).toBe(true) // uuteen paikka-id:hen
  })
})
