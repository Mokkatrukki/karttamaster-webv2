import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type { SessionData } from '../types'

export const inventoryRoutes = new Hono<AuthEnv>()

// ── Auth: KAIKKI routet requireAuth() ENNEN requireRole (V163). Talkoolainen → 403.
const guard = [requireAuth(), requireRole('admin', 'järjestäjä')] as const

export interface InventoryItem {
  id: string
  name: string
  qty: number
  unit: string | null
  location: string | null
  location_id: string | null
  template_id: string | null
  /** V279: 1 = tarvike, LOPULLINEN tila — ⊥ saa koskaan template_id:tä, ⊥ näy yhdistämislistalla. */
  not_sign: number
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InventoryLocation {
  id: string
  name: string
  sort_order: number
  created_at: string
}

type InventoryInput = {
  name?: unknown
  qty?: unknown
  unit?: unknown
  note?: unknown
  location_id?: unknown
  template_id?: unknown
  not_sign?: unknown
}

type ValidatedItem = {
  name: string
  qty: number
  unit: string | null
  note: string | null
  location_id: string | null
  template_id: string | null
  not_sign: 0 | 1
}

function strOrNull(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const t = x.trim()
  return t.length ? t : null
}

/**
 * Backend-auktoritatiivinen validointi (V161 name, V162 qty, V165 merkki-snapshot).
 * server/ ⊥ importtaa src/logic/ (arch-raja) → peilaa säännön.
 *  - Merkkirivi (template_id): nimeä ei vaadita clientiltä; name = template.label snapshot
 *    (V165-fallback näyttää viimeksi tiedetyn nimen jos template poistetaan). template puuttuu → 400.
 *  - Tarvike (ei template_id): name pakko (V161).
 *  - qty äärellinen numero >= 0 (V162).
 */
function validate(db: Database, body: InventoryInput): { ok: true; v: ValidatedItem } | { ok: false; error: string } {
  const templateId = strOrNull(body.template_id)

  // V279: tarvike ⊥ saa koskaan template_id:tä. Ristiriita on datavirhe ⊥ tulkintakysymys
  // ∴ torjutaan backendissä — muuten rivi olisi yhtä aikaa "ei merkki" ja "tämä merkki".
  const notSign = body.not_sign === true || body.not_sign === 1 ? 1 : 0
  if (notSign === 1 && templateId) return { ok: false, error: 'not_sign_with_template' }

  let name: string
  if (templateId) {
    const tpl = db.query<{ label: string }, [string]>('SELECT label FROM templates WHERE id = ?').get(templateId)
    if (!tpl) return { ok: false, error: 'template_not_found' }
    name = tpl.label // V165: denormalisoi snapshot; UI resolvoi elävän labelin templatesista
  } else {
    name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { ok: false, error: 'name_required' } // V161 (vain tarvikkeelle)
  }

  // qty valinnainen → default 0; jos annettu, äärellinen numero >= 0 (V162). Torjuu "5">=0 + NaN/Infinity.
  let qty = body.qty
  if (qty === undefined || qty === null) qty = 0
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'invalid_qty' } // V162
  }

  // V186: kiinnitystapa (keppi/irto) POISTETTU — ei enää luku/kirjoitus (DB-sarake orpo).
  return {
    ok: true,
    v: { name, qty, unit: strOrNull(body.unit), note: strOrNull(body.note), location_id: strOrNull(body.location_id), template_id: templateId, not_sign: notSign },
  }
}

function getItem(db: Database, id: string): InventoryItem | null {
  return db.query<InventoryItem, [string]>('SELECT * FROM inventory_items WHERE id = ?').get(id) ?? null
}

function getLocation(db: Database, id: string): InventoryLocation | null {
  return db.query<InventoryLocation, [string]>('SELECT * FROM inventory_locations WHERE id = ?').get(id) ?? null
}

// ── Paikat (inventory_locations) — MÄÄRITÄ ENNEN /:id-routeja (staattinen segmentti) ─────────────

inventoryRoutes.get('/locations', ...guard, (c) => {
  const db: Database = c.get('db')
  const rows = db
    .query<InventoryLocation, []>('SELECT * FROM inventory_locations ORDER BY sort_order ASC, created_at ASC')
    .all()
  return c.json(rows)
})

inventoryRoutes.post('/locations', ...guard, async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ name?: unknown; sort_order?: unknown }>().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'name_required' }, 400)
  const sortOrder = typeof body.sort_order === 'number' && Number.isFinite(body.sort_order) ? body.sort_order : 0
  const id = randomUUID()
  db.run('INSERT INTO inventory_locations (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)', [
    id,
    name,
    sortOrder,
    new Date().toISOString(),
  ])
  return c.json(getLocation(db, id), 201)
})

inventoryRoutes.put('/locations/:id', ...guard, async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: unknown; sort_order?: unknown }>().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'name_required' }, 400)
  const sortOrder = typeof body.sort_order === 'number' && Number.isFinite(body.sort_order) ? body.sort_order : 0
  const result = db.run('UPDATE inventory_locations SET name = ?, sort_order = ? WHERE id = ?', [name, sortOrder, id])
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json(getLocation(db, id))
})

inventoryRoutes.delete('/locations/:id', ...guard, (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const loc = getLocation(db, id)
  if (!loc) return c.json({ error: 'not_found' }, 404)
  // V166: paikan poisto nullaa sen itemien location_id — itemeja EI kadoteta, EI kaskadipoistoa.
  db.run('UPDATE inventory_items SET location_id = NULL WHERE location_id = ?', [id])
  db.run('DELETE FROM inventory_locations WHERE id = ?', [id])
  return c.json({ ok: true })
})

// ── Tavarat (inventory_items) ────────────────────────────────────────────────

inventoryRoutes.get('/', ...guard, (c) => {
  const db: Database = c.get('db')
  const locationId = c.req.query('location_id')
  let items: InventoryItem[]
  if (locationId === 'none') {
    items = db.query<InventoryItem, []>('SELECT * FROM inventory_items WHERE location_id IS NULL ORDER BY created_at ASC').all()
  } else if (locationId) {
    items = db
      .query<InventoryItem, [string]>('SELECT * FROM inventory_items WHERE location_id = ? ORDER BY created_at ASC')
      .all(locationId)
  } else {
    items = db.query<InventoryItem, []>('SELECT * FROM inventory_items ORDER BY created_at ASC').all()
  }
  return c.json(items)
})

inventoryRoutes.post('/', ...guard, async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<InventoryInput>().catch(() => ({}) as InventoryInput)
  const res = validate(db, body)
  if (!res.ok) return c.json({ error: res.error }, res.error === 'template_not_found' ? 404 : 400)

  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO inventory_items (id, name, qty, unit, note, location_id, template_id, not_sign, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, res.v.name, res.v.qty, res.v.unit, res.v.note, res.v.location_id, res.v.template_id, res.v.not_sign, session.display_name ?? null, now, now],
  )
  return c.json(getItem(db, id), 201)
})

/**
 * T385/V279: kahden aidon duplikaattirivin yhdistäminen — summaa source targettiin & poistaa sourcen.
 * MÄÄRITELTÄVÄ ENNEN /:id-routeja (staattinen segmentti voittaa parametrin).
 *
 * PAIKKA ON MERKITSEVÄ: eri `location_id` ⇒ 400. Tuotannossa "26 asteen nousu" elää sekä Kärryssä
 * ETTÄ Kelkkavarastossa & ne ⊥ ole duplikaatteja vaan kaksi eri kasaa ∴ ne ⊥ saa summautua vahingossa.
 * Aidot duplikaatit joita tämä palvelee: "Kapeneva tie, kolmio"×2 samassa paikassa.
 */
inventoryRoutes.post('/merge', ...guard, async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ sourceId?: unknown; targetId?: unknown }>().catch(() => ({}))
  const sourceId = strOrNull(body.sourceId)
  const targetId = strOrNull(body.targetId)
  if (!sourceId || !targetId) return c.json({ error: 'ids_required' }, 400)
  if (sourceId === targetId) return c.json({ error: 'same_item' }, 400)

  const source = getItem(db, sourceId)
  const target = getItem(db, targetId)
  if (!source || !target) return c.json({ error: 'not_found' }, 404)
  if (source.location_id !== target.location_id) return c.json({ error: 'location_mismatch' }, 400)

  const now = new Date().toISOString()
  db.transaction(() => {
    db.run('UPDATE inventory_items SET qty = ?, updated_at = ? WHERE id = ?', [target.qty + source.qty, now, targetId])
    db.run('DELETE FROM inventory_items WHERE id = ?', [sourceId])
  })()
  return c.json(getItem(db, targetId))
})

inventoryRoutes.put('/:id', ...guard, async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json<InventoryInput>().catch(() => ({}) as InventoryInput)
  const res = validate(db, body)
  if (!res.ok) return c.json({ error: res.error }, res.error === 'template_not_found' ? 404 : 400)

  const now = new Date().toISOString()
  const result = db.run(
    'UPDATE inventory_items SET name = ?, qty = ?, unit = ?, note = ?, location_id = ?, template_id = ?, not_sign = ?, updated_at = ? WHERE id = ?',
    [res.v.name, res.v.qty, res.v.unit, res.v.note, res.v.location_id, res.v.template_id, res.v.not_sign, now, id],
  )
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json(getItem(db, id))
})

inventoryRoutes.delete('/:id', ...guard, (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  // V165: inventaariorivin poisto ⊥ koske templates-tauluun (unlink, ei kaskadi).
  const result = db.run('DELETE FROM inventory_items WHERE id = ?', [id])
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})
