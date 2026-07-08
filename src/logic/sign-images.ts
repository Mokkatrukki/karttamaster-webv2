// V99/T158: asset-konventio src/assets/signs/<id>.webp — Vite glob-import (eager, url).
// Kuvia ei vielä ole → map jää tyhjäksi, kaikki resolvoituu undefiniksi → fallback ikoniin/labeliin.
// Kun kuva pudotetaan hakemistoon nimellä <template.id>.webp, se otetaan käyttöön automaattisesti.
const modules = import.meta.glob('../assets/signs/*.webp', { eager: true, query: '?url', import: 'default' })

const imageMap = new Map<string, string>()
for (const [path, url] of Object.entries(modules)) {
  const id = path.split('/').pop()!.replace(/\.webp$/, '')
  imageMap.set(id, url as string)
}

// Kaikki käytettävissä olevat kuva-idt (webp-tiedostojen nimet ilman päätettä).
// T161-kuratointi: sign-catalog rakentaa näistä templatet automaattisesti.
export function signImageIds(): string[] {
  return [...imageMap.keys()]
}

// imageId-konventio = template.id (bundled webp) TAI backend-URL (T196: järjestäjän lataama kuva).
// Backend-ladatun kuvan imageId on absoluuttinen polku (`/api/templates/:id/images/:imageId`) →
// palautetaan sellaisenaan, ei bundle-lookuppia. Muuten bundled-asset webp-nimellä.
// Palauttaa undefined jos kuvatiedostoa ei ole.
export function signImageSrc(imageId: string | undefined): string | undefined {
  if (!imageId) return undefined
  if (imageId.startsWith('/') || imageId.startsWith('http')) return imageId
  return imageMap.get(imageId)
}

// V99: kuva-elementti onerror-fallbackilla (T103-pattern) — jos kuva puuttuu/latautuu väärin,
// se poistaa itsensä → alla oleva ikoni/label paljastuu. Palauttaa '' jos kuvaa ei ole.
// src tulee Vite-globista (ei käyttäjäsyötettä) → turvallinen sellaisenaan; style on kutsujan literaali.
export function signImageTag(imageId: string | undefined, style: string): string {
  const src = signImageSrc(imageId)
  if (!src) return ''
  return `<img src="${src}" alt="" onerror="this.remove()" style="${style}">`
}
