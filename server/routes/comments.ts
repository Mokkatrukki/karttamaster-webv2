import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

// T221/T75: yleiskäyttöinen kommentti. Kiinnitys merkkiin/pätkään/vapaaseen karttapisteeseen.
// Kuka tahansa autentikoitu voi kommentoida (VISION §Talkoolainen: "kuka tahansa voi lisätä
// kommentin mihin tahansa karttakohteeseen"). Poisto = järjestäjä+ (voi yliajaa kaiken).

interface CommentRow {
  id: string
  target_type: string
  target_id: string | null
  lat: number | null
  lon: number | null
  text: string
  icon_id: string | null
  author_name: string | null
  created_at: string
}

function rowToComment(row: CommentRow) {
  return {
    id: row.id,
    targetType: row.target_type as 'marker' | 'segment' | 'point',
    targetId: row.target_id ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    text: row.text,
    iconId: row.icon_id ?? undefined,
    authorName: row.author_name ?? undefined,
    createdAt: row.created_at,
  }
}

export const commentsRoutes = new Hono<AuthEnv>()

// GET /api/comments?targetType=&targetId= — kaikille autentikoiduille. Suodatus valinnainen.
commentsRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const targetType = c.req.query('targetType')
  const targetId = c.req.query('targetId')

  let rows: CommentRow[]
  if (targetType && targetId) {
    rows = db.query<CommentRow, [string, string]>(
      'SELECT * FROM comments WHERE target_type = ? AND target_id = ? ORDER BY created_at ASC',
    ).all(targetType, targetId)
  } else if (targetType) {
    rows = db.query<CommentRow, [string]>(
      'SELECT * FROM comments WHERE target_type = ? ORDER BY created_at ASC',
    ).all(targetType)
  } else {
    rows = db.query<CommentRow, []>('SELECT * FROM comments ORDER BY created_at ASC').all()
  }
  return c.json(rows.map(rowToComment))
})

// POST /api/comments — kaikille autentikoiduille (talkoolainen mukaan lukien, VISION).
commentsRoutes.post('/', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    targetType?: string
    targetId?: string
    lat?: number
    lon?: number
    text?: string
    iconId?: string
    authorName?: string
  }>()

  const validTypes = ['marker', 'segment', 'point']
  if (!body.targetType || !validTypes.includes(body.targetType)) {
    return c.json({ error: 'invalid_target_type' }, 400)
  }
  if (!body.text || body.text.trim() === '') {
    return c.json({ error: 'missing_text' }, 400)
  }
  // 'point' = vapaa karttapiste → koordinaatit pakolliset; 'marker'/'segment' → targetId pakollinen.
  if (body.targetType === 'point') {
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number') {
      return c.json({ error: 'missing_coordinates' }, 400)
    }
  } else if (!body.targetId) {
    return c.json({ error: 'missing_target_id' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO comments (id, target_type, target_id, lat, lon, text, icon_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      body.targetType,
      body.targetType === 'point' ? null : (body.targetId ?? null),
      body.lat ?? null,
      body.lon ?? null,
      body.text.trim(),
      body.iconId ?? null,
      body.authorName?.trim() || null,
      now,
    ],
  )

  const row = db.query<CommentRow, [string]>('SELECT * FROM comments WHERE id = ?').get(id)!
  return c.json(rowToComment(row), 201)
})

// DELETE /api/comments/:id — vain järjestäjä+ (voi yliajaa kaiken, VISION r283).
commentsRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const existing = db.query<{ id: string }, [string]>('SELECT id FROM comments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  db.run('DELETE FROM comments WHERE id = ?', [id])
  return c.json({ ok: true })
})
