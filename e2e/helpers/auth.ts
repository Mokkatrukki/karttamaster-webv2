import type { Page } from 'playwright/test'

// Mock /api/auth/me → järjestäjä, skip login form in E2E tests
export async function mockAuthAsJarjestaja(page: Page): Promise<void> {
  await page.route('/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'järjestäjä', display_name: 'Testi' }) })
  )
}

export async function mockAuthAsTalkoolainen(page: Page, code = 'TEST01'): Promise<void> {
  await page.route('/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'talkoolainen', code, display_name: 'Talkoolainen' }) })
  )
}
