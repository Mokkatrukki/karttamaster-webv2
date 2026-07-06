import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { cronRoutes } from './routes/cron'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/cron', cronRoutes)
  return app
}

describe('T163: cron snapshot endpoint (V101)', () => {
  let db: Database
  let app: ReturnType<typeof makeApp>
  const TOKEN = 'test-cron-token-abc'

  beforeEach(() => {
    process.env.SNAPSHOT_CRON_TOKEN = TOKEN
    db = createDb(':memory:')
    app = makeApp(db)
  })

  afterEach(() => {
    delete process.env.SNAPSHOT_CRON_TOKEN
    db.close()
  })

  function snapCount(): number {
    return db.query<{ n: number }, []>('SELECT COUNT(*) as n FROM snapshots').get()!.n
  }

  test('oikea token → 201 + snapshot syntyy', async () => {
    const res = await app.request('/api/cron/snapshot', {
      method: 'POST',
      headers: { 'X-Cron-Token': TOKEN },
    })
    expect(res.status).toBe(201)
    expect(snapCount()).toBe(1)
    expect(db.query<{ trigger: string }, []>('SELECT trigger FROM snapshots').get()!.trigger).toBe('auto-yö')
  })

  test('väärä token → 401, ei snapshottia', async () => {
    const res = await app.request('/api/cron/snapshot', {
      method: 'POST',
      headers: { 'X-Cron-Token': 'vaara' },
    })
    expect(res.status).toBe(401)
    expect(snapCount()).toBe(0)
  })

  test('puuttuva token → 401', async () => {
    const res = await app.request('/api/cron/snapshot', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(snapCount()).toBe(0)
  })

  test('env asettamatta → 401 (fail closed)', async () => {
    delete process.env.SNAPSHOT_CRON_TOKEN
    const res = await app.request('/api/cron/snapshot', {
      method: 'POST',
      headers: { 'X-Cron-Token': TOKEN },
    })
    expect(res.status).toBe(401)
    expect(snapCount()).toBe(0)
  })
})
