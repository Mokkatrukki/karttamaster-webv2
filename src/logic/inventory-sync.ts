import { unlinkedItems, type InventoryLinkRow } from './inventory-link'

/**
 * T399 — inventaarion haku merkkipohjan luontia varten (V289). Erillään `inventory-link.ts`:stä
 * joka on PUHDAS (⊥ fetch) — sama jako kuin `template-match.ts` ↔ `template-sync.ts`.
 *
 * V289: KAIKKI virheet niellään & palautetaan tyhjä lista — kutsuja (picker) jättää osion pois
 * hiljaa. `/api/inventory` on `admin|järjestäjä` (V163) ∴ talkoolainen saa 403 kartan
 * merkkikirjastossa & merkkipohjan luonti ! silti toimia: se on toiminut ilman inventaariota
 * T193:sta asti.
 */

type ServerRow = {
  id: string
  name: string
  qty: number
  location_id: string | null
  template_id: string | null
  not_sign?: number
}
type ServerLocation = { id: string; name: string }

/** Linkittämättömät varastorivit paikkanimineen. Virhe / 403 → tyhjä lista (V289). */
export async function fetchInventoryLinkRows(): Promise<InventoryLinkRow[]> {
  try {
    const [itemsRes, locRes] = await Promise.all([fetch('/api/inventory'), fetch('/api/inventory/locations')])
    if (!itemsRes.ok) return []
    const rows = (await itemsRes.json()) as ServerRow[]
    const locations: ServerLocation[] = locRes.ok ? ((await locRes.json()) as ServerLocation[]) : []
    const locName = new Map(locations.map((l) => [l.id, l.name]))
    return unlinkedItems(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        qty: r.qty,
        locationName: r.location_id ? (locName.get(r.location_id) ?? 'Ei paikkaa') : 'Ei paikkaa',
        templateId: r.template_id,
        notSign: r.not_sign === 1,
      })),
    ).map(({ id, name, qty, locationName: ln }) => ({ id, name, qty, locationName: ln }))
  } catch {
    return []
  }
}

/**
 * Linkitä olemassa oleva varastorivi juuri luotuun merkkipohjaan (V288: vasta tallennuksen
 * jälkeen). PUT lähettää koko kenttäsetin kuten muutkin inventaariomutaatiot — GET ensin,
 * jotta qty/paikka/kommentti eivät nollaudu.
 */
export async function linkInventoryItemToTemplate(itemId: string, templateId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/inventory')
    if (!res.ok) return false
    const item = ((await res.json()) as ServerRow[]).find((r) => r.id === itemId)
    if (!item) return false
    const put = await fetch(`/api/inventory/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name,
        qty: item.qty,
        location_id: item.location_id,
        template_id: templateId,
        not_sign: 0, // V279: linkitetty rivi ⊥ voi olla tarvike
      }),
    })
    return put.ok
  } catch {
    return false
  }
}
