import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

export const auditRoutes = new Hono<AuthEnv>()

interface AuditRow {
  id: string
  marker_id: string
  action: string
  actor: string | null
  actor_role: string
  segment_code: string | null
  created_at: string
  payload_json: string | null
}

function toJson(row: AuditRow) {
  return { ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null }
}

// GET /api/audit?segment_code=X — supervision-lista aikajärjestyksessä (T226/T227).
// Ilman segment_code:a → koko loki (admin/järjestäjä-yleiskatsaus).
auditRoutes.get('/', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const segmentCode = c.req.query('segment_code')
  const rows = segmentCode
    ? db.query<AuditRow, [string]>(
        'SELECT * FROM marker_audit WHERE UPPER(segment_code) = ? ORDER BY created_at ASC',
      ).all(segmentCode.toUpperCase())
    : db.query<AuditRow, []>('SELECT * FROM marker_audit ORDER BY created_at ASC').all()
  return c.json(rows.map(toJson))
})

// POST /api/audit/undo — massaperuutus (T227/V153). Atominen (kaikki/ei mitään).
// { segment_code, action, since? } → add=DELETE merkki, move/status=restore V152-payloadin ENNEN-tilasta.
// remove EI peruutettavissa (V153 ei kata). Interleaving-varaus V153: restoraa lokitetusta ennen-tilasta
// vaikka merkkiä olisi muokattu undo-ikkunan jälkeen.
auditRoutes.post('/undo', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ segment_code?: string; action?: string; since?: string }>()

  if (!body.segment_code || !body.action) return c.json({ error: 'missing_fields' }, 400)
  if (!['add', 'move', 'status'].includes(body.action)) {
    return c.json({ error: 'action_not_undoable' }, 400)
  }

  const rows = (body.since
    ? db.query<AuditRow, [string, string, string]>(
        'SELECT * FROM marker_audit WHERE UPPER(segment_code) = ? AND action = ? AND created_at >= ? ORDER BY created_at DESC',
      ).all(body.segment_code.toUpperCase(), body.action, body.since)
    : db.query<AuditRow, [string, string]>(
        'SELECT * FROM marker_audit WHERE UPPER(segment_code) = ? AND action = ? ORDER BY created_at DESC',
      ).all(body.segment_code.toUpperCase(), body.action))

  let undone = 0
  db.transaction(() => {
    for (const row of rows) {
      if (row.action === 'add') {
        db.run('DELETE FROM markers WHERE id = ?', [row.marker_id])
        undone++
      } else if (row.action === 'move' && row.payload_json) {
        const p = JSON.parse(row.payload_json) as { lat: number; lon: number; distance_from_start: number; route_ids: string[] }
        db.run(
          'UPDATE markers SET lat = ?, lon = ?, distance_from_start = ?, route_ids = ? WHERE id = ?',
          [p.lat, p.lon, p.distance_from_start, JSON.stringify(p.route_ids), row.marker_id],
        )
        undone++
      } else if (row.action === 'status' && row.payload_json) {
        const p = JSON.parse(row.payload_json) as { status: string }
        db.run('UPDATE markers SET status = ? WHERE id = ?', [p.status, row.marker_id])
        undone++
      }
    }
  })()

  return c.json({ ok: true, undone })
})
