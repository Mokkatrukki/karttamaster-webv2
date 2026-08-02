// T466 (pilkko, T464-lippu): pätkän MUOKKAUSTYÖKALUT irti katselukerroksesta.
//
// `SegmentOverlay` piirtää pätkät (viiva + casing + lappu + päätepiste). Nämä kaksi ovat eri
// asia: raahattavat rajakahvat (T78/V43) & luonnin snap-pisteet ovat TYÖKALUJA joilla on oma
// elinkaari — ne syntyvät käyttäjän eleestä & kuolevat siihen, ⊥ jokaisesta renderistä.
//
// Jakolinja seuraa TILAA ⊥ nimeä: kumpikaan siirretty ⊥ koske overlayn `layers`-listaan ∴
// V353(e):n `clear()`-sopimus (orpo päätepiste ⊥ jää kartalle) ⊥ ristikkäisty jaossa. Molemmilla
// on oma siivousmetodinsa & oma listansa.
import L from 'leaflet'
import { deliverMapClick } from '../logic/map-click'
import { nearestPointIndex } from '../logic/bearing'
import type { RoutePoint } from '../logic/types'
import type { Segment, SegmentStore } from '../logic/segments'
import { segmentPrimaryRouteId } from '../logic/segments'

// Sama muoto kuin `SegmentOverlay`illa — kahvat tarvitsevat reitin GEOMETRIAN, ⊥ sen väriä.
interface RouteRef { id: string; routePoints: RoutePoint[]; color?: string }

export class SegmentEditHandles {
  private editMarkers: L.Marker[] = []
  private snapMarkers: L.CircleMarker[] = []

  constructor(
    private readonly map: L.Map,
    private readonly routes: RouteRef[],
  ) {}

  isEditMode(): boolean {
    return this.editMarkers.length > 0
  }

  exitEditMode(): void {
    this.editMarkers.forEach(m => m.remove())
    this.editMarkers = []
  }

  showCreationSnapMarkers(
    store: SegmentStore,
    onSnap: (routeId: string, dist: number, lat: number, lon: number) => void,
  ): void {
    this.hideCreationSnapMarkers()
    for (const seg of store.values()) {
      if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
      const segStart = seg.startDist
      const segEnd = seg.endDist
      // T299/V211: snap-pisteet primary-reitin km-kohtiin (ks. overlayn render-haaran perustelu).
      {
        const routeId = segmentPrimaryRouteId(seg)
        const route = this.routes.find(r => r.id === routeId)
        if (!route || !routeId) continue
        for (const [dist, color] of [[segStart, '#f59e0b'], [segEnd, '#10b981']] as [number, string][]) {
          const pos = routePointAtDist(route.routePoints, dist)
          const m = L.circleMarker(pos, { radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2 })
          m.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            if (e.latlng && deliverMapClick(e.latlng.lat, e.latlng.lng)) return
            onSnap(routeId, dist, pos[0], pos[1])
          })
          m.addTo(this.map)
          this.snapMarkers.push(m)
        }
      }
    }
  }

  hideCreationSnapMarkers(): void {
    this.snapMarkers.forEach(m => m.remove())
    this.snapMarkers = []
  }

  // Place draggable start/end markers for the segment. onSave called on each snap.
  enterEditMode(seg: Segment, onSave: (startDist: number, endDist: number) => void): void {
    this.exitEditMode()
    // V139: reitittömällä tehtävällä ei raahattavia raja-merkkejä.
    if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) return
    // T299/V211/B114: A/B-raahausmerkit primary-reitille — `find(includes)` otti listajärjestyksen
    // ensimmäisen jäsenen ∴ jaetulla osuudella rajat piirtyivät eri geometriaan kuin km:t mittaavat.
    const primaryId = segmentPrimaryRouteId(seg)
    const route = this.routes.find(r => r.id === primaryId)
    if (!route) return

    let editStartDist = seg.startDist
    let editEndDist = seg.endDist

    const startPos = routePointAtDist(route.routePoints, seg.startDist)
    const endPos = routePointAtDist(route.routePoints, seg.endDist)

    const startIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--start', html: 'A', iconSize: [24, 24] })
    const endIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--end', html: 'B', iconSize: [24, 24] })

    const startMarker = L.marker(startPos, { draggable: true, icon: startIcon, title: 'Aloituspiste (raahaa)' })
    const endMarker = L.marker(endPos, { draggable: true, icon: endIcon, title: 'Lopetuspiste (raahaa)' })

    startMarker.on('dragend', () => {
      const { lat, lng } = startMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editStartDist = pt.distanceFromStart
      startMarker.setLatLng([pt.lat, pt.lon])
      if (editStartDist < editEndDist) onSave(editStartDist, editEndDist)
    })

    endMarker.on('dragend', () => {
      const { lat, lng } = endMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editEndDist = pt.distanceFromStart
      endMarker.setLatLng([pt.lat, pt.lon])
      if (editEndDist > editStartDist) onSave(editStartDist, editEndDist)
    })

    startMarker.addTo(this.map)
    endMarker.addTo(this.map)
    this.editMarkers = [startMarker, endMarker]
  }
}

function routePointAtDist(routePoints: RoutePoint[], dist: number): [number, number] {
  let closest = routePoints[0]
  let minDiff = Math.abs(routePoints[0].distanceFromStart - dist)
  for (const pt of routePoints) {
    const diff = Math.abs(pt.distanceFromStart - dist)
    if (diff < minDiff) {
      minDiff = diff
      closest = pt
    }
  }
  return [closest.lat, closest.lon]
}
