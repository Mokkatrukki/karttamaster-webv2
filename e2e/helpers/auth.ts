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

// T232/T233: talkoolaisen SegmentView-hero (GPS-nappi, ◀▶, +Merkki) vaatii ladatun pätkän
// (`/api/segments/by-code/:code`). Seedaa pätkä + valinnaisesti yksi asettamaton merkki
// (`/api/markers`) jotta hero renderöi seuraava-merkki-ohjauksen. Kutsu ENNEN page.goto.
export async function mockTalkoolainenSegment(
  page: Page,
  opts: { code?: string; withMarker?: boolean } = {},
): Promise<void> {
  const code = opts.code ?? 'TEST01'
  const seg = {
    id: 'seg-e2e', routeIds: ['35km'], startDist: 0, endDist: 100000,
    assignedCode: code, displayName: 'E2E-pätkä', description: '', equipment: [],
    phase: 'asettaminen', inspected: false, completed: false,
  }
  await page.route(new RegExp(`/api/segments/by-code/${code}$`), route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seg) }))
  if (opts.withMarker) {
    const marker = {
      id: 'mk-e2e', type: 'right', lat: 65.62, lon: 27.62, distance_from_start: 5000,
      route_ids: ['35km'], status: 'suunniteltu', location_note: null, color: null,
      label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
      description: null, images: [], created_by: null,
    }
    await page.route(/\/api\/markers(\?|$)/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([marker]) })
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    })
  }
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
