import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { templatesRoutes } from './routes/templates'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/templates', templatesRoutes)
  return app
}

interface TemplateJson {
  id: string
  label: string
  color: string
  description: string
  favorite: boolean
  iconId?: string
  imageId?: string
  parts?: { iconId?: string; imageId?: string }[]
}

const TEMPLATE_BODY = {
  id: 'oikealle',
  label: 'Oikealle',
  color: '#ff0000',
  description: 'Käänny oikealle',
  favorite: true,
  iconId: 'arrow-right',
}

async function seedTemplate(db: Database, body: object = TEMPLATE_BODY): Promise<string> {
  const app = makeApp(db)
  const res = await app.request('/api/templates', {
    method: 'POST',
    headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as TemplateJson
  return json.id
}

describe('T192: Templates REST API', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  afterEach(() => db.close())

  // ── GET /api/templates ───────────────────────────────────────────────────
  describe('GET /api/templates', () => {
    test('unauthenticated → 401', async () => {
      const res = await makeApp(db).request('/api/templates')
      expect(res.status).toBe(401)
    })

    test('V123: kaikki autentikoidut roolit näkevät kirjaston', async () => {
      await seedTemplate(db)
      for (const role of ['admin', 'järjestäjä', 'talkoolainen'] as const) {
        const res = await makeApp(db).request('/api/templates', { headers: authHeaders(db, role) })
        expect(res.status).toBe(200)
        const list = (await res.json()) as TemplateJson[]
        expect(list.length).toBe(1)
        expect(list[0].id).toBe('oikealle')
      }
    })

    test('järjestetty label-aakkosjärjestykseen', async () => {
      await seedTemplate(db, { ...TEMPLATE_BODY, id: 'b', label: 'Beta' })
      await seedTemplate(db, { ...TEMPLATE_BODY, id: 'a', label: 'Alfa' })
      const res = await makeApp(db).request('/api/templates', { headers: authHeaders(db, 'järjestäjä') })
      const list = (await res.json()) as TemplateJson[]
      expect(list.map((t) => t.label)).toEqual(['Alfa', 'Beta'])
    })
  })

  // ── POST /api/templates ──────────────────────────────────────────────────
  describe('POST /api/templates', () => {
    test('järjestäjä → 201 + palauttaa mallin', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/templates', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify(TEMPLATE_BODY),
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as TemplateJson
      expect(json.label).toBe('Oikealle')
      expect(json.favorite).toBe(true)
      expect(json.iconId).toBe('arrow-right')
    })

    test('talkoolainen → 403', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/templates', {
        method: 'POST',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify(TEMPLATE_BODY),
      })
      expect(res.status).toBe(403)
    })

    test('puuttuva label/color → 400', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/templates', {
        method: 'POST',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', color: '#000' }),
      })
      expect(res.status).toBe(400)
    })

    test('parts_json roundtrip (yhdistelmämerkki)', async () => {
      const parts = [{ iconId: 'arrow-up' }, { imageId: 'wc' }]
      await seedTemplate(db, { ...TEMPLATE_BODY, id: 'combo', parts })
      const res = await makeApp(db).request('/api/templates', { headers: authHeaders(db, 'järjestäjä') })
      const list = (await res.json()) as TemplateJson[]
      expect(list[0].parts).toEqual(parts)
    })
  })

  // ── PUT /api/templates/:id ───────────────────────────────────────────────
  describe('PUT /api/templates/:id', () => {
    test('järjestäjä korvaa mallin', async () => {
      const id = await seedTemplate(db)
      const app = makeApp(db)
      const res = await app.request(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Vasemmalle', color: '#00ff00', favorite: false }),
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as TemplateJson
      expect(json.label).toBe('Vasemmalle')
      expect(json.favorite).toBe(false)
      expect(json.iconId).toBeUndefined()
    })

    test('tuntematon id → 404', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/templates/puuttuu', {
        method: 'PUT',
        headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'X', color: '#000' }),
      })
      expect(res.status).toBe(404)
    })

    test('talkoolainen → 403', async () => {
      const id = await seedTemplate(db)
      const app = makeApp(db)
      const res = await app.request(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(db, 'talkoolainen'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'X', color: '#000' }),
      })
      expect(res.status).toBe(403)
    })
  })

  // ── DELETE /api/templates/:id ────────────────────────────────────────────
  describe('DELETE /api/templates/:id', () => {
    test('järjestäjä poistaa', async () => {
      const id = await seedTemplate(db)
      const app = makeApp(db)
      const res = await app.request(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(200)
      const list = (await makeApp(db)
        .request('/api/templates', { headers: authHeaders(db, 'järjestäjä') })
        .then((r) => r.json())) as TemplateJson[]
      expect(list.length).toBe(0)
    })

    test('talkoolainen → 403', async () => {
      const id = await seedTemplate(db)
      const app = makeApp(db)
      const res = await app.request(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: authHeaders(db, 'talkoolainen'),
      })
      expect(res.status).toBe(403)
    })

    test('tuntematon id → 404', async () => {
      const app = makeApp(db)
      const res = await app.request('/api/templates/puuttuu', {
        method: 'DELETE',
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })
  })
})
