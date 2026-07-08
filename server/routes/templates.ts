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
