import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'

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
    const markers = db.query('SELECT * FROM markers').all()
    const label = `Yövarmuuskopio ${new Date().toISOString().slice(0, 10)}`
    db.run(
      'INSERT INTO snapshots (id, label, markers_json, created_at, created_by, trigger) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), label, JSON.stringify(markers), new Date().toISOString(), 'system', 'auto-yö'],
    )
    db.run(`
      DELETE FROM snapshots WHERE rowid NOT IN (
        SELECT rowid FROM snapshots ORDER BY rowid DESC LIMIT 20
      )
    `)
  } catch (err) {
    console.error('[snapshot-scheduler] nightly snapshot failed:', err)
  }
}

export function scheduleNightlySnapshot(db: Database): void {
  const ms = msUntilNext03UTC()
  setTimeout(() => {
    takeNightlySnapshot(db)
    setInterval(() => takeNightlySnapshot(db), 24 * 60 * 60 * 1000)
  }, ms)
}
