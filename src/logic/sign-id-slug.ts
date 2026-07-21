// T161: puhdas slug-johto kylttitiedoston nimestä template-id:ksi.
// Ei DOM:ia, ei Leafletia, ei ImageMagickia, ei muita src-riippuvuuksia →
// Vitest-pure JA turvallinen importata scripts/convert-signs.ts:ään ilman runtime-lastia.
//
// Tulos matchaa sign-library.ts ID_RE:hen /^[A-Za-z0-9_-]+$/ (T156/V97) — sama
// filename-safe-sääntö. Regex on tässä toisinnettu tarkoituksella (ei importtia
// sign-librarysta, joka vetäisi mukanaan localStorage-koodia).
const ID_RE = /^[A-Za-z0-9_-]+$/

// Printtiprefix, esim "A3 vaaka leikattu 1 kpl ", "A3 pysty rajattu 6kpl ",
// "A4 vaaka rajattu 8 kpl ", "A3 neliö 35 kpl ". \d+\s*kpl kattaa "6kpl" ja "8 kpl".
const PRINT_PREFIX = /^(A3|A4)\s+(?:vaaka|pysty|neliö|leikattu|rajattu|\s)+\d+\s*kpl\s+/i

// Suomalaiset diakriitit → ASCII ennen kelvottomien merkkien poistoa.
function translitFi(s: string): string {
  return s
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
}

// Slugifioi mielivaltainen merkkijono ID_RE-kelvolliseksi: lower, fi-translit,
// välit → '-', kelvottomat pois, '-'-runsaus kutistetaan, reunaviivat trimmataan.
export function slugify(s: string): string {
  return translitFi(s.toLowerCase())
    .replace(/\s+/g, '-')      // välilyönnit → viiva
    .replace(/[^a-z0-9_-]/g, '') // kaikki muu pois (säilyttää _ ja -)
    .replace(/-+/g, '-')       // ---- → -
    .replace(/^-+|-+$/g, '')   // trim reunaviivat
}

// Johtaa template-id:n kylttitiedoston nimestä.
// Esim:
//   "A3 vaaka leikattu 1 kpl iso-syöte 430.png" → "iso-syote-430"
//   "park and ride.png"                          → "park-and-ride"
//   "wc.png"                                      → "wc"
// Palauttaa '' jos nimestä ei jää mitään (kutsuja flägää tyhjän virheenä).
export function signIdFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '') // pudota pääte
  const stripped = base.replace(PRINT_PREFIX, '') // pudota printtiprefix jos on
  return slugify(stripped)
}

// Apuri kutsujalle/testeille: onko id ID_RE-kelvollinen (tyhjä ei ole).
export function isValidSignId(id: string): boolean {
  return id.length > 0 && ID_RE.test(id)
}
