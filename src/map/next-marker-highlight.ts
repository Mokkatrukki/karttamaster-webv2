import L from 'leaflet'

// T224 (b1): seuraava asettamaton merkki näkyy KARTALLA koko ajan korostettuna (accent-rengas) —
// talkoolainen näkee heti minne mennä, ilman että avaa mitään. Erityisen tärkeä kun alapalkki on
// poistettu (kartta on päänavigointipinta). Ei-interaktiivinen (ei estä merkin klikkausta).
export class NextMarkerHighlight {
  private ring: L.CircleMarker | null = null

  constructor(private readonly map: L.Map) {}

  set(lat: number, lon: number): void {
    if (!this.ring) {
      this.ring = L.circleMarker([lat, lon], {
        radius: 20,
        weight: 3,
        color: '#F2542D', // --accent
        opacity: 0.9,
        fill: false,
        interactive: false,
        className: 'next-marker-ring',
      })
      this.ring.addTo(this.map)
    } else {
      this.ring.setLatLng([lat, lon])
      if (!this.map.hasLayer(this.ring)) this.ring.addTo(this.map)
    }
    this.ring.bringToFront()
  }

  clear(): void {
    if (this.ring && this.map.hasLayer(this.ring)) this.ring.remove()
  }
}
