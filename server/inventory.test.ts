import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { inventoryRoutes } from './routes/inventory'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'
import type { InventoryItem } from './routes/inventory'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/inventory', inventoryRoutes)
  return app
}

const jsonHeaders = (cookie: { Cookie: string }) => ({ ...cookie, 'Content-Type': 'application/json' })

describe('T240: inventaario-API', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })

  afterEach(() => db.close())

  // ── V163: auth-gate ──────────────────────────────────────────────────────

  test('V163: ei sessiota → 401', async () => {
    const res = await app.request('/api/inventory')
    expect(res.status).toBe(401)
  })

  test('V163: talkoolainen → 403', async () => {
    const res = await app.request('/api/inventory', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(403)
  })

  test('V163: talkoolainen ei voi POSTata → 403', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'talkoolainen')),
      body: JSON.stringify({ name: 'nitoja', qty: 2 }),
    })
    expect(res.status).toBe(403)
  })

  test('V163: järjestäjä pääsee listaan → 200', async () => {
    const res = await app.request('/api/inventory', { headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  test('V163: admin pääsee listaan → 200', async () => {
    const res = await app.request('/api/inventory', { headers: authHeaders(db, 'admin') })
    expect(res.status).toBe(200)
  })

  // ── CRUD happy path (V18: backend totuus, GET näkee POST) ─────────────────

  test('POST → GET näkee rivin; created_by sessiosta', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'Nitoja', qty: 2, unit: 'kpl', note: 'iso' }),
    })
    expect(post.status).toBe(201)
    const created = (await post.json()) as InventoryItem
    expect(created.name).toBe('Nitoja')
    expect(created.qty).toBe(2)
    expect(created.unit).toBe('kpl')
    expect(created.note).toBe('iso')
    expect(created.created_by).toBe('Testi Järjestäjä') // sessiosta, ei bodystä

    const list = await app.request('/api/inventory', { headers: authHeaders(db, 'järjestäjä') })
    const items = (await list.json()) as InventoryItem[]
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(created.id)
  })

  test('created_by EI client-bodystä (spoof-esto)', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'x', qty: 1, created_by: 'HAKKERI' }),
    })
    const created = (await post.json()) as InventoryItem
    expect(created.created_by).toBe('Testi Järjestäjä')
  })

  test('PUT muokkaa rivin', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: 10 }),
    })
    const { id } = (await post.json()) as InventoryItem
    const put = await app.request(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: 7, note: 'otin 3' }),
    })
    expect(put.status).toBe(200)
    const updated = (await put.json()) as InventoryItem
    expect(updated.qty).toBe(7)
    expect(updated.note).toBe('otin 3')
  })

  test('DELETE poistaa rivin', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'teltta', qty: 1 }),
    })
    const { id } = (await post.json()) as InventoryItem
    const del = await app.request(`/api/inventory/${id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    expect(del.status).toBe(200)
    const list = await app.request('/api/inventory', { headers: authHeaders(db, 'järjestäjä') })
    expect((await list.json()) as InventoryItem[]).toHaveLength(0)
  })

  test('PUT/DELETE tuntematon id → 404', async () => {
    const put = await app.request('/api/inventory/ei-ole', {
      method: 'PUT',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'x', qty: 1 }),
    })
    expect(put.status).toBe(404)
    const del = await app.request('/api/inventory/ei-ole', { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    expect(del.status).toBe(404)
  })

  test('duplikaattinimet sallitaan (ei uniikkiutta)', async () => {
    const h = jsonHeaders(authHeaders(db, 'järjestäjä'))
    await app.request('/api/inventory', { method: 'POST', headers: h, body: JSON.stringify({ name: 'nitoja', qty: 1 }) })
    const second = await app.request('/api/inventory', { method: 'POST', headers: h, body: JSON.stringify({ name: 'nitoja', qty: 1 }) })
    expect(second.status).toBe(201)
  })

  // ── V161: name pakko ─────────────────────────────────────────────────────

  test('V161: tyhjä name → 400', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: '', qty: 1 }),
    })
    expect(res.status).toBe(400)
  })

  test('V161: pelkkä whitespace name → 400', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: '   ', qty: 1 }),
    })
    expect(res.status).toBe(400)
  })

  test('V161: puuttuva name → 400', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ qty: 1 }),
    })
    expect(res.status).toBe(400)
  })

  test('V161: PUT tyhjä name → 400 (invariantti kattaa myös PUT)', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: 5 }),
    })
    const { id } = (await post.json()) as InventoryItem
    const put = await app.request(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: '  ', qty: 5 }),
    })
    expect(put.status).toBe(400)
  })

  // ── V162: qty äärellinen numero >= 0 ─────────────────────────────────────

  test('V162: qty=0 → 201', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'nauha', qty: 0 }),
    })
    expect(res.status).toBe(201)
  })

  test('V162: qty puuttuu → default 0, 201', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'nauha' }),
    })
    expect(res.status).toBe(201)
    expect(((await res.json()) as InventoryItem).qty).toBe(0)
  })

  test('V162: negatiivinen qty → 400', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: -5 }),
    })
    expect(res.status).toBe(400)
  })

  test('V162: qty string "5" (coercion-reikä) → 400', async () => {
    const res = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: '5' }),
    })
    expect(res.status).toBe(400)
  })

  test('V162: qty Infinity (raakabody) → 400', async () => {
    const h = jsonHeaders(authHeaders(db, 'järjestäjä'))
    // JSON.stringify(Infinity) === "null" → ei kelpaa testiin; lähetä raakabody jossa 1e999.
    // JSON.parse('1e999') === Infinity → Number.isFinite false → validointi hylkää.
    const inf = await app.request('/api/inventory', { method: 'POST', headers: h, body: '{"name":"x","qty":1e999}' })
    expect(inf.status).toBe(400)
  })

  test('V162: qty NaN-body (epäkelpo JSON) → ei 201', async () => {
    const h = jsonHeaders(authHeaders(db, 'järjestäjä'))
    // NaN ei ole validia JSONia → c.req.json() kaatuu → catch → {} → name puuttuu → 400.
    const res = await app.request('/api/inventory', { method: 'POST', headers: h, body: '{"name":"x","qty":NaN}' })
    expect(res.status).not.toBe(201)
    expect(res.status).toBe(400)
  })

  test('V162: PUT negatiivinen qty → 400', async () => {
    const post = await app.request('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: 5 }),
    })
    const { id } = (await post.json()) as InventoryItem
    const put = await app.request(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: jsonHeaders(authHeaders(db, 'järjestäjä')),
      body: JSON.stringify({ name: 'kepit', qty: -1 }),
    })
    expect(put.status).toBe(400)
  })
})

// ── T243: inventaario v2 — paikat + merkkikytkös ─────────────────────────────

function seedTemplate(db: Database, id: string, label: string): void {
  db.run(
    'INSERT INTO templates (id, label, color, updated_at) VALUES (?, ?, ?, ?)',
    [id, label, '#10b981', new Date().toISOString()],
  )
}

describe('T243: paikat (inventory_locations)', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>
  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })
  afterEach(() => db.close())

  const jh = () => jsonHeaders(authHeaders(db, 'järjestäjä'))

  test('paikka-CRUD: POST → GET → PUT → DELETE', async () => {
    const post = await app.request('/api/inventory/locations', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'Kärry' }) })
    expect(post.status).toBe(201)
    const loc = (await post.json()) as { id: string; name: string }
    expect(loc.name).toBe('Kärry')

    const list = await app.request('/api/inventory/locations', { headers: authHeaders(db, 'järjestäjä') })
    expect((await list.json()) as unknown[]).toHaveLength(1)

    const put = await app.request(`/api/inventory/locations/${loc.id}`, { method: 'PUT', headers: jh(), body: JSON.stringify({ name: 'Varasto' }) })
    expect(put.status).toBe(200)
    expect(((await put.json()) as { name: string }).name).toBe('Varasto')

    const del = await app.request(`/api/inventory/locations/${loc.id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })
    expect(del.status).toBe(200)
  })

  test('paikka: tyhjä name → 400', async () => {
    const r = await app.request('/api/inventory/locations', { method: 'POST', headers: jh(), body: JSON.stringify({ name: '  ' }) })
    expect(r.status).toBe(400)
  })

  test('paikka: talkoolainen → 403 (V163)', async () => {
    const r = await app.request('/api/inventory/locations', { headers: authHeaders(db, 'talkoolainen') })
    expect(r.status).toBe(403)
  })

  test('V166: paikan poisto nullaa itemien location_id, ei poista itemeja', async () => {
    const loc = (await (await app.request('/api/inventory/locations', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'Kärry' }) })).json()) as { id: string }
    await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'kepit', qty: 5, location_id: loc.id }) })

    await app.request(`/api/inventory/locations/${loc.id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })

    const items = (await (await app.request('/api/inventory', { headers: authHeaders(db, 'järjestäjä') })).json()) as InventoryItem[]
    expect(items).toHaveLength(1) // item säilyy
    expect(items[0].location_id).toBeNull() // location_id nullattu
  })

  test('location_id-suodatus: ?location_id=X + ?location_id=none', async () => {
    const loc = (await (await app.request('/api/inventory/locations', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'Kärry' }) })).json()) as { id: string }
    await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'kepit', qty: 1, location_id: loc.id }) })
    await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ name: 'orpo', qty: 1 }) }) // ei paikkaa

    const inLoc = (await (await app.request(`/api/inventory?location_id=${loc.id}`, { headers: authHeaders(db, 'järjestäjä') })).json()) as InventoryItem[]
    expect(inLoc).toHaveLength(1)
    expect(inLoc[0].name).toBe('kepit')

    const orphans = (await (await app.request('/api/inventory?location_id=none', { headers: authHeaders(db, 'järjestäjä') })).json()) as InventoryItem[]
    expect(orphans).toHaveLength(1)
    expect(orphans[0].name).toBe('orpo')
  })
})

describe('T243: merkkikytkös (template_id, V161/V165)', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>
  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    app = makeApp(db)
  })
  afterEach(() => db.close())

  const jh = () => jsonHeaders(authHeaders(db, 'järjestäjä'))

  test('V161: merkkirivi (template_id) EI vaadi namea → 201, name = template.label snapshot', async () => {
    seedTemplate(db, 'tpl-1', 'Alueella pyöräkilpailu')
    const r = await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ template_id: 'tpl-1', qty: 3 }) })
    expect(r.status).toBe(201)
    const item = (await r.json()) as InventoryItem
    expect(item.template_id).toBe('tpl-1')
    expect(item.name).toBe('Alueella pyöräkilpailu') // snapshot (V165)
    expect(item.qty).toBe(3)
  })

  test('template_id joka ei ole olemassa → 404', async () => {
    const r = await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ template_id: 'ei-ole', qty: 1 }) })
    expect(r.status).toBe(404)
  })

  test('V161: tarvike (ei template_id) yhä vaatii namen → 400', async () => {
    const r = await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ qty: 1 }) })
    expect(r.status).toBe(400)
  })

  test('V165: inventaariorivin poisto EI poista SignTemplatea (unlink)', async () => {
    seedTemplate(db, 'tpl-2', 'Kyltti')
    const item = (await (await app.request('/api/inventory', { method: 'POST', headers: jh(), body: JSON.stringify({ template_id: 'tpl-2', qty: 1 }) })).json()) as InventoryItem
    await app.request(`/api/inventory/${item.id}`, { method: 'DELETE', headers: authHeaders(db, 'järjestäjä') })

    const tpl = db.query('SELECT id FROM templates WHERE id = ?').get('tpl-2')
    expect(tpl).not.toBeNull() // template säilyy kirjastossa
  })
})
