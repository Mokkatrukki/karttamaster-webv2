// T448/V116: kasanäkymän kirjoitukset SAMAN durable-outboxin kautta kuin kaikki muu.
//
// Autoporukka ajaa metsäteitä ∴ "Haettu" napautetaan katvealueella. Suora `fetch` katoaisi
// hiljaa & kasa jäisi toisen porukan listalle haettavaksi — juuri se päällekkäisajo jonka
// koko näkymä on olemassa estämään. Outbox säilyttää kirjoituksen sivun päivityksen yli.
//
// Ei DOM:ia, ei Leafletia → Vitest-pure (fetch mockataan).

import type { MarkerStatus } from './types'
import { outbox } from './outbox-instance'

/**
 * Kasan statusmuutos (`✓ Haettu` → `kerätty`). Sama `PUT /api/markers/:id` -reitti kuin
 * kartalla ∴ ⊥ uutta mutaatiopolkua & audit-loki (V231) täyttyy ilman erillistä kytkentää.
 */
export async function pushPileStatus(id: string, status: MarkerStatus): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'marker:' + id,
    method: 'PUT',
    url: `/api/markers/${id}`,
    body: JSON.stringify({ status }),
  })
  return delivered
}
