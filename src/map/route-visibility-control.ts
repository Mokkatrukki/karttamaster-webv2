import type L from 'leaflet'
import type { RouteConfig } from '../logic/multi-route'
import type { MarkerManager } from './markers'

// T204/V134 + T286: järjestäjän reittinäkyvyys. HISTORIA: yksi pilli per reitti rivissä →
// trigger-nappi + listapaneeli (T286) → **T377: DOM luovutettu `MapFilterBar`ille**.
//
// V271: bar PÄÄTTÄÄ mitkä reitit näkyvät, tämä luokka SOVELTAA päätöksen Leaflet-kerrokseen
// (polylinet + merkit + pätkäviivat). Kaksi "mitä näkyy" -kontrollia = käyttäjä arvaa kummasta
// etsii ∴ omaa paneelia ⊥ enää ole. Luokka säilyy koska sovellus & `getActiveRoute`-sopimus
// (ProgressBar/StatusPanel) ovat yhä tarpeen.
export class RouteVisibilityControl {
  private visibleRouteIds: string[]

  constructor(
    private readonly routes: RouteConfig[],
    private readonly polylines: L.Polyline[],
    private readonly map: L.Map,
    private readonly markerManager: MarkerManager,
    // T374/V269/B157: pätkäkerros elää segments-wiringissä ∴ näkyvyysmuutos ilmoitetaan ulos.
    private readonly onVisibleChange?: (ids: string[]) => void,
  ) {
    this.visibleRouteIds = routes.map(r => r.id)
  }

  // ProgressBar/StatusPanel-yhteensopivuus: "aktiivinen" = ensimmäinen näkyvä reitti.
  getActiveRoute(): RouteConfig {
    return this.routes.find(r => this.visibleRouteIds.includes(r.id)) ?? this.routes[0]
  }

  getActiveTotalM(): number {
    const pts = this.getActiveRoute().routePoints
    return pts[pts.length - 1]?.distanceFromStart ?? 0
  }

  getVisibleRouteIds(): string[] {
    return [...this.visibleRouteIds]
  }

  /** Barin päätös kartalle. V6 (≥1 näkyvä) vahditaan barissa — täällä tyhjä lista olisi vain
   *  tyhjä kartta, ⊥ virhe ∴ ⊥ hiljaista korjausta joka piilottaisi kutsujan bugin. */
  setVisibleRoutes(ids: string[]): void {
    this.visibleRouteIds = ids
    this.routes.forEach((r, i) => {
      if (ids.includes(r.id)) this.polylines[i].addTo(this.map)
      else this.polylines[i].remove()
    })
    this.markerManager.setVisibleRoutes(ids)
    this.onVisibleChange?.(ids)
  }
}
