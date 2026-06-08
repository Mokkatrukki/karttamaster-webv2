import { Hono } from 'hono'
import { createDb, seedAdmin } from './db'
import { dbMiddleware } from './middleware/auth'

const db = createDb(process.env.DB_PATH)
seedAdmin(db)

const app = new Hono()
app.use('*', dbMiddleware(db))

app.get('/api/health', (c) => c.json({ ok: true }))

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
}

export { app, db }
