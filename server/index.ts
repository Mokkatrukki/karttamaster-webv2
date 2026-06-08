import { Hono } from 'hono'
import { createDb, seedAdmin } from './db'
import { dbMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'

const db = createDb(process.env.DB_PATH)
seedAdmin(db)

const app = new Hono()
app.use('*', dbMiddleware(db))

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)
app.route('/api/admin', adminRoutes)

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
}

export { app, db }
