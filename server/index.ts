import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { createDb, seedAdmin, gracefulClose } from './db'
import { dbMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { markersRoutes } from './routes/markers'
import { templatesRoutes } from './routes/templates'
import { segmentRoutes } from './routes/segments'
import { areasRoutes } from './routes/areas'
import { devfeedbackRoutes } from './routes/devfeedback'
import { gpkgRoutes } from './routes/gpkg'
import { cronRoutes } from './routes/cron'
import { scheduleNightlySnapshot } from './snapshot-scheduler'

const db = createDb(process.env.DB_PATH)
seedAdmin(db)
scheduleNightlySnapshot(db)

// V120/T188: fly `auto_stop_machines=stop` lähettää signaalin ennen VM-pysäytystä.
// Taita WAL main-tiedostoon + sulje ennen exitiä, ettei checkpointtaamaton data katoa.
let shuttingDown = false
function shutdown(): void {
  if (shuttingDown) return
  shuttingDown = true
  gracefulClose(db)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const app = new Hono()
app.use('*', dbMiddleware(db))

// B82/T182(c)-diagnostiikka: logaa mutatoivat /api-kirjoitukset statuksineen, jotta
// `fly logs` paljastaa MIKSI kirjoitus torjutaan tuotannossa: 201/200 = ok, 401 =
// sessio puuttuu/vanhentunut, 403 = rooli ei riitä. Ei bodyja eikä salaisuuksia.
app.use('/api/*', async (c, next) => {
  await next()
  const m = c.req.method
  if (m === 'POST' || m === 'PUT' || m === 'DELETE') {
    const sess = c.get('session') as { role?: string } | undefined
    const who = sess?.role ?? (getCookie(c, 'session') ? 'sessio-invalid' : 'ei-cookiea')
    console.log(`[api] ${m} ${c.req.path} -> ${c.res.status} (${who})`)
  }
})

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/markers', markersRoutes)
app.route('/api/templates', templatesRoutes)
app.route('/api/segments', segmentRoutes)
app.route('/api/areas', areasRoutes)
app.route('/api/devfeedback', devfeedbackRoutes)
app.route('/api/gpkg', gpkgRoutes)
app.route('/api/cron', cronRoutes)

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
}

export { app, db }
