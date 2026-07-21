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
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type InventoryInput = {
  name?: unknown
  qty?: unknown
  unit?: unknown
  location?: unknown
  note?: unknown
}

type ValidatedInput = { name: string; qty: number; unit: string | null; location: string | null; note: string | null }

/** Backend-auktoritatiivinen validointi (V161 name, V162 qty). server/ ⊥ importtaa src/logic/. */
function validate(body: InventoryInput): { ok: true; v: ValidatedInput } | { ok: false; error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { ok: false, error: 'name_required' } // V161

  // qty valinnainen syötössä → default 0; jos annettu, oltava äärellinen numero >= 0 (V162).
  // Torjuu coercion-reiän ("5" >= 0 === true) sekä NaN/Infinity.
  let qty = body.qty
  if (qty === undefined || qty === null) qty = 0
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'invalid_qty' } // V162
  }

  return {
    ok: true,
    v: { name, qty, unit: strOrNull(body.unit), location: strOrNull(body.location), note: strOrNull(body.note) },
  }
}

function strOrNull(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const t = x.trim()
  return t.length ? t : null
}

function getRow(db: Database, id: string): InventoryItem | null {
  return db.query<InventoryItem, [string]>('SELECT * FROM inventory_items WHERE id = ?').get(id) ?? null
}

inventoryRoutes.get('/', ...guard, (c) => {
  const db: Database = c.get('db')
  const items = db.query<InventoryItem, []>('SELECT * FROM inventory_items ORDER BY created_at ASC').all()
  return c.json(items)
})

inventoryRoutes.post('/', ...guard, async (c) => {
  const db: Database = c.get('db')
  const session: SessionData = c.get('session')
  const body = await c.req.json<InventoryInput>().catch(() => ({}) as InventoryInput)
  const res = validate(body)
  if (!res.ok) return c.json({ error: res.error }, 400)

  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO inventory_items (id, name, qty, unit, location, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, res.v.name, res.v.qty, res.v.unit, res.v.location, res.v.note, session.display_name ?? null, now, now],
  )
  return c.json(getRow(db, id), 201)
})

inventoryRoutes.put('/:id', ...guard, async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json<InventoryInput>().catch(() => ({}) as InventoryInput)
  const res = validate(body)
  if (!res.ok) return c.json({ error: res.error }, 400)

  const now = new Date().toISOString()
  const result = db.run(
    'UPDATE inventory_items SET name = ?, qty = ?, unit = ?, location = ?, note = ?, updated_at = ? WHERE id = ?',
    [res.v.name, res.v.qty, res.v.unit, res.v.location, res.v.note, now, id],
  )
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json(getRow(db, id))
})

inventoryRoutes.delete('/:id', ...guard, (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const result = db.run('DELETE FROM inventory_items WHERE id = ?', [id])
  if (result.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})
