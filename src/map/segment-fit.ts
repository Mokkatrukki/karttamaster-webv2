import type L from 'leaflet'
import { planSegmentZoom } from '../logic/segment-zoom'
import type { Segment } from '../logic/segments'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'

// T224 (D)/T345: kartan rajaus YHTEEN pätkään. Zoom-sääntö (mitä väliä fitataan) asuu
// `src/logic/segment-zoom.ts`:ssä (V185, Leaflet-vapaa); tämä on sen map-glue.
//
// T345: nostettu `markers-wiring.ts`:stä jaetuksi — talkoolaisen latausrajaus ja järjestäjän
// "Näytä kartalla" ovat sama kysymys ∴ sama vastaus. Kaksi kopiota olisi ajautunut erilleen
// (padding, maxZoom, reititön fallback) ja käyttäjä olisi nähnyt kaksi eri "koko pätkää".
//
// Reititön tehtävä (V139) tai harva route-data → boundit pätkän merkeistä, ⊥ no-op: tyhjä
// karttaliike näyttää rikkinäiseltä napilta.
export function fitMapToSegment(
  map: L.Map,
  routes: RouteConfig[],
  seg: Segment,
  segMarkers: SignMarker[],
): void {
  const plan = planSegmentZoom(seg.startDist, seg.endDist)
  const latlngs: [number, number][] = []
  if (plan) {
    const routeSet = new Set(seg.routeIds ?? [])
    for (const r of routes) {
      if (!routeSet.has(r.id)) continue
      for (const p of r.routePoints) {
        if (p.distanceFromStart >= plan.startDist && p.distanceFromStart <= plan.endDist) {
          latlngs.push([p.lat, p.lon])
        }
      }
    }
  }
  if (latlngs.length === 0) {
    for (const m of segMarkers) latlngs.push([m.lat, m.lon])
  }
  if (latlngs.length === 1) map.setView(latlngs[0], 15)
  else if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16 })
}
