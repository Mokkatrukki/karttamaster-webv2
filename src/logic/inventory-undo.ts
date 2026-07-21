import { resolveItemName, type InventoryItem } from './inventory'

/**
 * Inventaarion "Kumoa"-undo (client-only, V172). Kuvaa VIIMEISIMMÄN mutaation ENNEN-tilan
 * niin että entry osaa (a) näyttää toast-tekstin ja (b) palauttaa tilan V173-reittien kautta.
 * Puhdas data-tyyppi + label — EI DOM, EI fetch. Revert-sivuvaikutukset elävät src/inventory.ts:ssä.
 */

/** Item-tason mutaatio (poisto / qty / siirto): ENNEN-tila talletettu `item`:iin. */
export interface ItemUndoAction {
  kind: 'delete-item' | 'qty' | 'move'
  /** Rivin tila ENNEN mutaatiota — qty/locationId/kentät luetaan tästä revertissä. */
  item: InventoryItem
}

/**
 * Paikan poisto (V173c): V166 nullaa itemien location_id peruuttamattomasti, joten
 * revert tarvitsee affektoidut item_id:t + paikan nimen (uudelleenluontia varten).
 */
export interface LocationUndoAction {
  kind: 'delete-location'
  locationName: string
  /** Itemit jotka osoittivat poistettuun paikkaan (ENNEN DELETEä luettu). */
  affectedItemIds: string[]
}

export type UndoAction = ItemUndoAction | LocationUndoAction

/** Templates-lookup resolveItemName-yhteensopiva (rakenteellinen, T247-linja). */
type TemplateLookup = { get(id: string): { label: string; keppi?: boolean } | undefined }

/**
 * Toast-teksti mutaatiolle (V172). Nimi resolvoidaan resolveItemName-hengessä
 * (merkki → elävä template.label, fallback poistetulle merkille V165).
 */
export function describeUndo(action: UndoAction, templates: TemplateLookup): string {
  if (action.kind === 'delete-location') {
    return `Poistit paikan: ${action.locationName}`
  }
  const name = resolveItemName(action.item, templates)
  switch (action.kind) {
    case 'delete-item':
      return `Poistit: ${name}`
    case 'qty':
      return `Muutit määrää: ${name}`
    case 'move':
      return `Siirsit: ${name}`
  }
}
