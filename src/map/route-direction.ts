import L from 'leaflet'
import type { RoutePoint } from '../logic/types'
import { directionArrowPlacements } from '../logic/bearing'

// T286: pienet suuntanuolet reitin varrella (kulkusuunta start→end). Nuolet ovat oma
// LayerGroup joka lisätään/poistetaan reittiviivan mukana (main.ts kytkee polyline
// 'add'/'remove' -tapahtumiin) → piilotettu reitti = ei nuolia. interactive:false →
// nuolet eivät sieppaa klikkejä (polyline-klikki/drive säilyy).
export function buildDirectionArrows(points: RoutePoint[], color: string, spacingM = 800): L.LayerGroup {
  const group = L.layerGroup()
  for (const p of directionArrowPlacements(points, spacingM)) {
    const icon = L.divIcon({
      className: 'route-dir-arrow',
      html: `<svg width="11" height="11" viewBox="0 0 24 24" style="transform:rotate(${p.bearing.toFixed(1)}deg)"><path d="M12 4 L18 18 L12 14.5 L6 18 Z" fill="${color}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
      iconSize: [11, 11],
      iconAnchor: [5.5, 5.5],
    })
    L.marker([p.lat, p.lon], { icon, interactive: false, keyboard: false }).addTo(group)
  }
  return group
}
