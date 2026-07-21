// T238/B103: turva-id-generaattori joka toimii MYÖS insecure contextissa.
//
// crypto.randomUUID() on saatavilla vain secure contextissa (https TAI localhost).
// LAN-dev http://<ip>:5173 (http + ei-localhost) = insecure → crypto.randomUUID
// === undefined → guardaamaton kutsu heittää "TypeError: crypto.randomUUID is not
// a function" ja kaataa merkin/pätkän/alueen luonnin HILJAA (unhandled).
//
// V160: kaikki id-generointi src/-koodissa tämän apurin kautta — ei koskaan
// guardaamatonta crypto.randomUUID()-kutsua. write-outbox.ts:n makeId() oli jo
// tämä pattern; tämä yleistää sen jaettavaksi.
//
// Pure: ei DOM:ia, ei Leafletia → Vitest-pure.

let counter = 0

// Palauttaa uniikin id-stringin. Käyttää natiivia crypto.randomUUID() kun
// saatavilla (secure context), muuten kryptaton fallback: timestamp (base36) +
// juokseva counter + Math.random. Ei kryptografisesti vahva, mutta riittävän
// uniikki client-side-avaimeksi (paikallinen id ennen serverin kanonisointia).
export function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  counter = (counter + 1) % 0xffffff
  return `id-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
