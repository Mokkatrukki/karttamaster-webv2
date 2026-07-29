import type { MarkerStatus } from './types'

/**
 * T387/V276 — montako merkkiä on KARTALLA vs VARASTOSSA per merkkipohja.
 *
 * Yhdistysavain on AINA `template_id` (V276): `markers.template_id` (T215/V143) ↔
 * `inventory_items.template_id` (T243/V165). ⊥ nimivertailua — nimivertailu on ehdotus
 * (`template-match.ts`), ⊥ liitos.
 *
 * RIIPPUVUUSSYY (T383): ilman markers-backfilliä 67 merkkiä puuttuisi luvuista ∴ luku olisi
 * VÄÄRIN ⊥ vain vajaa. Väärä luku on pahempi kuin ei lukua: järjestäjä tilaa liikaa kylttejä
 * luottaen siihen.
 *
 * Puhdas: ⊥ Leaflet, ⊥ DOM, ⊥ Date/Math.random. Laskenta clientissä olemassa olevasta
 * GET /api/markers -datasta — ⊥ backend-aggregaattia.
 */

export interface MarkerStock {
  /** Fyysisesti maastossa: `suunniteltu`|`asetettu`|`tarkistettu`. */
  kartalla: number
  /** Inventaarion qty-summa tälle merkkipohjalle. */
  varastossa: number
}

/**
 * Status ratkaisee ämpärin: `kerätty` merkki on takaisin varastossa & `ei_tarpeen` ⊥ ole
 * koskaan maastossa ∴ kumpikaan ⊥ ole "kartalla". Muut statukset lasketaan.
 */
function onMap(status: MarkerStatus | undefined): boolean {
  return status !== 'kerätty' && status !== 'ei_tarpeen'
}

/**
 * Aggregoi inventaariorivit + markerit `template_id`:n mukaan.
 * Rakenteelliset parametrit (vain templateId/qty/status) — käy sekä `SignMarker` että `InventoryItem`.
 * Rivit/markerit ILMAN `templateId`:tä ohitetaan (tarvikkeet, linkittämättömät merkit).
 */
export function computeMarkerStock(
  items: readonly { templateId?: string | null; qty: number }[],
  markers: readonly { templateId?: string | null; status?: MarkerStatus }[],
): Map<string, MarkerStock> {
  const stock = new Map<string, MarkerStock>()
  const ensure = (id: string): MarkerStock => {
    let s = stock.get(id)
    if (!s) {
      s = { kartalla: 0, varastossa: 0 }
      stock.set(id, s)
    }
    return s
  }

  for (const it of items) {
    if (it.templateId) ensure(it.templateId).varastossa += it.qty
  }
  for (const m of markers) {
    if (m.templateId && onMap(m.status)) ensure(m.templateId).kartalla += 1
  }
  return stock
}
