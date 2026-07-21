import { genId } from './uid'
import { signDisplayLabel } from './sign-library'

/** Inventaariorivi (varastotavara, järjestäjä). v2: kuuluu paikkaan (locationId) ja voi olla
 *  merkki (templateId → merkkikirjaston malli, elävä V165). qty koneellinen. */
export interface InventoryItem {
  id: string
  name: string
  qty: number
  unit: string | null
  location: string | null
  note: string | null
  // v2 (T244): valinnaiset — additiivinen, ei riko v1-käyttöä
  locationId?: string | null
  templateId?: string | null
}

/** Paikka (säiliö): Kärry, Varasto… (T243 inventory_locations). */
export interface InventoryLocation {
  id: string
  name: string
  sortOrder: number
}

/** Raakasyöte lomakkeelta/verkosta — tyypit tuntemattomia ennen validointia. */
export interface InventoryInput {
  name?: unknown
  qty?: unknown
  unit?: unknown
  location?: unknown
  note?: unknown
  locationId?: unknown
  templateId?: unknown
}

/** Normalisoidut kentät (ilman id:tä) validoinnin jälkeen. */
export interface InventoryFields {
  name: string
  qty: number
  unit: string | null
  location: string | null
  note: string | null
  locationId: string | null
  templateId: string | null
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
 * Validoi + normalisoi inventaariosyöte. Sama sääntö kuin backend (V161/V162/V165) —
 * client-pre-validointi ennen POSTia. server/ ei importtaa tätä (arch-raja), vaan
 * peilaa saman logiikan; tämä on referenssi.
 *  - V161: name pakko VAIN jos templateId puuttuu (tarvike). Merkkirivi (templateId) → nimi templatesista.
 *  - V162: qty äärellinen numero >= 0; puuttuva → 0; torjuu coercion ("5">=0), NaN, Infinity
 */
export function validateInventoryItem(input: InventoryInput): ValidationResult {
  const templateId = strOrNull(input.templateId)
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!templateId && !name) return { ok: false, error: 'name_required' } // V161 (vain tarvikkeelle)

  let qty = input.qty
  if (qty === undefined || qty === null) qty = 0
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'invalid_qty' } // V162
  }

  return {
    ok: true,
    value: {
      name,
      qty,
      unit: strOrNull(input.unit),
      location: strOrNull(input.location),
      note: strOrNull(input.note),
      locationId: strOrNull(input.locationId),
      templateId,
    },
  }
}

/**
 * Näyttönimi (V165): merkkirivi (templateId) → elävä template.label templatesista;
 * template puuttuu → fallback item.name ?? '(poistettu merkki)'. Tarvike → item.name.
 * V186: ei enää keppi-suffixia — pelkkä label.
 */
export function resolveItemName(
  item: { name: string | null; templateId?: string | null },
  // Rakenteellinen — käy Map<string,{label}> JA Map<string,SignTemplate> (T247, invarianssin ohitus).
  templates: { get(id: string): { label: string } | undefined },
): string {
  if (item.templateId) {
    const tpl = templates.get(item.templateId)
    return tpl ? signDisplayLabel(tpl.label) : (item.name ?? '(poistettu merkki)')
  }
  return item.name ?? ''
}

/** Määräsäätimen askel (V162): clamppaa nollaan, ei koskaan negatiivinen. */
export function adjustQty(qty: number, delta: number): number {
  return Math.max(0, qty + delta)
}

/** Rakenna validoitu InventoryItem paikallisella id:llä (optimistinen UI). genId = uid.ts (T238). */
export function buildInventoryItem(input: InventoryInput): { ok: true; item: InventoryItem } | { ok: false; error: InventoryError } {
  const res = validateInventoryItem(input)
  if (!res.ok) return res
  return { ok: true, item: { id: genId(), ...res.value } }
}
