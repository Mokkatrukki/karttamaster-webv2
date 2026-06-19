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
import { fetchMarkers } from './logic/sync'
import { SnapshotPanel } from './ui/snapshot-panel'
import { StatusPanel } from './ui/status-panel'
import { calcAllRouteStatus } from './logic/route-status'
import { setRole } from './logic/role'
import { GpsNavigator } from './map/gps-navigator'
import { GpsDrivePanel } from './ui/gps-drive-panel'
import { SegmentOverlay } from './map/segment-overlay'
import { SegmentPanel } from './ui/segment-panel'
import { SegmentView } from './ui/segment-view'
import { LeftPanel } from './ui/left-panel'
import { getSegmentForCode, getMarkersForSegment } from './logic/segments'
import type { Segment } from './logic/segments'
import { fetchSegmentByCode, fetchAllSegments } from './logic/segment-sync'
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

const toolbarMenu = document.getElementById('toolbar-menu')!

const leftPanelEl = document.getElementById('left-panel')
const leftPanel = leftPanelEl ? new LeftPanel(leftPanelEl) : null

document.getElementById('btn-menu')?.addEventListener('click', e => {
  e.stopPropagation()
  toolbarMenu.classList.toggle('open')
})
document.addEventListener('click', () => {
  toolbarMenu.classList.remove('open')
})

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

  const segmentStore = new Map<string, Segment>()
  if (talkoolainenCode) {
    const remote = await fetchSegmentByCode(talkoolainenCode)
    if (remote) segmentStore.set(remote.id, remote)
  } else {
    const all = await fetchAllSegments()
    for (const seg of all) segmentStore.set(seg.id, seg)
  }

  const segmentOverlay = new SegmentOverlay(map, routes)

  let tempCreationMarker: L.CircleMarker | null = null

  const segmentSaveErrorEl = document.getElementById('distance-warning')!
  const markerManagerRef: { current: MarkerManager | null } = { current: null }

  const segmentPanel = new SegmentPanel(
    document.getElementById('segment-panel-container')!,
    routes,
    segmentStore,
    () => segmentOverlay.update(segmentStore),
    {
      onFirstPoint: (lat, lon) => {
        tempCreationMarker?.remove()
        tempCreationMarker = L.circleMarker([lat, lon], {
          radius: 9, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.85, weight: 2,
          className: 'segment-creation-marker',
        }).addTo(map)
      },
      onFirstPointClear: () => {
        tempCreationMarker?.remove()
        tempCreationMarker = null
      },
      onEnterEditMode: (seg, onSave) => segmentOverlay.enterEditMode(seg, onSave),
      onExitEditMode: () => segmentOverlay.exitEditMode(),
      onSaveError: () => {
        segmentSaveErrorEl.textContent = '⚠ Pätkän tallennus epäonnistui (muisti täynnä?)'
        segmentSaveErrorEl.style.display = 'block'
        setTimeout(() => { segmentSaveErrorEl.style.display = 'none' }, 5000)
      },
      getMarkers: () => markerManagerRef.current?.getAll() ?? [],
    },
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
  markerManagerRef.current = markerManager

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

  const placeMode = new PlaceMode(markerManager, leftPanel ? () => leftPanel.open() : undefined)

  // Marker modal
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  const openMarkerModal = (highlightId?: string) => {
    let segmentMarkerIds: Set<string> | undefined
    if (talkoolainenCode) {
      const seg = getSegmentForCode(segmentStore, talkoolainenCode)
      if (seg) {
        segmentMarkerIds = new Set(getMarkersForSegment(seg, markerManager.getAll()).map(m => m.id))
      }
    }
    renderMarkerList(markerManager, highlightId, segmentMarkerIds)
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
      if (segmentPanel.isCreationMode()) { segmentPanel.cancelCreation(); return }
      if (segmentOverlay.isEditMode())   { segmentOverlay.exitEditMode(); return }
      if (placeMode.isPickerOpen())      { placeMode.closePicker();   return }
      if (placeMode.isDropdownOpen())    { placeMode.closeDropdown(); return }
      if (placeMode.isActive())          { placeMode.exit();          return }
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

function applyRoleHide(role: string): void {
  document.querySelectorAll<HTMLElement>('[data-role-hide]').forEach(el => {
    if (el.dataset.roleHide === role) el.hidden = true
  })
}

const authScreen = new AuthScreen(({ role, code }) => {
  setRole(role)
  applyRoleHide(role)
  new RoleSelector(
    document.getElementById('btn-role') as HTMLButtonElement,
    applyRoleView,
    role,
  )
  const snapshotPanel = new SnapshotPanel(role)
  document.getElementById('btn-snapshot-panel')?.addEventListener('click', (e) => {
    e.stopPropagation()
    snapshotPanel.open()
    toolbarMenu.classList.remove('open')
  })
  init(code).catch(console.error)
})
authScreen.start().catch(console.error)
