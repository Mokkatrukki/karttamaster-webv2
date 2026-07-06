import type { Database } from 'bun:sqlite'
import { createSnapshot } from './snapshot-data'

function msUntilNext03UTC(): number {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0, 0))
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1)
  }
  return next.getTime() - now.getTime()
}

function takeNightlySnapshot(db: Database): void {
  try {
    // V100: koko dataset. Jaettu createSnapshot — ei duplikoitua serialisointia (B66).
    createSnapshot(db, `Yövarmuuskopio ${new Date().toISOString().slice(0, 10)}`, 'system', 'auto-yö')
  } catch (err) {
    console.error('[snapshot-scheduler] nightly snapshot failed:', err)
  }
}

/**
 * HUOM (V101/B67): in-process-ajastin on best-effort — se kuolee kun fly-kone
 * auto-stoppaa (auto_stop_machines=stop). Luotettava yökopio tulee ulkoisesta
 * cron-pingistä (T163, POST /api/cron/snapshot). Tämä jää toissijaiseksi.
 */
export function scheduleNightlySnapshot(db: Database): void {
  const ms = msUntilNext03UTC()
  setTimeout(() => {
    takeNightlySnapshot(db)
    setInterval(() => takeNightlySnapshot(db), 24 * 60 * 60 * 1000)
  }, ms)
}
