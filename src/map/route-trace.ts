// T458/V343: REITTIJÄLJET TAUSTALLE — autoporukan kartta ilman reittejä on neljä pistettä
// tyhjässä.
//
// T448 riisui `/kasat`in kartan tahallaan ("autoporukka ajaa teitä ⊥ polkuja"); käyttäjä
// 2026-07-31 kumosi sen: kasa on reitin varrella & jälki on ainoa asia joka kertoo MITEN sinne
// pääsee — & kumpi puoli järveä on oikea. Reitit ovat TAUSTA ⊥ sisältö: ohut & himmennetty,
// kasapisteet piirtyvät päälle.
//
// LATAUS ON TAUSTATYÖ: lista & pisteet renderöityvät ennen GPX:iä ⊥ odota niitä (metsäverkko),
// & epäonnistunut lataus ⊥ kaada karttaa eikä näytä virhettä — reitti on APU ⊥ EHTO. Sama sääntö
// kuin V116-outboxilla: se mikä ⊥ ole kriittistä ⊥ saa pysäyttää sitä mikä on.
//
// Ohut Leaflet-glue → Playwright.

import L from 'leaflet'
import { ROUTE_DEFS } from '../logic/route-defs'
import { loadGpx } from '../logic/gpx'

/** Taustajäljen paino & läpinäkyvyys: luettava, muttei kilpaile kasapisteen (r=10) kanssa. */
const TRACE_WEIGHT = 3
const TRACE_OPACITY = 0.45

export interface RouteTraceLayer {
  /** Kaikki piirretyt jäljet — kutsuja voi rajata karttansa niihin jos muuta ⊥ ole. */
  bounds(): L.LatLngBounds | null
}

/**
 * Piirtää reittijäljet kartalle taustaksi. Palauttaa lupauksen joka ratkeaa kun jäljet ovat
 * kartalla — kutsuja EI odota sitä ennen listan tai pisteiden renderöintiä.
 *
 * `onDrawn` laukeaa jokaisen reitin jälkeen: kartta täydentyy sitä mukaa kun GPX:t saapuvat
 * ⊥ kerralla lopussa (hitain reitti ⊥ saa pidätellä muita).
 */
export async function addRouteTraces(
  map: L.Map,
  onDrawn?: (layer: L.Polyline) => void,
): Promise<RouteTraceLayer> {
  const drawn: L.Polyline[] = []

  await Promise.all(ROUTE_DEFS.map(async def => {
    try {
      const coords = await loadGpx(def.file)
      if (coords.length === 0) return
      const line = L.polyline(coords.map(p => [p.lat, p.lon] as [number, number]), {
        color: def.color,
        weight: TRACE_WEIGHT,
        opacity: TRACE_OPACITY,
        dashArray: def.dashArray,
        interactive: false,
      }).addTo(map)
      // Tausta pysyy taustana: kasapisteet ovat SVG-kerroksessa jäljen jälkeen ∴ ne ottavat
      // klikin & piirtyvät päälle myös kun jälki saapuu myöhässä.
      line.bringToBack()
      drawn.push(line)
      onDrawn?.(line)
    } catch {
      // Reitti on apu ⊥ ehto: yhden GPX:n kaatuminen ⊥ vie muita eikä näy käyttäjälle
      // virheenä jolle hän ⊥ voi tehdä mitään metsässä.
    }
  }))

  return {
    bounds: () => (drawn.length > 0 ? L.featureGroup(drawn).getBounds() : null),
  }
}
