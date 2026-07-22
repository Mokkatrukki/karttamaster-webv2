import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { adminRoutes } from './routes/admin'
import { faqRoutes } from './routes/faq'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/admin', adminRoutes)
  app.route('/api/faq', faqRoutes)
  return app
}

describe('T269/V190: FAQ backend', () => {
  let db: Database
  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })
  afterEach(() => db.close())

  test('tyhjä oletus → GET /api/faq palauttaa ""', async () => {
    const res = await makeApp(db).request('/api/faq', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect((await res.json()) as { markdown: string }).toEqual({ markdown: '' })
  })

  test('admin PUT → GET roundtrip (talkoolainen lukee)', async () => {
    const app = makeApp(db)
    const md = '# Aikataulu\n\n- Aamupala **9–10** hotellilla\n- Lounas 13–15 3BA-mökissä'
    const put = await app.request('/api/admin/faq', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'admin') },
      body: JSON.stringify({ markdown: md }),
    })
    expect(put.status).toBe(200)

    const get = await app.request('/api/faq', { headers: authHeaders(db, 'talkoolainen') })
    expect((await get.json()) as { markdown: string }).toEqual({ markdown: md })
  })

  test('GET /api/faq vaatii autentikoinnin → 401 ilman sessiota', async () => {
    const res = await makeApp(db).request('/api/faq')
    expect(res.status).toBe(401)
  })

  test('järjestäjä lukee FAQ:n (∀ autentikoitu)', async () => {
    const res = await makeApp(db).request('/api/faq', { headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(200)
  })

  test('järjestäjä EI saa kirjoittaa FAQ:ta → 403', async () => {
    const res = await makeApp(db).request('/api/admin/faq', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ markdown: 'yritys' }),
    })
    expect(res.status).toBe(403)
  })
})
