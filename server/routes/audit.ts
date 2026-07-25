import { Hono } from 'hono'
import { randomUUID } from 'crypto'
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
// T319: suodattimet actor/actor_role/since/until + limit. Pätkäkohtainen kutsu säilyy
// ASC-järjestyksessä (pätkämodaali renderöi vanhin→uusin); suodatettu/globaali haku palauttaa
// UUSIMMAT ensin ja leikkaa limitiin — koko taulun lataus ei skaalaa kasvavassa tapahtumassa.
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

auditRoutes.get('/', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const segmentCode = c.req.query('segment_code')
  const actor = c.req.query('actor')
  const actorRole = c.req.query('actor_role')
  const since = c.req.query('since')
  const until = c.req.query('until')
  const rawLimit = Number(c.req.query('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT

  const where: string[] = []
  const params: string[] = []
  if (segmentCode) { where.push('UPPER(segment_code) = ?'); params.push(segmentCode.toUpperCase()) }
  if (actor) { where.push('actor = ?'); params.push(actor) }
  if (actorRole) { where.push('actor_role = ?'); params.push(actorRole) }
  if (since) { where.push('created_at >= ?'); params.push(since) }
  if (until) { where.push('created_at <= ?'); params.push(until) }
  const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''

  // Pätkäkohtainen haku on olemassa olevan kuluttajan sopimus (T227) → ASC, ei limitiä.
  if (segmentCode && !actor && !actorRole && !since && !until) {
    const rows = db.query<AuditRow, string[]>(
      `SELECT * FROM marker_audit${clause} ORDER BY created_at ASC`,
    ).all(...params)
    return c.json(rows.map(toJson))
  }

  const rows = db.query<AuditRow, string[]>(
    `SELECT * FROM marker_audit${clause} ORDER BY created_at DESC LIMIT ${limit}`,
  ).all(...params)
  return c.json(rows.map(toJson))
})

// T318/V229: remove-payload sisältää koko merkkirivin → restore INSERTillä. Legacy-rivi (ennen
// T318:aa) kantaa vain otoksen ∴ ei palautettavissa — puolittainen merkki on pahempi kuin puuttuva.
const FULL_ROW_KEYS = ['type', 'lat', 'lon', 'distance_from_start', 'status', 'updated_at'] as const

function isFullMarkerRow(p: unknown): p is Record<string, unknown> {
  if (p == null || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return FULL_ROW_KEYS.every((k) => k in o)
}

// POST /api/audit/undo/:auditId — YHDEN rivin peruutus (T319/V230). Lokinäkymän "Peru tämä".
// Strategia actionin mukaan: add→DELETE, move/status→UPDATE ennen-tilasta, remove→INSERT.
// Peruutus kirjautuu itsekin audit-riviksi ∴ peruutuskin on peruttavissa (sama sopimus kuin
// scripts/restore-marker-moves.ts). Atominen: kaikki tai ei mitään (V100/V153-linja).
auditRoutes.post('/undo/:auditId', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const session = c.get('session')
  const auditId = c.req.param('auditId')

  const row = db.query<AuditRow & { undone_at: string | null }, [string]>(
    'SELECT * FROM marker_audit WHERE id = ?',
  ).get(auditId)
  if (!row) return c.json({ error: 'not_found' }, 404)
  if (row.undone_at) return c.json({ error: 'already_undone' }, 409)

  const payload = row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : null
  const marker = db.query<Record<string, unknown>, [string]>(
    'SELECT * FROM markers WHERE id = ?',
  ).get(row.marker_id)

  // Merkki kadonnut välissä → mitään ei ole mitä palauttaa (paitsi removelle, joka luo sen uudelleen).
  if (!marker && row.action !== 'remove') return c.json({ error: 'marker_gone' }, 404)
  if (marker && row.action === 'remove') return c.json({ error: 'marker_exists' }, 409)
  if (row.action !== 'add' && !payload) return c.json({ error: 'not_undoable' }, 400)
  if (row.action === 'remove' && !isFullMarkerRow(payload)) return c.json({ error: 'not_undoable' }, 400)

  const now = new Date().toISOString()

  db.transaction(() => {
    // Palautuksen ENNEN-tila = nykyinen tila (removella ei tilaa: merkkiä ei ole).
    let undoPayload: unknown = marker ? { ...marker } : null

    if (row.action === 'add') {
      db.run('DELETE FROM markers WHERE id = ?', [row.marker_id])
    } else if (row.action === 'move') {
      const p = payload as { lat: number; lon: number; distance_from_start: number; route_ids: string[] }
      db.run(
        'UPDATE markers SET lat = ?, lon = ?, distance_from_start = ?, route_ids = ?, distance_by_route = NULL, updated_at = ?, updated_by = ? WHERE id = ?',
        [p.lat, p.lon, p.distance_from_start, JSON.stringify(p.route_ids), now, session.display_name, row.marker_id],
      )
    } else if (row.action === 'status') {
      const p = payload as { status: string }
      db.run('UPDATE markers SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [p.status, now, session.display_name, row.marker_id])
    } else {
      // remove → INSERT alkuperäisellä id:llä ∴ linked_marker_ids-viittaukset ja kuvat eivät jää orvoiksi.
      const p = payload as Record<string, unknown>
      const cols = Object.keys(p).filter((k) => k !== 'id')
      const vals = cols.map((k) => (k === 'route_ids' && Array.isArray(p[k]) ? JSON.stringify(p[k]) : p[k]))
      db.run(
        `INSERT INTO markers (id, ${cols.join(', ')}) VALUES (${['?', ...cols.map(() => '?')].join(', ')})`,
        [row.marker_id, ...(vals as (string | number | null)[])],
      )
      undoPayload = null
    }

    db.run('UPDATE marker_audit SET undone_at = ? WHERE id = ?', [now, auditId])
    // Peruutuksen jälki: käänteisaktio samalla merkillä. add↔remove, move/status säilyttävät actionin.
    const undoAction = row.action === 'add' ? 'remove' : row.action === 'remove' ? 'add' : row.action
    db.run(
      'INSERT INTO marker_audit (id, marker_id, action, actor, actor_role, segment_code, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        row.marker_id,
        undoAction,
        session.display_name,
        session.role,
        row.segment_code,
        now,
        undoPayload != null ? JSON.stringify(undoPayload) : null,
      ],
    )
  })()

  return c.json({ ok: true, action: row.action })
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
