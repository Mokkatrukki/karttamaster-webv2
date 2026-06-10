import './style.css'
import L from 'leaflet'
import { loadGpx } from './logic/gpx'
import { buildRoutePoints } from './logic/bearing'
import { MarkerManager } from './map/markers'
import { DriveMode } from './map/drive'
import { RouteBar } from './map/route-bar'
import { ProgressBar } from './ui/progress-bar'
import { PlaceMode } from './ui/place-mode'
import { renderMarkerList } from './ui/marker-list'
import { RoleSelector } from './ui/role-selector'
import { AuthScreen } from './ui/auth-screen'
import { TILE_LAYERS } from './logic/tile-layers'
import { loadMarkers } from './logic/persistence'
import { syncMarkers, pushPending, SyncError } from './logic/sync'
import { MapStateBadge, showMapNotReadyBanner } from './ui/map-state-badge'
import { SnapshotPanel } from './ui/snapshot-panel'
import { StatusPanel } from './ui/status-panel'
import { calcAllRouteStatus } from './logic/route-status'
import { setRole } from './logic/role'
import { GpsNavigator } from './map/gps-navigator'
import { GpsDrivePanel } from './ui/gps-drive-panel'
import { SegmentOverlay } from './map/segment-overlay'
import { SegmentPanel } from './ui/segment-panel'
import { SegmentView } from './ui/segment-view'
import { createSegmentStore, getSegmentForCode, getMarkersForSegment } from './logic/segments'
import type { RouteConfig } from './logic/multi-route'

export const ROUTE_DEFS: Omit<RouteConfig, 'routePoints'>[] = [
  { id: '35km', label: '35 km', color: '#f59e0b', file: '/route-35km.gpx' },
  { id: '55km', label: '55 km', color: '#8b5cf6', file: '/route-55km.gpx' },
]

const map = L.map('map')

const LS_KEY = 'karttamaster-layer'
const savedLayerId = localStorage.getItem(LS_KEY) ?? TILE_LAYERS[0].id
let activeLayerIdx = Math.max(0, TILE_LAYERS.findIndex(l => l.id === savedLayerId))
let currentTileLayer = L.tileLayer(TILE_LAYERS[activeLayerIdx].urlTemplate, {
  attribution: TILE_LAYERS[activeLayerIdx].attribution,
  maxZoom: TILE_LAYERS[activeLayerIdx].maxZoom,
}).addTo(map)

function applyRoleView(role: string): void {
  document.body.dataset.role = role
}

const btnLayer = document.getElementById('btn-layer')
if (btnLayer) {
  btnLayer.textContent = TILE_LAYERS[activeLayerIdx].label
  btnLayer.addEventListener('click', () => {
    activeLayerIdx = (activeLayerIdx + 1) % TILE_LAYERS.length
    const cfg = TILE_LAYERS[activeLayerIdx]
    currentTileLayer.remove()
    currentTileLayer = L.tileLayer(cfg.urlTemplate, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map)
    localStorage.setItem(LS_KEY, cfg.id)
    btnLayer.textContent = cfg.label
  })
}

const gpsNavigator = new GpsNavigator(map)
const btnGps = document.getElementById('btn-gps')
if (btnGps) {
  btnGps.addEventListener('click', () => {
    if (gpsNavigator.isActive()) {
      gpsNavigator.stop()
      btnGps.classList.remove('gps-active')
    } else {
      gpsNavigator.start()
      btnGps.classList.add('gps-active')
    }
  })
}

async function init(talkoolainenCode?: string) {
  // V18: push any offline changes before syncing, then load from server
  await pushPending().catch(() => {})
  let initialMarkers = loadMarkers()
  try {
    initialMarkers = await syncMarkers()
  } catch (err) {
    if (err instanceof SyncError && err.reason === 'map_not_ready') {
      showMapNotReadyBanner()
    }
  }

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

  let progressBar!: ProgressBar
  let statusPanel!: StatusPanel
  let gpsDrivePanel: GpsDrivePanel | null = null

  const distanceWarningEl = document.getElementById('distance-warning')!
  let distanceWarningTimer: ReturnType<typeof setTimeout> | null = null
  function showDistanceWarning(distM: number): void {
    distanceWarningEl.textContent = `⚠ Merkki kaukana reitistä (${Math.round(distM)} m)`
    distanceWarningEl.style.display = 'block'
    if (distanceWarningTimer) clearTimeout(distanceWarningTimer)
    distanceWarningTimer = setTimeout(() => { distanceWarningEl.style.display = 'none' }, 4000)
  }

  const segmentStore = createSegmentStore()
  const segmentOverlay = new SegmentOverlay(map, routes)
  const segmentPanel = new SegmentPanel(
    document.getElementById('segment-panel-container')!,
    routes,
    segmentStore,
    () => segmentOverlay.update(segmentStore),
  )

  let segmentView: SegmentView | null = null

  const markerManager = new MarkerManager(map, routes, () => {
    renderMarkerList(markerManager)
    progressBar.refreshDots()
    statusPanel?.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))
    if (segmentView) {
      const seg = talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) : undefined
      if (seg) segmentView.update(getMarkersForSegment(seg, markerManager.getAll()))
    }
  }, initialMarkers, showDistanceWarning)

  if (talkoolainenCode) {
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (seg) {
      segmentView = new SegmentView(
        document.getElementById('segment-view-container')!,
        seg,
        (updated) => {
          for (const m of updated) markerManager.updateStatus(m.id, 'kerää')
        },
      )
      segmentView.update(getMarkersForSegment(seg, markerManager.getAll()))
    }
  }

  const driveMode = new DriveMode(map, routes[0].routePoints, km => {
    progressBar.update(km)
    gpsDrivePanel?.update(km)
  })

  const routeBar = new RouteBar(
    routes, polylines, map, driveMode, markerManager,
    document.getElementById('route-selector')!,
    document.getElementById('route-track-fill') as HTMLElement,
    () => { progressBar.update(0); progressBar.refreshDots() },
  )

  progressBar = new ProgressBar(
    () => routeBar.getActiveRoute(),
    () => routeBar.getActiveTotalM(),
    driveMode,
    markerManager,
  )
  progressBar.update(0)

  gpsDrivePanel = new GpsDrivePanel(
    document.getElementById('gps-drive-panel')!,
    driveMode,
    markerManager,
    () => routeBar.getActiveRoute().id,
  )
  gpsDrivePanel.update(0)

  statusPanel = new StatusPanel(document.getElementById('status-panel')!)
  statusPanel.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))

  const placeMode = new PlaceMode(markerManager)

  // Marker modal
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  const openMarkerModal = (highlightId?: string) => {
    renderMarkerList(markerManager, highlightId)
    markerModalBackdrop.classList.add('open')
    markerModal.classList.add('open')
  }
  const closeMarkerModal = () => {
    markerModalBackdrop.classList.remove('open')
    markerModal.classList.remove('open')
  }

  document.getElementById('btn-list')!.addEventListener('click', () => openMarkerModal())
  document.getElementById('btn-modal-close')!.addEventListener('click', closeMarkerModal)
  markerModalBackdrop.addEventListener('click', closeMarkerModal)
  markerModal.addEventListener('click', e => e.stopPropagation())

  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())

  // Map events
  map.doubleClickZoom.disable()
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (segmentPanel.isCreationMode()) {
      segmentPanel.onMapClick(e.latlng.lat, e.latlng.lng)
      return
    }
    if (placeMode.isPickerOpen())   { placeMode.closePicker();   return }
    if (placeMode.isDropdownOpen()) { placeMode.closeDropdown(); return }
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; return }
    clickTimer = setTimeout(() => {
      clickTimer = null
      placeMode.onMapClick(e.latlng.lat, e.latlng.lng)
    }, 250)
  })

  map.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null }
    placeMode.exit()
    placeMode.closeDropdown()
    const orig = (e as any).originalEvent as MouseEvent
    placeMode.openPicker(e.latlng.lat, e.latlng.lng, orig.clientX, orig.clientY)
  })

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (placeMode.isPickerOpen())   { placeMode.closePicker();   return }
      if (placeMode.isDropdownOpen()) { placeMode.closeDropdown(); return }
      if (placeMode.isActive())       { placeMode.exit();          return }
      if (markerModal.classList.contains('open')) { closeMarkerModal(); return }
      if (driveMode.isActive()) { driveMode.stop(); progressBar.update(0) }
      return
    }
    if (!driveMode.isActive()) return
    if (e.key === 'ArrowRight') { e.preventDefault(); driveMode.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); driveMode.prev() }
  })
}

const authScreen = new AuthScreen(({ role, code }) => {
  setRole(role)
  new RoleSelector(
    document.getElementById('btn-role') as HTMLButtonElement,
    applyRoleView,
  )
  new MapStateBadge(document.getElementById('toolbar')!, role)
  new SnapshotPanel(document.getElementById('snapshot-panel-container')!, role)
  init(code).catch(console.error)
})
authScreen.start().catch(console.error)
