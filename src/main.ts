import './style.css'
import L from 'leaflet'
import { loadGpx } from './logic/gpx'
import { buildRoutePoints } from './logic/bearing'
import type { MarkerManager } from './map/markers'
import { fetchMarkers } from './logic/sync'
import type { RouteConfig } from './logic/multi-route'
import { initMap } from './app/map-init'
import { wireAreas } from './app/areas-wiring'
import { wireSegments } from './app/segments-wiring'
import { wireMarkers } from './app/markers-wiring'
import { wireAuth } from './app/role-view'

export const ROUTE_DEFS: Omit<RouteConfig, 'routePoints'>[] = [
  { id: '35km', label: '35 km', color: '#f59e0b', file: '/route-35km.gpx' },
  { id: '55km', label: '55 km', color: '#8b5cf6', file: '/route-55km.gpx' },
]

const { map, toolbarMenu } = initMap()

let activeMarkerManager: MarkerManager | null = null

const warningEl = document.getElementById('distance-warning')!
let warningTimer: ReturnType<typeof setTimeout> | null = null
function showWarning(msg: string, ms = 4000): void {
  warningEl.textContent = msg
  warningEl.style.display = 'block'
  if (warningTimer) clearTimeout(warningTimer)
  warningTimer = setTimeout(() => { warningEl.style.display = 'none' }, ms)
}

async function init(talkoolainenCode?: string) {
  const initialMarkers = await fetchMarkers()

  const routes: RouteConfig[] = await Promise.all(
    ROUTE_DEFS.map(async def => {
      const coords = await loadGpx(def.file)
      return { ...def, routePoints: buildRoutePoints(coords) }
    })
  )

  const polylines = routes.map(r =>
    L.polyline(r.routePoints.map(p => [p.lat, p.lon] as [number, number]), {
      color: r.color, weight: 6, opacity: 0.85,
    }).addTo(map)
  )
  map.fitBounds(L.featureGroup(polylines).getBounds(), { padding: [20, 20] })

  // Ref täytetään markers-wiring.ts:ssä — segments-wiring tarvitsee merkit pätkän
  // status-väritykseen (V96) mutta MarkerManager luodaan vasta sen jälkeen.
  const markerManagerRef: { current: MarkerManager | null } = { current: null }

  await wireAreas(map, talkoolainenCode)

  const { segmentStore, segmentOverlay, renderSegmentOverlay, segmentPanel } = await wireSegments(
    map, routes, talkoolainenCode, initialMarkers, markerManagerRef,
    () => showWarning('⚠ Pätkän tallennus epäonnistui (muisti täynnä?)', 5000),
  )

  const { markerManager, driveMode, progressBar, placeMode, markerModal, closeMarkerModal } = wireMarkers(
    map, routes, polylines, initialMarkers, talkoolainenCode,
    { segmentStore, renderSegmentOverlay, segmentPanel, showWarning },
  )
  markerManagerRef.current = markerManager
  activeMarkerManager = markerManager

  // Map events
  map.doubleClickZoom.disable()

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (placeMode.isArmed()) { placeMode.placeArmedAt(e.latlng.lat, e.latlng.lng); return }
    if (segmentPanel.isCreationMode()) {
      segmentPanel.onMapClick(e.latlng.lat, e.latlng.lng)
      return
    }
    if (placeMode.isPickerOpen()) { placeMode.closePicker(); return }
  })

  map.on('dblclick', (e: L.LeafletMouseEvent) => {
    const orig = (e as any).originalEvent as MouseEvent
    placeMode.openPicker(e.latlng.lat, e.latlng.lng, orig.clientX, orig.clientY)
  })

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (placeMode.isArmed())           { placeMode.disarm();        return }
      if (segmentPanel.isCreationMode()) { segmentPanel.cancelCreation(); return }
      if (segmentOverlay.isEditMode())   { segmentOverlay.exitEditMode(); return }
      if (placeMode.isPickerOpen())      { placeMode.closePicker();   return }
      if (markerModal.classList.contains('open')) { closeMarkerModal(); return }
      if (driveMode.isActive()) { driveMode.stop(); progressBar.update(0) }
      return
    }
    if (!driveMode.isActive()) return
    if (e.key === 'ArrowRight') { e.preventDefault(); driveMode.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); driveMode.prev() }
  })
}

if (import.meta.env.DEV) {
  import('./devtools/feedback-widget').then(({ FeedbackWidget }) => new FeedbackWidget())
}

const authScreen = wireAuth(toolbarMenu, () => activeMarkerManager, (code) => {
  init(code).catch(console.error)
})
authScreen.start().catch(console.error)
