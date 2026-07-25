// T317/V228: talkoolaisen nimi yleissalasana-kirjautumisessa.
//
// Nimi EI ole turvaraja — jaettu salasana ei tunnista ketään, ja kuka tahansa voi kirjoittaa
// mitä tahansa. Se on jäljitettävyysväline: ilman sitä audit-loki näyttää jokaisen tekijän
// nimellä 'Talkoolainen' eikä kysymykseen "kuka siirsi merkit" ole vastausta (B124).
//
// Nimi muistetaan laitteessa → metsässä hanskat kädessä ei kirjoiteta samaa uudestaan.

export const TALKOO_NAME_KEY = 'km:talkoo:nimi'

export const NAME_MIN = 2
export const NAME_MAX = 40

// Sama sääntö kuin serverillä (server/routes/auth.ts) — client estää turhan 400-kierroksen,
// server on totuus.
export function isValidTalkooName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX
}

export function readRememberedName(): string {
  try {
    return localStorage.getItem(TALKOO_NAME_KEY) ?? ''
  } catch {
    return '' // localStorage estetty (private mode) → kenttä vain alkaa tyhjänä
  }
}

export function rememberName(name: string): void {
  const trimmed = name.trim()
  if (!isValidTalkooName(trimmed)) return
  try {
    localStorage.setItem(TALKOO_NAME_KEY, trimmed)
  } catch { /* muisti ei ole kriittinen — kirjautuminen onnistui silti */ }
}
