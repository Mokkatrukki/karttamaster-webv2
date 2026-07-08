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

// T195/V125: kirjasto seedaa tyhjänä ja tulee backendistä (V123). E2E-pickerit tarvitsevat
// suosikkeja → mockaa /api/templates palauttamaan kiinteä joukko (id 'right' = "Oikealle").
export async function mockTemplates(page: Page): Promise<void> {
  await page.route('/api/templates', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'left', label: 'Vasemmalle', color: '#2563eb', description: '', favorite: true },
        { id: 'right', label: 'Oikealle', color: '#16a34a', description: '', favorite: true },
        { id: 'upcoming-left', label: 'Tuleva vasemmalle', color: '#7c3aed', description: '', favorite: true },
        { id: 'upcoming-right', label: 'Tuleva oikealle', color: '#b45309', description: '', favorite: true },
      ]) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
}
