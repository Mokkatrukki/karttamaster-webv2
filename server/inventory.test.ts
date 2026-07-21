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
      body: JSON.stringify({ name: 'Nitoja', qty: 2, unit: 'kpl', location: 'kärry', note: 'iso' }),
    })
    expect(post.status).toBe(201)
    const created = (await post.json()) as InventoryItem
    expect(created.name).toBe('Nitoja')
    expect(created.qty).toBe(2)
    expect(created.unit).toBe('kpl')
    expect(created.location).toBe('kärry')
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
