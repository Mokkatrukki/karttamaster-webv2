/**
 * Feedback widget — E2E-testit
 * Testaa toggle, tag-valinta, submit, elementtipickeri, lista-näkymä.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

const EMPTY_LIST = JSON.stringify([])
const SAMPLE_ITEMS = JSON.stringify([
  {
    id: 'abc-1',
    tag: 'bug',
    description: 'Nappi ei toimi mobiililla',
    dom_path: '#btn-role',
    element_html: '<button id="btn-role">Talkoolainen</button>',
    page_url: 'http://localhost:5173/',
    session_path: ['http://localhost:5173/'],
    status: 'avoin',
    created_at: new Date().toISOString(),
  },
  {
    id: 'abc-2',
    tag: 'ux',
    description: 'Fontti liian pieni listassa',
    dom_path: '.marker-row',
    element_html: '<div class="marker-row">...</div>',
    page_url: 'http://localhost:5173/',
    session_path: ['http://localhost:5173/'],
    status: 'tehty',
    created_at: new Date().toISOString(),
  },
])

async function setupPage(page: Parameters<typeof mockAuthAsJarjestaja>[0]) {
  await mockAuthAsJarjestaja(page)
  await page.route('/api/devfeedback**', route => {
    const method = route.request().method()
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_LIST })
    if (method === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'new-id' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.goto('/')
  await page.waitForTimeout(1200)
}

test.describe('Feedback Widget', () => {
  test('toggle-nappi näkyy sivulla', async ({ page }) => {
    await setupPage(page)
    await expect(page.locator('#fb-toggle')).toBeVisible()
  })

  test('paneeli aukeaa ja sulkeutuu toggle-klikillä', async ({ page }) => {
    await setupPage(page)
    const panel = page.locator('#fb-panel')
    await expect(panel).not.toHaveClass(/fb-open/)
    await page.locator('#fb-toggle').click()
    await expect(panel).toHaveClass(/fb-open/)
    await page.locator('#fb-toggle').click()
    await expect(panel).not.toHaveClass(/fb-open/)
  })

  test('F2 avaa ja sulkee paneelin', async ({ page }) => {
    await setupPage(page)
    const panel = page.locator('#fb-panel')
    await page.keyboard.press('F2')
    await expect(panel).toHaveClass(/fb-open/)
    await page.keyboard.press('F2')
    await expect(panel).not.toHaveClass(/fb-open/)
  })

  test('tag-valinta toimii', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()

    const uxBtn = page.locator('.fb-tag-btn[data-tag="ux"]')
    const bugBtn = page.locator('.fb-tag-btn[data-tag="bug"]')

    await expect(bugBtn).toHaveClass(/selected/)
    await uxBtn.click()
    await expect(uxBtn).toHaveClass(/selected/)
    await expect(bugBtn).not.toHaveClass(/selected/)
  })

  test('submit lähettää oikeat kentät', async ({ page }) => {
    let captured: Record<string, unknown> | null = null

    await mockAuthAsJarjestaja(page)
    await page.route('/api/devfeedback**', async route => {
      const method = route.request().method()
      if (method === 'POST') {
        captured = JSON.parse(route.request().postData() ?? '{}')
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'x' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_LIST })
    })
    await page.goto('/')
    await page.waitForTimeout(1200)

    await page.locator('#fb-toggle').click()
    await page.locator('.fb-tag-btn[data-tag="feature"]').click()
    await page.locator('#fb-textarea').fill('Lisää GPS-navigaatio kierrosta varten')
    await page.locator('#fb-submit').click()
    await page.waitForTimeout(500)

    expect(captured).not.toBeNull()
    expect(captured!.tag).toBe('feature')
    expect(captured!.description).toBe('Lisää GPS-navigaatio kierrosta varten')
    expect(captured!.page_url).toBeTruthy()
  })

  test('submit tyhjentää lomakkeen', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await page.locator('#fb-textarea').fill('Testi')
    await page.locator('#fb-submit').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#fb-textarea')).toHaveValue('')
  })

  test('elementtipickeri aktivoituu ja deaktivoituu', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()

    const pickerBtn = page.locator('#fb-picker-toggle')
    await pickerBtn.click()
    await expect(pickerBtn).toHaveClass(/active/)

    await pickerBtn.click()
    await expect(pickerBtn).not.toHaveClass(/active/)
  })

  test('Escape peruuttaa picker-moodin', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await page.locator('#fb-picker-toggle').click()
    await expect(page.locator('#fb-picker-toggle')).toHaveClass(/active/)

    await page.keyboard.press('Escape')
    await expect(page.locator('#fb-picker-toggle')).not.toHaveClass(/active/)
  })

  test('picker valitsee elementin ja päivittää element-info', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await page.locator('#fb-picker-toggle').click()

    // Klikkaa toolbar-elementtiä picker-moodissa
    const toolbar = page.locator('#toolbar')
    if (await toolbar.count() > 0) {
      await toolbar.click({ force: true })
      await page.waitForTimeout(300)

      await expect(page.locator('#fb-picker-toggle')).not.toHaveClass(/active/)
      const infoText = await page.locator('#fb-element-info').textContent()
      expect(infoText).not.toBe('Ei elementtiä valittuna')
    }
  })

  test('lista-tab näyttää tyhjän tilan', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await page.locator('.fb-tab[data-tab="lista"]').click()
    await page.waitForTimeout(600)
    await expect(page.locator('#fb-list-content')).toContainText('Ei palautetta')
  })

  test('lista-tab näyttää feedback-itemit', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.route('/api/devfeedback**', route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: SAMPLE_ITEMS })
    })
    await page.goto('/')
    await page.waitForTimeout(1200)

    await page.locator('#fb-toggle').click()
    await page.locator('.fb-tab[data-tab="lista"]').click()
    await page.waitForTimeout(600)

    const list = page.locator('#fb-list-content')
    await expect(list).toContainText('Nappi ei toimi mobiililla')
    await expect(list).toContainText('Fontti liian pieni listassa')
    await expect(list).toContainText('Bug')
    await expect(list).toContainText('UX')
  })

  test('bubble-up/down napit näkyvät', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await expect(page.locator('#fb-bubble-up')).toBeVisible()
    await expect(page.locator('#fb-bubble-down')).toBeVisible()
  })

  test('Vie Claudelle -nappi näkyy lista-tabissa', async ({ page }) => {
    await setupPage(page)
    await page.locator('#fb-toggle').click()
    await page.locator('.fb-tab[data-tab="lista"]').click()
    await expect(page.locator('#fb-export')).toBeVisible()
  })
})
