/**
 * Talkoolais-hub (T267–T276) E2E
 * Validates: /patkat yleissalasana-login → hub-lista (Model B, V188);
 *            järjestäjä-crossover /s/<koodi> → talkoo-näkymä (V189, T274).
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockTalkoolainenSegment } from './helpers/auth'

test.describe('Talkoolais-hub', () => {
  test('/patkat: yleissalasana-login → pätkälista näkyy (V188)', async ({ page }) => {
    let authed = false
    await page.route('/api/auth/me', r =>
      r.fulfill({
        status: authed ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(authed ? { role: 'talkoolainen', display_name: 'Talkoolainen' } : { error: 'unauthorized' }),
      }))
    await page.route('/api/auth/talkoo-login', r => {
      authed = true
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'talkoolainen', display_name: 'Talkoolainen' }) })
    })
    await page.route('/api/faq', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ markdown: '# Info\n\nAamupala 9–10 hotellilla' }) }))
    await page.route(/\/api\/segments$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 's1', routeIds: ['35km'], startDist: 0, endDist: 1000, assignedCode: 'PATKA-1', displayName: 'Pätkä 1', equipment: [], phase: 'asettaminen' },
      ]) }))
    await page.route(/\/api\/markers(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.goto('/patkat')
    await expect(page.locator('.patkat-login-input')).toBeVisible()
    await page.locator('.patkat-login-input').fill('syote2026')
    await page.locator('.patkat-login-btn').click()

    await expect(page.locator('.patkat-row-name')).toContainText('Pätkä 1')
    await expect(page.locator('.patkat-row-open')).toBeVisible()
    await expect(page.locator('.patkat-faq-body')).toContainText('Aamupala')
  })

  test('crossover: järjestäjä + /s/<koodi> → talkoo-näkymä, ei sivupalkkia (V189, T274)', async ({ page }) => {
    await mockAuthAsJarjestaja(page) // /api/auth/me → 200 järjestäjä (sessio säilyy)
    await mockTalkoolainenSegment(page, { code: 'PATKA-1', withMarker: true })

    await page.goto('/s/PATKA-1')
    // Koodin läsnäolo → talkoo-layout riippumatta tilin roolista (client-view-flip).
    await expect.poll(() => page.evaluate(() => document.body.dataset.role), { timeout: 8000 }).toBe('talkoolainen')
    await expect(page.locator('#left-panel')).toBeHidden()
  })
})
