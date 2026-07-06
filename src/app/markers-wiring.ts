import type L from 'leaflet'
import { MarkerManager } from '../map/markers'
import { DriveMode } from '../map/drive'
import { RouteBar } from '../map/route-bar'
import { ProgressBar } from '../ui/progress-bar'
import { PlaceMode } from '../ui/place-mode'
import { renderMarkerList } from '../ui/marker-list'
import { GpsDrivePanel } from '../ui/gps-drive-panel'
import { SegmentView } from '../ui/segment-view'
import { SignLibraryPanel, createSignLibrary } from '../ui/sign-library-panel'
import { saveLibrary, type SignLibrary } from '../logic/sign-library'
import { StatusPanel } from '../ui/status-panel'
import { calcAllRouteStatus } from '../logic/route-status'
import { getRole } from '../logic/role'
import { MarkerDetailModal } from '../ui/marker-detail-modal'
import { getSegmentForCode, getMarkersForSegment, updateSegment } from '../logic/segments'
import type { Segment } from '../logic/segments'
import { updateSegmentRemote } from '../logic/segment-sync'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import type { SegmentPanel } from '../ui/segment-panel'

export interface MarkersWiring {
  markerManager: MarkerManager
  driveMode: DriveMode
  routeBar: RouteBar
  progressBar: ProgressBar
  placeMode: PlaceMode
  markerModal: HTMLElement
  closeMarkerModal: () => void
}

interface MarkersWiringDeps {
  segmentStore: Map<string, Segment>
  renderSegmentOverlay: () => void
  segmentPanel: SegmentPanel
  showWarning: (msg: string, ms?: number) => void
}

// T85-T105/T140-T152: merkkien sijoitus, tila, ajotila, tarkastusnäkymä ja liittyvä UI.
// Suurin lohko init()-orkestroinnista — merkkejä käsittelevä osuus koskettaa myös
// pätkän status-päivitystä (renderSegmentOverlay) ja tarkastusnäkymää (talkoolainen),
// koska ne kuuntelevat MarkerManagerin onUpdate-tapahtumaa (sama kuin ennen pilkkoa).
export function wireMarkers(
  map: L.Map,
  routes: RouteConfig[],
  polylines: L.Polyline[],
  initialMarkers: SignMarker[],
  talkoolainenCode: string | undefined,
  deps: MarkersWiringDeps,
): MarkersWiring {
  const { segmentStore, renderSegmentOverlay, segmentPanel, showWarning } = deps

  let progressBar!: ProgressBar
  let statusPanel!: StatusPanel
  let gpsDrivePanel: GpsDrivePanel | null = null
  let segmentView: SegmentView | null = null
  let signLibrary: SignLibrary | null = null

  // Forward declaration — modaali luodaan vasta markerManagerin jälkeen
  let markerDetailModal: MarkerDetailModal | null = null
  const onOpenMarkerDetail = (id: string) => {
    markerManager.panTo(id)
    markerDetailModal?.open(id)
  }

  const markerManager = new MarkerManager(map, routes, () => {
    renderMarkerList(markerManager, undefined, undefined, signLibrary, onOpenMarkerDetail)
    progressBar.refreshDots()
    statusPanel?.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))
    segmentPanel.refreshCounts()
    // T152/V96: merkin status-muutos päivittää myös kartan pätkän viivatyylin (ei vain sivupalkkia)
    renderSegmentOverlay()
    if (segmentView) {
      const seg = talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) : undefined
      if (seg) segmentView.update(getMarkersForSegment(seg, markerManager.getAll()))
    }
  }, initialMarkers, distM => showWarning(`⚠ Merkki kaukana reitistä (${Math.round(distM)} m)`))

  markerDetailModal = new MarkerDetailModal(
    markerManager,
    () => signLibrary,
    getRole,
    () => {
      renderMarkerList(markerManager, undefined, undefined, signLibrary, onOpenMarkerDetail)
      progressBar.refreshDots()
    },
  )
  markerManager.setOnMarkerClick((id) => onOpenMarkerDetail(id))

  if (talkoolainenCode) {
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (seg) {
      segmentView = new SegmentView(
        document.getElementById('segment-view-container')!,
        seg,
        (updated) => {
          for (const m of updated) markerManager.updateStatus(m.id, 'kerää')
        },
        (inspected, note) => {
          const updatedSeg = updateSegment(segmentStore, seg.id, { inspected, inspectionNote: note || undefined })
          // T149/V93: tarkastuskuittaus EI saa hävitä hiljaa — false-paluu tai reject → virhebanneri
          const flagInspectError = () => showWarning('⚠ Tarkastuskuittauksen tallennus epäonnistui — yritä uudelleen', 5000)
          updateSegmentRemote(seg.id, { inspected, inspectionNote: note || undefined })
            .then(ok => { if (!ok) flagInspectError() })
            .catch(() => flagInspectError())
          if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll()), updatedSeg)
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

  if (talkoolainenCode) {
    gpsDrivePanel = new GpsDrivePanel(
      document.getElementById('gps-drive-panel')!,
      driveMode,
      markerManager,
      () => routeBar.getActiveRoute().id,
    )
    gpsDrivePanel.update(0)
  }

  statusPanel = new StatusPanel(document.getElementById('status-panel')!)
  statusPanel.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))

  signLibrary = createSignLibrary()
  const placeMode = new PlaceMode(markerManager, signLibrary)
  const signLibraryContainer = document.getElementById('sign-type-dropdown')
  if (signLibraryContainer) {
    new SignLibraryPanel(signLibraryContainer, signLibrary, () => saveLibrary(signLibrary), (t) => placeMode.armFromSidebar(t))
  }

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
    renderMarkerList(markerManager, highlightId, segmentMarkerIds, signLibrary, onOpenMarkerDetail)
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

  return { markerManager, driveMode, routeBar, progressBar, placeMode, markerModal, closeMarkerModal }
}
