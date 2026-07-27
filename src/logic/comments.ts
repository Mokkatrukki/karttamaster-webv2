// T221/T75: yleiskäyttöinen kommentti-systeemi — client-slice.
// Tietomalli LUKITTU T75-skeemaan (server/routes/comments.ts). Kommentti voidaan kiinnittää
// merkkiin, pätkään tai vapaaseen karttapisteeseen. Kuka tahansa autentikoitu voi lähettää
// (ml. talkoolainen); poisto = järjestäjä+. Tämä moduuli on PUHDAS logiikka (ei DOMia, ei
// Leafletia) → Vitest-pure-testattava (fetch stubataan vi.stubGlobal).

export type CommentTargetType = 'marker' | 'segment' | 'point'

export interface Comment {
  id: string
  targetType: CommentTargetType
  targetId?: string
  lat?: number
  lon?: number
  text: string
  iconId?: string
  authorName?: string
  createdAt: string
  /** T338: kuva-URL:t (`/api/comments/:id/images/:imageId`). Sama muoto kuin SignMarker.images. */
  images?: string[]
  /** T341/V248: kuittausleima. Puuttuu ⇒ työ on AVOIN. ⊥ ole merkin status (V9/V245). */
  resolvedAt?: string
  resolvedBy?: string
}

// T341/V248: huomion KATEGORIA. Talkoolainen valitsee hanskat kädessä yhdellä painalluksella —
// dropdown on väärä kontretti kentällä. Kategoria talletetaan olemassa olevaan `iconId`-kenttään
// ∴ ⊥ skeemamuutosta, & se näkyy heti sekä kartalla (CommentPin) että listassa.
export interface NoteCategory {
  iconId: string
  label: string
  /** Lyhyt vihje siitä mitä tähän kirjoitetaan — kenttäesimerkit käyttäjältä 2026-07-25. */
  placeholder: string
}

export const NOTE_CATEGORIES: NoteCategory[] = [
  { iconId: 'tree-pine', label: 'Raivaus', placeholder: 'Esim. puu kaatunut polulle' },
  { iconId: 'wrench', label: 'Korjaus', placeholder: 'Esim. pitkokset pitää korjata' },
  { iconId: 'package', label: 'Nouto', placeholder: 'Esim. jätän tähän säkin, hakekaa se' },
  { iconId: 'alert-triangle', label: 'Muu', placeholder: 'Mitä huomasit?' },
]

/** Avoin = ⊥ kuitattu. Yksi totuus kaikille näkymille (lista, kartta, modaali). */
export function isOpenNote(c: Comment): boolean {
  return !c.resolvedAt
}

// Uuden kommentin syöte (ilman palvelimen generoimia id/createdAt-kenttiä).
export interface NewComment {
  targetType: CommentTargetType
  targetId?: string
  lat?: number
  lon?: number
  text: string
  iconId?: string
  authorName?: string
}

// Client-puolen esivalidointi — sama sopimus kuin backend (server/routes/comments.ts).
// Palauttaa virhekoodin tai null jos kelvollinen. Pure → helppo yksikkötestata + estää
// turhat 400-kierrokset (nopeampi palaute metsässä heikolla yhteydellä).
export function validateNewComment(input: NewComment): string | null {
  const validTypes: CommentTargetType[] = ['marker', 'segment', 'point']
  if (!validTypes.includes(input.targetType)) return 'invalid_target_type'
  if (!input.text || input.text.trim() === '') return 'missing_text'
  if (input.targetType === 'point') {
    if (typeof input.lat !== 'number' || typeof input.lon !== 'number') return 'missing_coordinates'
  } else if (!input.targetId) {
    return 'missing_target_id'
  }
  return null
}

// Hae kommentit valinnaisella suodatuksella (targetType [+targetId]). null = haku epäonnistui
// (erotettuna tyhjästä lokista []). Array.isArray-vahti: ei-array-vastaus → null, ei kaada
// renderiä (V14-pattern, sama kuin audit-sync/segment-sync).
export async function fetchComments(
  targetType?: CommentTargetType,
  targetId?: string,
): Promise<Comment[] | null> {
  try {
    const params = new URLSearchParams()
    if (targetType) params.set('targetType', targetType)
    if (targetId) params.set('targetId', targetId)
    const qs = params.toString()
    const resp = await fetch(`/api/comments${qs ? `?${qs}` : ''}`)
    if (!resp.ok) return null
    const data = await resp.json()
    return Array.isArray(data) ? (data as Comment[]) : null
  } catch {
    return null
  }
}

// Lähetä uusi kommentti. Palauttaa luodun kommentin (server täydentää id/createdAt) tai null
// jos validointi/pyyntö epäonnistui. Esivalidointi ennen fetchiä (ei turhaa 400-kierrosta).
export async function postComment(input: NewComment): Promise<Comment | null> {
  if (validateNewComment(input) !== null) return null
  try {
    const resp = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: input.targetType,
        targetId: input.targetId,
        lat: input.lat,
        lon: input.lon,
        text: input.text.trim(),
        iconId: input.iconId,
        authorName: input.authorName?.trim() || undefined,
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    // Vahti: odotamme objektia jossa on id — ei-objekti (virhe-JSON) → null.
    return data && typeof data === 'object' && 'id' in data ? (data as Comment) : null
  } catch {
    return null
  }
}

// T338: liitä kuva huomioon. ∀ autentikoitu (V13/V246) — backend gate hoitaa auktorisoinnin.
// Palauttaa virhekoodin tai null jos onnistui: kutsuja erottaa taajuusrajan (429) muusta,
// koska "yritä uudelleen" on väärä ohje kun kiintiö on täynnä (V247).
export type CommentImageError = 'rate_limited' | 'too_large' | 'invalid_type' | 'failed'

export async function addCommentImage(commentId: string, file: File): Promise<CommentImageError | null> {
  try {
    const fd = new FormData()
    fd.append('image', file)
    const resp = await fetch(`/api/comments/${encodeURIComponent(commentId)}/images`, {
      method: 'POST',
      body: fd,
    })
    if (resp.ok) return null
    if (resp.status === 429) return 'rate_limited'
    if (resp.status === 413) return 'too_large'
    if (resp.status === 400) return 'invalid_type'
    return 'failed'
  } catch {
    return 'failed'
  }
}

// T341/V248: kuittaa työ tehdyksi (tai palauta avoimeksi). Järjestäjä+ — backend gate.
export async function resolveComment(id: string, resolved: boolean): Promise<Comment | null> {
  try {
    const resp = await fetch(`/api/comments/${encodeURIComponent(id)}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data && typeof data === 'object' && 'id' in data ? (data as Comment) : null
  } catch {
    return null
  }
}

// Poista kommentti (järjestäjä+; backend gate hoitaa auktorisoinnin). true = poistettu.
export async function deleteComment(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
    return resp.ok
  } catch {
    return false
  }
}
