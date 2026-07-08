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

  // ── T196/V123: template-kuvan lataus backendiin ──────────────────────────
  describe('POST /api/templates/:id/images', () => {
    test('järjestäjä lataa kuvan → 201 + url', async () => {
      const form = new FormData()
      form.append('image', makeUploadFile())
      const res = await makeApp(db).request('/api/templates/oikealle/images', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { url: string }
      expect(body.url).toMatch(/^\/api\/templates\/oikealle\/images\//)
    })

    test('ei vaadi että template-rivi on jo tallennettu (luonti-modaali)', async () => {
      const form = new FormData()
      form.append('image', makeUploadFile())
      // 'ei-viela-tallennettu'-id ei ole templates-taulussa → silti 201 (V97 käsin-id)
      const res = await makeApp(db).request('/api/templates/ei-viela-tallennettu/images', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(201)
    })

    test('talkoolainen → 403', async () => {
      const form = new FormData()
      form.append('image', makeUploadFile())
      const res = await makeApp(db).request('/api/templates/oikealle/images', {
        method: 'POST',
        headers: authHeaders(db, 'talkoolainen'),
        body: form,
      })
      expect(res.status).toBe(403)
    })

    test('ei-kuva tiedosto → 400', async () => {
      const form = new FormData()
      form.append('image', new File(['not an image'], 'note.txt', { type: 'text/plain' }))
      const res = await makeApp(db).request('/api/templates/oikealle/images', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/templates/:id/images/:imageId', () => {
    test('ladattu kuva haettavissa oikealla content-typellä', async () => {
      const form = new FormData()
      form.append('image', makeUploadFile())
      const uploadRes = await makeApp(db).request('/api/templates/oikealle/images', {
        method: 'POST',
        headers: authHeaders(db, 'järjestäjä'),
        body: form,
      })
      const { url } = (await uploadRes.json()) as { url: string }

      const res = await makeApp(db).request(url, { headers: authHeaders(db, 'talkoolainen') })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('image/jpeg')
      const bytes = new Uint8Array(await res.arrayBuffer())
      expect(bytes.length).toBe(4)
    })

    test('tuntematon imageId → 404', async () => {
      const res = await makeApp(db).request('/api/templates/oikealle/images/ei-ole', {
        headers: authHeaders(db, 'järjestäjä'),
      })
      expect(res.status).toBe(404)
    })
  })
})

function makeUploadFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'kuva.jpg', { type: 'image/jpeg' })
}
