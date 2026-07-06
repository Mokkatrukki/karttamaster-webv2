import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { createSnapshot } from '../snapshot-data'

export const cronRoutes = new Hono<AuthEnv>()

/**
 * POST /api/cron/snapshot — ulkoinen ajastin (GitHub Action) laukaisee yökopion.
 * V101: automaattikopio ⊥ riipu user-trafiikista. In-process setInterval kuolee
 * kun fly-kone auto-stoppaa; tämä endpoint herättää koneen (auto_start_machines).
 * Suojattu jaetulla salaisuudella (env), EI session-auth — cron ei kirjaudu.
 * Token puuttuu/väärä → 401, ei snapshottia. Fail closed jos env asettamatta.
 */
cronRoutes.post('/snapshot', (c) => {
  const token = process.env.SNAPSHOT_CRON_TOKEN
  const header = c.req.header('X-Cron-Token')
  if (!token || !header || header !== token) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const db: Database = c.get('db')
  createSnapshot(db, `Yövarmuuskopio ${new Date().toISOString().slice(0, 10)}`, 'system', 'auto-yö')
  return c.json({ ok: true }, 201)
})
