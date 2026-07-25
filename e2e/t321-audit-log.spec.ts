/**
 * T321 E2E — /loki-näkymä (V231).
 * Validoi: järjestäjä näkee lokin ja peruu siirron; talkoolainen ei pääse sisään.
 * Backend mockataan (reitit on katettu Bun-tasolla server/audit-undo.test.ts).
 */
import { test, expect } from 'playwright/test'

const MARKERS = [
  { id: 'm1', type: 'nuoli-vasemmalle', lat: 65.5825, lon: 27.81166, distanceFromStart: 40000, routeIds: ['smtb-55'], status: 'suunniteltu' },
]

const AUDIT = [
  {
    id: 'audit-1',
    marker_id: 'm1',
    action: 'move',
    actor: 'Liisa',
    actor_role: 'talkoolainen',
    segment_code: 'PATKA-1',
    created_at: '2026-07-25T07:39:33.000Z',
    payload: { lat: 65.57585, lon: 27.65917, distance_from_start: 33000, route_ids: ['smtb-55'] },
  },
  {
    id: 'audit-2',
    marker_id: 'm1',
    action: 'add',
    actor: 'krossikommuuni',
    actor_role: 'järjestäjä',
    segment_code: 'PATKA-1',
    created_at: '2026-07-24T16:05:47.000Z',
    payload: null,
  },
]

async function mockLoki(page: import('playwright/test').Page, role: string): Promise<{ undone: string[] }> {
  const undone: string[] = []
  await page.route('/api/auth/me', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role, display_name: role }) }))
  await page.route(/\/api\/audit(\?|$)/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AUDIT.filter(a => !undone.includes(a.id))) }))
  await page.route(/\/api\/audit\/undo\/(.+)$/, r => {
    undone.push(r.request().url().split('/').pop()!)
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route(/\/api\/markers(\?|$)/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MARKERS) }))
  return { undone }
}

test.describe('T321 — aktiviteettiloki', () => {
  test('järjestäjä näkee rivit, poikkeaman ja voi perua siirron', async ({ page }) => {
    const state = await mockLoki(page, 'järjestäjä')
    await page.goto('/loki.html')

    const rows = page.locator('.audit-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('Liisa')
    await expect(rows.first()).toContainText('siirsi merkkiä')

    // 2026-07-25 todellinen siirto ≈ 7 km → korostettu poikkeama
    const deviation = rows.first().locator('.audit-deviation')
    await expect(deviation).toHaveText(/^70\d\d m$/)
    await expect(deviation).toHaveClass(/audit-deviation-warn/)

    // Tuhoava toiminto → vahvistus (V102)
    page.on('dialog', d => d.accept())
    await rows.first().locator('.audit-undo').click()

    await expect(page.locator('.audit-status')).toContainText('peruttu')
    await expect(page.locator('.audit-row')).toHaveCount(1)
    expect(state.undone).toContain('audit-1')
  })

  test('suodatin karsii rivit roolin mukaan', async ({ page }) => {
    await mockLoki(page, 'järjestäjä')
    await page.goto('/loki.html')
    await expect(page.locator('.audit-row')).toHaveCount(2)

    await page.locator('#audit-filter-role').selectOption('järjestäjä')
    await expect(page.locator('.audit-row')).toHaveCount(1)
    await expect(page.locator('.audit-row')).toContainText('krossikommuuni')
  })

  test('talkoolainen ei pääse lokiin (V231)', async ({ page }) => {
    await mockLoki(page, 'talkoolainen')
    await page.goto('/loki.html')
    await expect(page.locator('.audit-row')).toHaveCount(0)
    await expect(page.locator('#loki-content')).toContainText(/oikeu/i)
  })

  test('peruutusnapit ovat kosketuskokoa (§R 44px)', async ({ page }) => {
    await mockLoki(page, 'järjestäjä')
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/loki.html')
    const box = await page.locator('.audit-undo').first().boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
