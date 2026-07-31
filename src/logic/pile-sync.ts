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

// ── T449/V333: VARAUS ⊥ KULJE OUTBOXIN LÄPI ─────────────────────────────────────────────────
//
// Outbox on oikea vastaus kirjoitukselle jonka ARVO säilyy ("tämä kasa on haettu" on tosi myös
// 20 minuuttia myöhemmin). Varaus on päinvastainen: 20 minuuttia myöhässä toimitettu "otan
// nämä" varaa kasan porukalle joka ⊥ enää ole matkalla — & se on juuri se näkymätön väärä
// tieto jonka V333 kieltää. Epäonnistunut varaus ! epäonnistua NÄKYVÄSTI & heti.

// Epäonnistumisen SYY kulkee UI:hin asti: `status` on HTTP-koodi & `null` = `fetch` heitti
// (verkko poikki, ⊥ vastausta lainkaan). Yksi geneerinen "ei mennyt läpi" olisi neljä eri
// toimenpidettä samassa lauseessa (V322) ∴ tulkinta tehdään `pile-claim.ts`:n viestifunktiossa,
// ⊥ tässä: tämä moduuli kuljettaa faktan, ⊥ sanamuotoa.
export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken'; by?: string }
  | { ok: false; reason: 'error'; status: number | null }

export type ReleaseResult = { ok: true } | { ok: false; status: number | null }

export async function claimPile(id: string): Promise<ClaimResult> {
  try {
    const res = await fetch(`/api/markers/${id}/claim`, { method: 'POST' })
    if (res.ok) return { ok: true }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { claimed_by?: string }
      return { ok: false, reason: 'taken', ...(body.claimed_by ? { by: body.claimed_by } : {}) }
    }
    return { ok: false, reason: 'error', status: res.status }
  } catch {
    return { ok: false, reason: 'error', status: null }
  }
}

/** Vapautus on KENEN TAHANSA käytettävissä (V333) — portti on serverillä, ⊥ tässä. */
export async function releasePile(id: string): Promise<ReleaseResult> {
  try {
    const res = await fetch(`/api/markers/${id}/claim`, { method: 'DELETE' })
    return res.ok ? { ok: true } : { ok: false, status: res.status }
  } catch {
    return { ok: false, status: null }
  }
}
