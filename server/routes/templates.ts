import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import type { SessionData } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'

export const templatesRoutes = new Hono<AuthEnv>()

interface TemplateRow {
  id: string
  label: string
  color: string
  description: string | null
  favorite: number
  icon_id: string | null
  image_id: string | null
  parts_json: string | null
  updated_at: string
  updated_by: string | null
}

interface SignPart {
  iconId?: string
  imageId?: string
}

// rowToTemplate: snake_case DB-rivi → client SignTemplate (camelCase, favorite:boolean, parts:array).
// V123: wire-formaatti on suoraan SignTemplate jotta template-sync (T193) voi POSTata mallin sellaisenaan.
function rowToTemplate(row: TemplateRow) {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    description: row.description ?? '',
    favorite: row.favorite === 1,
    // V17x: keppi POISTETTU mallista — kiinnitystapa elää inventaariorivillä (inventory_items.keppi).
    // DB-sarake templates.keppi jää orvoksi (SQLite-DROP välttää), API ei lue/kirjoita sitä.
    iconId: row.icon_id ?? undefined,
    imageId: row.image_id ?? undefined,
    parts: row.parts_json ? (JSON.parse(row.parts_json) as SignPart[]) : undefined,
  }
}

interface TemplateBody {
  id?: string
  label?: string
  color?: string
  description?: string | null
  favorite?: boolean
  iconId?: string | null
  imageId?: string | null
  parts?: SignPart[] | null
}

// GET /api/templates — V123: kaikki autentikoidut käyttäjät näkevät koko kirjaston (kuten V18 merkeille)
templatesRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<TemplateRow, []>('SELECT * FROM templates ORDER BY label ASC').all()
  return c.json(rows.map(rowToTemplate))
})

// POST /api/templates — järjestäjä+
templatesRoutes.post('/', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<TemplateBody>()

  if (body.label === undefined || body.color === undefined) {
    return c.json({ error: 'missing_fields' }, 400)
  }

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO templates (id, label, color, description, favorite, icon_id, image_id, parts_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      body.label,
      body.color,
      body.description ?? null,
      body.favorite ? 1 : 0,
      body.iconId ?? null,
      body.imageId ?? null,
      body.parts ? JSON.stringify(body.parts) : null,
      now,
      session.display_name ?? null,
    ],
  )

  const row = db.query<TemplateRow, [string]>('SELECT * FROM templates WHERE id = ?').get(id)!
  return c.json(rowToTemplate(row), 201)
})

// PUT /api/templates/:id — järjestäjä+, korvaa koko mallin (client lähettää täyden SignTemplaten)
templatesRoutes.put('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM templates WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const body = await c.req.json<TemplateBody>()
  if (body.label === undefined || body.color === undefined) {
    return c.json({ error: 'missing_fields' }, 400)
  }

  db.run(
    'UPDATE templates SET label = ?, color = ?, description = ?, favorite = ?, icon_id = ?, image_id = ?, parts_json = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    [
      body.label,
      body.color,
      body.description ?? null,
      body.favorite ? 1 : 0,
      body.iconId ?? null,
      body.imageId ?? null,
      body.parts ? JSON.stringify(body.parts) : null,
      new Date().toISOString(),
      session.display_name ?? null,
      id,
    ],
  )

  const updated = db.query<TemplateRow, [string]>('SELECT * FROM templates WHERE id = ?').get(id)!
  return c.json(rowToTemplate(updated))
})

// DELETE /api/templates/:id — järjestäjä+
templatesRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM templates WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  db.run('DELETE FROM templates WHERE id = ?', [id])
  return c.json({ ok: true })
})

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// POST /api/templates/:id/images — järjestäjä+ lataa oman kuvan mallille (multipart, field "image").
// T196/V123: EI vaadi että template-rivi on jo tallennettu — :id on käsin annettu (V97) ja kuva
// ladataan usein luonti-modaalissa ennen mallin tallennusta. Palauttaa URL:n joka tallentuu
// template.imageId:hin → jaetaan kaikille backendin kautta (ratkaisee tuplakuvat/bundle-riippuvuuden).
templatesRoutes.post('/:id/images', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')

  const body = await c.req.parseBody()
  const file = body.image
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400)
  if (file.size > MAX_IMAGE_BYTES) return c.json({ error: 'file_too_large' }, 413)
  if (!file.type.startsWith('image/')) return c.json({ error: 'invalid_type' }, 400)

  const imageId = randomUUID()
  const data = Buffer.from(await file.arrayBuffer())
  db.run(
    'INSERT INTO template_images (id, template_id, content_type, data, created_at) VALUES (?, ?, ?, ?, ?)',
    [imageId, id, file.type, data, new Date().toISOString()],
  )

  return c.json({ url: `/api/templates/${id}/images/${imageId}` }, 201)
})

// GET /api/templates/:id/images/:imageId — kaikki autentikoidut käyttäjät (readonly kuva)
templatesRoutes.get('/:id/images/:imageId', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const imageId = c.req.param('imageId')

  const row = db
    .query<{ content_type: string; data: Uint8Array }, [string, string]>(
      'SELECT content_type, data FROM template_images WHERE id = ? AND template_id = ?',
    )
    .get(imageId, id)
  if (!row) return c.json({ error: 'not_found' }, 404)

  return new Response(row.data, { headers: { 'Content-Type': row.content_type } })
})
