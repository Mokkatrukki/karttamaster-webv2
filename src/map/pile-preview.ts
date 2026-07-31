// T454/V338: KASAN ESIKATSELUPISTE — sijainti näkyy ENNEN kuin se on olemassa.
//
// Vahvistus jota ⊥ voi katsoa ⊥ ole vahvistus (B187): "Jätetäänkö kasa tähän?" vaatii että
// "tässä" on ruudulla. Piste ⊥ ole vielä kasa: ⊥ POSTia, ⊥ audit-riviä, ⊥ id:tä ∴ Peruuta ⊥
// jätä jälkeä mihinkään. Se on kartan pinnalla elävä AIKOMUS, & juuri siksi se on OMA kevyt
// kerroksensa ⊥ `MarkerManager.add` + poisto (joka olisi kaksi kirjoitusta serverille yhdestä
// mielenmuutoksesta).
//
// Raahaus & napautus siirtävät samaa pistettä: hanskoilla raahaus on epävarma & pelkkä napautus
// vaatii tarkkuutta jota kartalla ⊥ ole — kaksi tapaa samaan tekoon, ⊥ kaksi eri tulosta.
//
// Ohut Leaflet-glue → Playwright, ⊥ Vitest (kutsuja injektoi tämän `PilePlacementDeps`iin).

import L from 'leaflet'

export interface PilePreviewHandle {
  /** Siirrä piste (kartan napautus). */
  move(lat: number, lon: number): void
  /** Missä piste nyt on — totuus on KARTALLA ⊥ kutsujan muuttujassa (raahaus liikuttaa sitä). */
  position(): { lat: number; lon: number }
  remove(): void
}

/** Esikatselupiste kartalle. `onMove` laukeaa raahauksesta — kutsuja päivittää etäisyyslukeman. */
export function showPilePreview(
  map: L.Map,
  lat: number,
  lon: number,
  onMove?: (lat: number, lon: number) => void,
): PilePreviewHandle {
  const marker = L.marker([lat, lon], {
    draggable: true,
    // Sijoitustilan piste ! olla ylimpänä: sen alle jäävä merkki olisi se jota käyttäjä luulee
    // raahaavansa.
    zIndexOffset: 1000,
    icon: L.divIcon({
      className: 'pile-preview-icon',
      html: '<div class="pile-preview-pin">📦</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
  }).addTo(map)

  marker.on('drag', () => {
    const at = marker.getLatLng()
    onMove?.(at.lat, at.lng)
  })

  return {
    move(nextLat, nextLon) {
      marker.setLatLng([nextLat, nextLon])
      onMove?.(nextLat, nextLon)
    },
    position() {
      const at = marker.getLatLng()
      return { lat: at.lat, lon: at.lng }
    },
    remove() {
      marker.remove()
    },
  }
}
