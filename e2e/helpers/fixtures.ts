// UX-mobiiliauditin fixtuurit: yksi paikka jossa JOKAINEN näkymä saa realistisen datan.
// Tyhjä näkymä mahtuu aina ruudulle — ahtaus näkyy vasta täydellä listalla, pitkillä nimillä
// ja isoilla luvuilla ∴ fixtuurit ovat tarkoituksella "pahin uskottava tapaus".
import type { Page, Route } from 'playwright/test'

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

export const CODE = 'TEST01'

// Pitkät nimet ovat pointti: "Pätkä 1" mahtuu kaikkialle, oikea nimi ei.
export const SEGMENTS = [
  {
    id: 'seg-01', routeIds: ['smtb-30'], startDist: 0, endDist: 12500,
    displayName: 'Iso-Syötteen pohjoisrinne 0–12,5 km', description: 'Aloitus parkkipaikalta.',
    assignedCode: CODE, assignedName: 'Matti Meikäläinen', equipment: [
      { name: 'Nauharullia', count: 5 }, { name: 'Vasara', count: 1 }, { name: 'Keppejä', count: 50 },
    ],
    phase: 'asettaminen', inspected: false, completed: false,
  },
  {
    id: 'seg-02', routeIds: ['smtb-55', 'smtb-110-siirtyma'], startDist: 12500, endDist: 31000,
    displayName: 'Pytkynharju – Naatikkavaara siirtymä', description: '',
    assignedCode: 'TEST02', assignedName: 'Anna Virtanen-Kekkonen', equipment: [],
    phase: 'asettaminen', inspected: true, completed: false,
  },
  {
    id: 'seg-03', routeIds: ['sgf-125'], startDist: 0, endDist: 44000,
    displayName: 'Gravel 125 – eteläsilmukka', description: '',
    assignedCode: undefined, equipment: [],
    phase: 'asettaminen', inspected: false, completed: true,
  },
  {
    id: 'seg-04', routeIds: ['sgf-175'], startDist: 44000, endDist: 98000,
    displayName: 'Gravel 175 – Kuusamon suunta', description: '',
    assignedCode: undefined, equipment: [],
    phase: 'purku', inspected: false, completed: false,
  },
]

const STATUSES = ['suunniteltu', 'asetettu', 'tarkistettu', 'kerätty', 'ei_tarpeen']

export const MARKERS = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `mk-${String(i + 1).padStart(2, '0')}`,
    type: i % 2 ? 'right' : 'left',
    lat: 65.62 + i * 0.002, lon: 27.62 + i * 0.003,
    distance_from_start: 400 + i * 900,
    route_ids: ['smtb-30'],
    status: STATUSES[i % STATUSES.length],
    location_note: i === 3 ? 'Kelo kaatumassa polun yli — hox tarkistajalle' : null,
    color: null, label: i % 2 ? 'Oikealle' : 'Vasemmalle',
    icon_id: null, image_id: null, template_id: i % 2 ? 'right' : 'left',
    parts_json: null, description: null, images: [], created_by: null,
  })),
  // Kasat /kasat-näkymälle: yksi vapaa, yksi varattu, yksi haettu.
  {
    id: 'pile-01', type: 'kerayskasa', lat: 65.611, lon: 27.601,
    distance_from_start: 2100, route_ids: ['smtb-30'], status: 'kerätty',
    location_note: 'Tienviitan juurella, ison kuusen takana', color: '#8A5CD1',
    label: 'Keräyskasa', icon_id: 'package', image_id: null,
    template_id: 'kerayskasa', parts_json: null, description: null, images: [],
    created_by: 'Matti', pile_marker_ids: ['mk-01', 'mk-02', 'mk-03', 'mk-04'],
  },
  {
    id: 'pile-02', type: 'kerayskasa', lat: 65.641, lon: 27.661,
    distance_from_start: 18400, route_ids: ['smtb-55'], status: 'kerätty',
    location_note: null, color: '#8A5CD1', label: 'Keräyskasa', icon_id: 'package',
    image_id: null, template_id: 'kerayskasa', parts_json: null, description: null,
    images: [], created_by: 'Anna', pile_marker_ids: ['mk-05', 'mk-06'],
    claimed_by: 'Autoporukka Pekka', claimed_at: '2026-07-30T08:15:00.000Z',
  },
  {
    id: 'pile-03', type: 'kerayskasa', lat: 65.601, lon: 27.701,
    distance_from_start: 30100, route_ids: ['sgf-125'], status: 'tarkistettu',
    location_note: null, color: '#8A5CD1', label: 'Keräyskasa', icon_id: 'package',
    image_id: null, template_id: 'kerayskasa', parts_json: null, description: null,
    images: [], created_by: 'Anna', pile_marker_ids: ['mk-07'],
  },
]

export const AREAS = [
  {
    id: 'area-01', name: 'Huoltopiste Romevaara', centerLat: 65.627, centerLng: 27.628,
    widthM: 400, heightM: 250, rotation: 0,
    markdownDescription: 'Huolto auki 8–18. Vesi, mehu, banaani.',
    status: 'suunniteltu', hashCode: 'h1',
    features: [
      { id: 'f1', name: 'Teltta', centerLat: 65.627, centerLng: 27.628, widthM: 100, heightM: 80, rotation: 0, color: '#3b82f6' },
      { id: 'f2', name: 'WC-kontti', centerLat: 65.628, centerLng: 27.629, widthM: 50, heightM: 40, rotation: 0, color: '#10b981' },
      { id: 'f3', name: 'Pysäköinti', centerLat: 65.626, centerLng: 27.627, widthM: 200, heightM: 90, rotation: 15, color: '#f59e0b' },
    ],
  },
  {
    id: 'area-02', name: 'Maalialue', centerLat: 65.615, centerLng: 27.610,
    widthM: 300, heightM: 200, rotation: 0, markdownDescription: '', status: 'asetettu',
    hashCode: 'h2', features: [],
  },
]

export const TEMPLATES = [
  { id: 'left', label: 'Vasemmalle', color: '#2563eb', description: '', favorite: true, iconId: 'arrow-left' },
  { id: 'right', label: 'Oikealle', color: '#16a34a', description: '', favorite: true, iconId: 'arrow-right' },
  { id: 'upcoming-left', label: 'Tuleva vasemmalle', color: '#7c3aed', description: '', favorite: true, iconId: 'corner-up-left' },
  { id: 'upcoming-right', label: 'Tuleva oikealle', color: '#b45309', description: '', favorite: true, iconId: 'corner-up-right' },
  { id: 'huolto-25', label: 'Huoltopiste 25 km — vesi ja mehu', color: '#0ea5e9', description: 'Pitkä kuvaus joka venyttää rivin.', favorite: false, iconId: 'droplet' },
  { id: 'kerayskasa', label: 'Keräyskasa', color: '#8A5CD1', description: '', favorite: false, iconId: 'package' },
]

export const INVENTORY_LOCATIONS = [
  { id: 'loc-1', name: 'Kärry', sort_order: 0 },
  { id: 'loc-2', name: 'Varasto — Syötekeskuksen takapiha', sort_order: 1 },
]

export const INVENTORY = [
  { id: 'inv-1', name: 'Nauharulla', qty: 42, unit: 'kpl', location: null, note: null, location_id: 'loc-1', template_id: null, not_sign: 1 },
  { id: 'inv-2', name: 'Oikealle', qty: 118, unit: 'kpl', location: null, note: 'Loput kärryssä', location_id: 'loc-1', template_id: 'right', not_sign: 0 },
  { id: 'inv-3', name: 'Vasemmalle', qty: 96, unit: 'kpl', location: null, note: null, location_id: 'loc-2', template_id: 'left', not_sign: 0 },
  { id: 'inv-4', name: 'Huoltopiste 25 km — vesi ja mehu', qty: 3, unit: 'kpl', location: null, note: null, location_id: 'loc-2', template_id: 'huolto-25', not_sign: 0 },
  { id: 'inv-5', name: 'Kepit 120 cm', qty: 512, unit: 'kpl', location: null, note: null, location_id: 'loc-2', template_id: null, not_sign: 1 },
]

export const AUDIT = Array.from({ length: 20 }, (_, i) => ({
  id: `au-${i}`,
  marker_id: `mk-${String((i % 12) + 1).padStart(2, '0')}`,
  action: (['add', 'move', 'status', 'remove', 'link'] as const)[i % 5],
  actor: i % 2 ? 'Matti Meikäläinen' : 'Anna Virtanen-Kekkonen',
  actor_role: i % 3 ? 'talkoolainen' : 'järjestäjä',
  segment_code: i % 2 ? CODE : 'TEST02',
  created_at: `2026-07-${String(10 + (i % 20)).padStart(2, '0')}T1${i % 10}:30:00.000Z`,
  payload: { lat: 65.62, lon: 27.62, status: 'asetettu' },
}))

export const ADMIN_USERS = [
  { id: 'u1', username: 'mokka', display_name: 'Mokka Pääjärjestäjä', role: 'admin', is_active: 1, created_at: '2026-06-01T10:00:00.000Z' },
  { id: 'u2', username: 'anna', display_name: 'Anna Virtanen-Kekkonen', role: 'järjestäjä', is_active: 1, created_at: '2026-06-15T10:00:00.000Z' },
  { id: 'u3', username: 'pekka', display_name: 'Pekka', role: 'järjestäjä', is_active: 0, created_at: '2026-07-02T10:00:00.000Z' },
]

const FAQ = `## Aikataulu
Perjantai 18:00 kokoontuminen Syötekeskuksella.

## Ruokailu
Lauantaina lounas klo 12 maalialueella.

## Yhteystiedot
Mokka 040 123 4567`

export type MockRole = 'järjestäjä' | 'talkoolainen' | 'admin'

export interface MockOpts {
  /** Tapahtuman vaihe. `/kasat` renderöi listan VAIN purkuvaiheessa (V332). */
  phase?: 'asettaminen' | 'tarkastus' | 'purku'
}

/** Mockaa KAIKKI luku-API:t + nielaisee kirjoitukset. Kutsu ennen `page.goto`. */
export async function mockEverything(
  page: Page, role: MockRole = 'järjestäjä', opts: MockOpts = {},
): Promise<void> {
  const ok = (r: Route, body: unknown) => r.fulfill(json(body))
  const phase = opts.phase ?? 'asettaminen'

  await page.route('**/api/auth/me', r => ok(r, {
    role, code: role === 'talkoolainen' ? CODE : undefined,
    display_name: role === 'talkoolainen' ? 'Matti Meikäläinen' : 'Mokka Pääjärjestäjä',
  }))
  await page.route('**/api/phase', r => ok(r, { phase }))
  await page.route('**/api/faq', r => ok(r, { markdown: FAQ }))
  await page.route('**/api/admin/faq', r => ok(r, { markdown: FAQ }))
  await page.route('**/api/templates', r =>
    r.request().method() === 'GET' ? ok(r, TEMPLATES) : ok(r, {}))
  await page.route('**/api/areas**', r =>
    r.request().method() === 'GET' ? ok(r, AREAS) : ok(r, {}))
  // JÄRJESTYS ON MERKITSEVÄ: Playwright kokeilee routeja VIIMEKSI rekisteröidystä.
  // Yleinen ensin, tarkempi päälle — muuten `**/api/segments**` söisi `by-code`-mockin
  // ja talkoolaisen pätkänäkymä jäisi lataamatta (näkyi tyhjänä karttana, ei virheenä).
  await page.route('**/api/segments**', r =>
    r.request().method() === 'GET' ? ok(r, SEGMENTS) : ok(r, {}))
  await page.route(new RegExp(`/api/segments/by-code/${CODE}`), r => ok(r, SEGMENTS[0]))
  await page.route('**/api/markers**', r =>
    r.request().method() === 'GET' ? ok(r, MARKERS) : ok(r, {}))
  await page.route(/\/api\/markers\/[^/]+$/, r =>
    r.request().method() === 'GET' ? ok(r, MARKERS[0]) : ok(r, {}))
  await page.route('**/api/markers/*/claim', r => ok(r, {}))
  await page.route('**/api/audit**', r =>
    r.request().method() === 'GET' ? ok(r, AUDIT) : ok(r, { undone: 0 }))
  await page.route('**/api/inventory**', r =>
    r.request().method() === 'GET' ? ok(r, INVENTORY) : ok(r, {}))
  await page.route('**/api/inventory/locations**', r =>
    r.request().method() === 'GET' ? ok(r, INVENTORY_LOCATIONS) : ok(r, {}))
  await page.route('**/api/admin/users**', r =>
    r.request().method() === 'GET' ? ok(r, ADMIN_USERS) : ok(r, {}))
  await page.route('**/api/admin/settings**', r =>
    r.request().method() === 'GET' ? ok(r, { talkoo_password_set: true }) : ok(r, {}))
  await page.route('**/api/snapshots**', r =>
    r.request().method() === 'GET' ? ok(r, [
      { id: 's1', created_at: '2026-07-30T10:00:00.000Z', marker_count: 194, kind: 'manual' },
      { id: 's2', created_at: '2026-07-29T03:00:00.000Z', marker_count: 190, kind: 'cron' },
    ]) : ok(r, {}))
  // SSE: älä jätä auki — testin ei pidä odottaa streamia.
  await page.route('**/api/stream**', r => r.fulfill({ status: 204, body: '' }))
}
