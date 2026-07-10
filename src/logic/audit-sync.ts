// T227: supervision — merkki-audit-lokin haku + massaperuutus (järjestäjä/admin).
// Backend: server/routes/audit.ts (GET /api/audit, POST /api/audit/undo).

export type AuditAction = 'add' | 'move' | 'remove' | 'status'

export interface AuditEntry {
  id: string
  marker_id: string
  action: AuditAction
  actor: string | null
  actor_role: string
  segment_code: string | null
  created_at: string
  payload: unknown
}

// Hae pätkän audit-loki aikajärjestyksessä. null = haku epäonnistui (erotettuna tyhjästä lokista []).
// Array.isArray-vahti: ei-array-vastaus (virhe-JSON, mock) → null, ei kaada renderiä (V14-pattern).
export async function fetchSegmentAudit(segmentCode: string): Promise<AuditEntry[] | null> {
  try {
    const resp = await fetch(`/api/audit?segment_code=${encodeURIComponent(segmentCode)}`)
    if (!resp.ok) return null
    const data = await resp.json()
    return Array.isArray(data) ? (data as AuditEntry[]) : null
  } catch {
    return null
  }
}

// Massaperuutus: peru pätkän kaikki tietyn actionin mutaatiot (add=poista, move/status=restore ennen-tila).
// Palauttaa peruutettujen määrän tai null jos pyyntö epäonnistui.
export async function undoSegmentActions(segmentCode: string, action: AuditAction): Promise<number | null> {
  try {
    const resp = await fetch('/api/audit/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_code: segmentCode, action }),
    })
    if (!resp.ok) return null
    return ((await resp.json()) as { undone: number }).undone
  } catch {
    return null
  }
}
