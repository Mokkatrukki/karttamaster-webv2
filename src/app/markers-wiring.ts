import type L from 'leaflet'
import { MarkerManager } from '../map/markers'
import { DriveMode } from '../map/drive'
import { RouteBar } from '../map/route-bar'
import { RouteVisibilityControl } from '../map/route-visibility-control'
import { ProgressBar } from '../ui/progress-bar'
import { PlaceMode } from '../ui/place-mode'
import { renderMarkerList } from '../ui/marker-list'
import { GpsDrivePanel } from '../ui/gps-drive-panel'
import { SegmentView } from '../ui/segment-view'
import { SignLibraryPanel, createSignLibrary } from '../ui/sign-library-panel'
import { saveLibrary, type SignLibrary, type SignTemplate } from '../logic/sign-library'
import { fetchTemplates, createTemplateRemote, updateTemplateRemote, deleteTemplateRemote } from '../logic/template-sync'
import { StatusPanel } from '../ui/status-panel'
import { calcAllRouteStatus } from '../logic/route-status'
import { getRole } from '../logic/role'
import { MarkerDetailModal } from '../ui/marker-detail-modal'
import { getSegmentForCode, getMarkersForSegment, updateSegment } from '../logic/segments'
import type { Segment } from '../logic/segments'
import { updateSegmentRemote } from '../logic/segment-sync'
import { outbox, setOutboxChangeHandler } from '../logic/outbox-instance'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import type { SegmentPanel } from '../ui/segment-panel'

export interface MarkersWiring {
  markerManager: MarkerManager
  driveMode: DriveMode
  routeBar: RouteBar | null
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

  // T185/V117: outbox-resurssiavaimista ('marker:<id>') pending-merkkien id-joukko listalle.
  const markerPendingIds = (): Set<string> =>
    new Set([...outbox.pendingResourceKeys()].filter(k => k.startsWith('marker:')).map(k => k.slice('marker:'.length)))

  // V33/V142 (B-lista1): talkoolaisen merkkilista näyttää VAIN oman pätkän merkit — myös
  // re-renderissä (status-muutos, outbox-vahvistus, modaalin refresh). Aiemmin re-render-
  // callbackit välittivät segmentMarkerIds=undefined → lista palasi näyttämään kaikki reitin
  // merkit heti ensimmäisen muutoksen jälkeen. Järjestäjälle undefined = kaikki merkit (oikein).
  const currentSegmentMarkerIds = (): Set<string> | undefined => {
    if (!talkoolainenCode) return undefined
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (!seg) return undefined
    return new Set(getMarkersForSegment(seg, markerManager.getAll()).map(m => m.id))
  }

  // Forward declaration — modaali luodaan vasta markerManagerin jälkeen
  let markerDetailModal: MarkerDetailModal | null = null
  const onOpenMarkerDetail = (id: string) => {
    markerManager.panTo(id)
    markerDetailModal?.open(id)
  }

  const markerManager = new MarkerManager(map, routes, () => {
    renderMarkerList(markerManager, undefined, currentSegmentMarkerIds(), signLibrary, onOpenMarkerDetail, markerPendingIds())
    progressBar.refreshDots()
    statusPanel?.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))
    segmentPanel.refreshCounts()
    // T152/V96: merkin status-muutos päivittää myös kartan pätkän viivatyylin (ei vain sivupalkkia)
    renderSegmentOverlay()
    if (segmentView) {
      const seg = talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) : undefined
      if (seg) segmentView.update(getMarkersForSegment(seg, markerManager.getAll()))
    }
  }, initialMarkers, distM => showWarning(`⚠ Merkki kaukana reitistä (${Math.round(distM)} m)`), msg => showWarning(msg, 5000))

  markerDetailModal = new MarkerDetailModal(
    markerManager,
    () => signLibrary,
    getRole,
    () => {
      renderMarkerList(markerManager, undefined, currentSegmentMarkerIds(), signLibrary, onOpenMarkerDetail, markerPendingIds())
      progressBar.refreshDots()
    },
  )
  markerManager.setOnMarkerClick((id) => onOpenMarkerDetail(id))

  // T185/V117: outbox-jonon muutos → päivitä kartan pending-korostus + listan "tallentamatta".
  // Käsittelijä kattaa myös 2xx-vahvistuksen (avain poistuu → korostus katoaa).
  setOutboxChangeHandler((keys) => {
    markerManager.setPendingKeys(keys)
    renderMarkerList(markerManager, undefined, currentSegmentMarkerIds(), signLibrary, onOpenMarkerDetail, markerPendingIds())
  })
  // Edellisen session vahvistamattomat kirjoitukset voivat olla vielä jonossa käynnistyessä.
  markerManager.setPendingKeys(outbox.pendingResourceKeys())

  if (talkoolainenCode) {
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (seg) {
      segmentView = new SegmentView(
        document.getElementById('segment-view-container')!,
        seg,
        (updated) => {
          // V28 (B-lista3): bulkCollect palauttaa merkit jo 'kerätty'-tilassa. Käytä suoraa
          // bulkSetStatus-asetusta — EI 'kerää'-actionia, joka heittää "Virheellinen siirtymä"
          // suunniteltu/ei_tarpeen-merkeille (uncaught throw, osittainen päivitys, ei banneria).
          markerManager.bulkSetStatus(updated.map(m => m.id), 'kerätty')
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

  // T204/V134: RouteBar-jako. Talkoolainen saa täyden drive-kontrollin (RouteBar: reittivalinta
  // + ◀▶-nuolet + km-scrubber); järjestäjä saa vain kevyen näytä/piilota-reittivalitsimen
  // (RouteVisibilityControl). Drive-DOM (scrubber, gps-drive-panel, ◀▶) renderöityy VAIN
  // talkoolaiselle — piilotetaan järjestäjältä.
  const isTalkoolainen = getRole() === 'talkoolainen'
  let routeBar: RouteBar | null = null
  let routeVis: RouteVisibilityControl | null = null
  const routeSelectorEl = document.getElementById('route-selector')!

  if (isTalkoolainen) {
    routeBar = new RouteBar(
      routes, polylines, map, driveMode, markerManager,
      routeSelectorEl,
      document.getElementById('route-track-fill') as HTMLElement,
      () => { progressBar.update(0); progressBar.refreshDots() },
    )
  } else {
    routeVis = new RouteVisibilityControl(routes, polylines, map, markerManager, routeSelectorEl)
    // Piilota drive-osat järjestäjältä (V134)
    document.getElementById('route-track')?.setAttribute('hidden', '')
    document.getElementById('route-drive-controls')?.setAttribute('hidden', '')
    document.getElementById('route-km')?.setAttribute('hidden', '')
    document.getElementById('route-bar')?.setAttribute('data-mode', 'visibility')
  }

  const activeRouteProvider = () => (routeBar ?? routeVis!).getActiveRoute()
  const activeTotalProvider = () => (routeBar ?? routeVis!).getActiveTotalM()

  progressBar = new ProgressBar(
    activeRouteProvider,
    activeTotalProvider,
    driveMode,
    markerManager,
  )
  progressBar.update(0)

  if (isTalkoolainen) {
    gpsDrivePanel = new GpsDrivePanel(
      document.getElementById('gps-drive-panel')!,
      driveMode,
      markerManager,
      () => activeRouteProvider().id,
      // B-lista2: rajaa navigointi oman pätkän merkkeihin (ei koko reitin)
      () => {
        const seg = talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) : undefined
        return seg ? getMarkersForSegment(seg, markerManager.getAll()) : markerManager.getAll()
      },
    )
    gpsDrivePanel.update(0)
  }

  statusPanel = new StatusPanel(document.getElementById('status-panel')!)
  statusPanel.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))

  signLibrary = createSignLibrary()
  const placeMode = new PlaceMode(markerManager, signLibrary)
  const signLibraryContainer = document.getElementById('sign-type-dropdown')
  let signLibraryPanel: SignLibraryPanel | null = null
  if (signLibraryContainer) {
    signLibraryPanel = new SignLibraryPanel(
      signLibraryContainer,
      signLibrary,
      () => saveLibrary(signLibrary),
      (t) => placeMode.armFromSidebar(t),
      // T193/V123: luonti/päivitys → backend outboxin kautta (jaettu kaikille järjestäjille)
      (template: SignTemplate, isNew: boolean) => {
        void (isNew ? createTemplateRemote(template) : updateTemplateRemote(template))
      },
      (id: string) => { void deleteTemplateRemote(id) },
    )
  }

  // T193/V123: backend on kirjaston totuus. Lataa mallit initissä ja korvaa cache-/seed-sisältö
  // in-place (Map-referenssi jaettu PlaceModelle + paneelille). Lataus-epäonnistuminen (V118) →
  // säilytä cache + varoita, älä tyhjennä kirjastoa hiljaa.
  void fetchTemplates().then((result) => {
    if (!signLibrary) return
    if (!result.ok) {
      showWarning('⚠ Merkkikirjaston lataus epäonnistui — näytetään paikallinen kopio', 5000)
      return
    }
    signLibrary.clear()
    for (const t of result.templates) signLibrary.set(t.id, t)
    saveLibrary(signLibrary)
    signLibraryPanel?.refresh()
  })

  // Marker modal
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  const openMarkerModal = (highlightId?: string) => {
    renderMarkerList(markerManager, highlightId, currentSegmentMarkerIds(), signLibrary, onOpenMarkerDetail, markerPendingIds())
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
