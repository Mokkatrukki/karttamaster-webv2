import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { authRoutes, __resetTalkooRateLimit } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { seedTestUsers, authHeaders } from './test-fixtures'
import { setSetting, SETTING_TALKOO_PASSWORD } from './settings'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/auth', authRoutes)
  app.route('/api/admin', adminRoutes)
  return app
}

// Plaintext-salasana suoraan settingsiin (käyttäjäpäätös: admin voi katsoa salasanan).
const PW = 'salaisuus26'
function seedTalkooPassword(db: Database, pw = PW): void {
  setSetting(db, SETTING_TALKOO_PASSWORD, pw)
}

describe('T267/V188: yleissalasana + Model B talkoo-auth', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
    __resetTalkooRateLimit()
  })

  afterEach(() => db.close())

  // ── POST /api/auth/talkoo-login (V188-portti) ──────────────────────────────

  test('oikea salasana → 200 + session-cookie role=talkoolainen (V188)', async () => {
    seedTalkooPassword(db)
    const res = await makeApp(db).request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PW }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { role: string; display_name: string }
    expect(body.role).toBe('talkoolainen')
    expect(res.headers.get('set-cookie')).toContain('session=')
    expect(res.headers.get('set-cookie')).toContain('HttpOnly')
  })

  test('väärä salasana → 401', async () => {
    seedTalkooPassword(db)
    const res = await makeApp(db).request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'väärä' }),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  test('salasana asettamatta → 401 (ei portilla auki)', async () => {
    const res = await makeApp(db).request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PW }),
    })
    expect(res.status).toBe(401)
  })

  test('10 väärää yritystä → 429 rate-limit', async () => {
    seedTalkooPassword(db)
    const app = makeApp(db)
    const attempt = (pw: string) =>
      app.request('/api/auth/talkoo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.9' },
        body: JSON.stringify({ password: pw }),
      })

    for (let i = 0; i < 10; i++) {
      const r = await attempt('väärä')
      expect(r.status).toBe(401)
    }
    // 11. yritys (myös oikealla salasanalla) → lukittu
    const locked = await attempt(PW)
    expect(locked.status).toBe(429)
  })

  test('onnistuminen nollaa rate-limit-laskurin', async () => {
    seedTalkooPassword(db)
    const app = makeApp(db)
    const attempt = (pw: string) =>
      app.request('/api/auth/talkoo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.10' },
        body: JSON.stringify({ password: pw }),
      })
    for (let i = 0; i < 5; i++) await attempt('väärä')
    expect((await attempt(PW)).status).toBe(200) // onnistuu, nollaa
    for (let i = 0; i < 9; i++) expect((await attempt('väärä')).status).toBe(401) // ei vielä lukossa
  })

  // ── PUT /api/admin/settings/talkoo-password + GET /api/admin/settings ───────

  test('admin asettaa salasanan → GET settings talkooPasswordSet:true, login toimii', async () => {
    const app = makeApp(db)
    const put = await app.request('/api/admin/settings/talkoo-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'admin') },
      body: JSON.stringify({ password: 'uusisala' }),
    })
    expect(put.status).toBe(200)

    const get = await app.request('/api/admin/settings', { headers: authHeaders(db, 'admin') })
    expect(get.status).toBe(200)
    const gs = (await get.json()) as { talkooPassword: string; talkooPasswordSet: boolean }
    expect(gs.talkooPasswordSet).toBe(true)
    expect(gs.talkooPassword).toBe('uusisala')

    const login = await app.request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'uusisala' }),
    })
    expect(login.status).toBe(200)
  })

  test('admin vaihtaa salasanan → vanha ei enää kelpaa, uusi kelpaa', async () => {
    const app = makeApp(db)
    seedTalkooPassword(db, 'eka')
    await app.request('/api/admin/settings/talkoo-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'admin') },
      body: JSON.stringify({ password: 'toka' }),
    })
    const oldPw = await app.request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.11' },
      body: JSON.stringify({ password: 'eka' }),
    })
    expect(oldPw.status).toBe(401)
    const newPw = await app.request('/api/auth/talkoo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.12' },
      body: JSON.stringify({ password: 'toka' }),
    })
    expect(newPw.status).toBe(200)
  })

  test('järjestäjä ei saa asettaa salasanaa → 403', async () => {
    const res = await makeApp(db).request('/api/admin/settings/talkoo-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'järjestäjä') },
      body: JSON.stringify({ password: 'yritys' }),
    })
    expect(res.status).toBe(403)
  })

  test('liian lyhyt salasana → 400', async () => {
    const res = await makeApp(db).request('/api/admin/settings/talkoo-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'admin') },
      body: JSON.stringify({ password: 'ab' }),
    })
    expect(res.status).toBe(400)
  })

  test('GET /api/admin/settings palauttaa salasanan adminille (katsottava)', async () => {
    seedTalkooPassword(db)
    const res = await makeApp(db).request('/api/admin/settings', { headers: authHeaders(db, 'admin') })
    const body = (await res.json()) as { talkooPassword: string; talkooPasswordSet: boolean }
    expect(body.talkooPassword).toBe(PW)
    expect(body.talkooPasswordSet).toBe(true)
  })

  test('GET /api/admin/settings vaatii adminin → järjestäjä 403', async () => {
    const res = await makeApp(db).request('/api/admin/settings', { headers: authHeaders(db, 'järjestäjä') })
    expect(res.status).toBe(403)
  })
})
