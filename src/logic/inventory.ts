import { genId } from './uid'

/** Inventaariorivi (varastotavara, järjestäjä). v1: pelkkä inventointi.
 *  qty on numero (koneellinen) → v2-dekrementointi ilman migraatiota. */
export interface InventoryItem {
  id: string
  name: string
  qty: number
  unit: string | null
  location: string | null
  note: string | null
}

/** Raakasyöte lomakkeelta/verkosta — tyypit tuntemattomia ennen validointia. */
export interface InventoryInput {
  name?: unknown
  qty?: unknown
  unit?: unknown
  location?: unknown
  note?: unknown
}

/** Normalisoidut kentät (ilman id:tä) validoinnin jälkeen. */
export interface InventoryFields {
  name: string
  qty: number
  unit: string | null
  location: string | null
  note: string | null
}

export type InventoryError = 'name_required' | 'invalid_qty'

export type ValidationResult =
  | { ok: true; value: InventoryFields }
  | { ok: false; error: InventoryError }

function strOrNull(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const t = x.trim()
  return t.length ? t : null
}

/**
 * Validoi + normalisoi inventaariosyöte. Sama sääntö kuin backend (V161/V162) —
 * client-pre-validointi ennen POSTia. server/ ei importtaa tätä (arch-raja), vaan
 * peilaa saman logiikan; tämä on referenssi.
 *  - V161: name pakko (trimmattuna ei-tyhjä)
 *  - V162: qty äärellinen numero >= 0; puuttuva → 0; torjuu coercion ("5">=0), NaN, Infinity
 */
export function validateInventoryItem(input: InventoryInput): ValidationResult {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) return { ok: false, error: 'name_required' } // V161

  let qty = input.qty
  if (qty === undefined || qty === null) qty = 0
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'invalid_qty' } // V162
  }

  return {
    ok: true,
    value: { name, qty, unit: strOrNull(input.unit), location: strOrNull(input.location), note: strOrNull(input.note) },
  }
}

/** Rakenna validoitu InventoryItem paikallisella id:llä (optimistinen UI). genId = uid.ts (T238). */
export function buildInventoryItem(input: InventoryInput): { ok: true; item: InventoryItem } | { ok: false; error: InventoryError } {
  const res = validateInventoryItem(input)
  if (!res.ok) return res
  return { ok: true, item: { id: genId(), ...res.value } }
}
