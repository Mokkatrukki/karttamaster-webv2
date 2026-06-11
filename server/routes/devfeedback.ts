import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { AuthEnv } from '../middleware/auth'

const router = new Hono<AuthEnv>()

router.get('/', (c) => {
  const db = c.get('db')
  const status = c.req.query('status')

  const rows = status
    ? db.query('SELECT * FROM devfeedback WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.query('SELECT * FROM devfeedback ORDER BY created_at DESC').all()

  const items = (rows as Record<string, unknown>[]).map(row => ({
    ...row,
    session_path: JSON.parse((row.session_path as string) || '[]'),
  }))

  return c.json(items)
})

router.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const id = randomUUID()
  db.run(
    `INSERT INTO devfeedback
      (id, tag, description, dom_path, element_html, page_url, session_path, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'avoin', ?)`,
    [
      id,
      body.tag,
      body.description,
      body.dom_path ?? null,
      body.element_html ?? null,
      body.page_url,
      JSON.stringify(body.session_path ?? []),
      new Date().toISOString(),
    ]
  )

  return c.json({ id }, 201)
})

router.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json()

  db.run('UPDATE devfeedback SET status = ? WHERE id = ?', [body.status, id])

  return c.json({ ok: true })
})

export { router as devfeedbackRoutes }
