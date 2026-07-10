import type L from 'leaflet'
import { MarkerManager } from '../map/markers'
import { DriveMode } from '../map/drive'
import { RouteBar } from '../map/route-bar'
import { RouteVisibilityControl } from '../map/route-visibility-control'
import { ProgressBar } from '../ui/progress-bar'
import { PlaceMode } from '../ui/place-mode'
import { renderMarkerList } from '../ui/marker-list'
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
import { planSegmentZoom } from '../logic/segment-zoom'
import { firstUnsetMarker, nextMarkerAhead } from '../logic/navigation'
import { NextMarkerHighlight } from '../map/next-marker-highlight'
import type { GpsNavigator } from '../map/gps-navigator'
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
  // T232 (B): GPS-navigaattori (luotu map-init.ts:ssä) → talkoolaisen SegmentView-heron GPS-toggle.
  gpsNavigator: GpsNavigator
}

// T224 (D): latauksessa zoomaa talkoolaisen OMAAN pätkään ("tässä on sun pätkä"), ei koko karttaan.
// planSegmentZoom päättää fit vs anchor (pitkä pätkä → aloita alkupäästä). Boundit route-slicestä;
// jos slice tyhjä (reititön/harva data) → fallback pätkän merkkien latlngeihin.
function fitMapToSegment(map: L.Map, routes: RouteConfig[], seg: Segment, segMarkers: SignMarker[]): void {
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
  const { segmentStore, renderSegmentOverlay, segmentPanel, showWarning, gpsNavigator } = deps

  let progressBar!: ProgressBar
  let statusPanel!: StatusPanel
  let segmentView: SegmentView | null = null
  let signLibrary: SignLibrary | null = null
  let nextHighlight: NextMarkerHighlight | null = null

  // T224 (b1): korosta pätkän seuraava asettamaton merkki kartalla (vain asettaminen-phase).
  function updateNextHighlight(seg: Segment, segMarkers: SignMarker[]): void {
    if (!nextHighlight) return
    const next = seg.phase === 'asettaminen' ? firstUnsetMarker(segMarkers) : null
    if (next) nextHighlight.set(next.lat, next.lon)
    else nextHighlight.clear()
  }

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
      if (seg) {
        const segMarkers = getMarkersForSegment(seg, markerManager.getAll())
        // T232 (F)/V159: segmentView.update() → renderNext → onNavigate synkkaa kartan korostuksen
        // hero:n VALITTUUN merkkiin (◀▶-selailu huomioiden). EI erillistä updateNextHighlightia tässä
        // — se osoittaisi aina firstUnsetMarkeriin ja ohittaisi selatun valinnan (epäjohdonmukainen).
        segmentView.update(segMarkers)
      }
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
    // T225/V151: talkoolaisen oma koodi → kova-poisto vain oman itse-luoman merkin kohdalla.
    () => talkoolainenCode,
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
        {
          // "Seuraava merkki" -ohjaus: aseta/ohita etenee pätkän merkit järjestyksessä (V9/V3).
          // markerManager.onUpdate → currentSegmentMarkerIds() + segmentView.update() re-render.
          onSetMarker: (id) => markerManager.updateStatus(id, 'aseta'),
          onSkipMarker: (id) => markerManager.updateStatus(id, 'ohita'),
          onFocusMarker: (id) => onOpenMarkerDetail(id),
          // "Näytä kartalla": panoroi ilman modaalia (näkymä kutistuu → kartta esiin)
          onShowOnMap: (id) => markerManager.panTo(id),
          // T228: "Laita kommentti" hero-overflowsta → avaa detail-modaalin (Kommentti-kenttä,
          // updateNote → location_note-PUT, server sallii omalle pätkälle V93). Per-merkki-kommentti
          // löydettäväksi herosta — geneerinen kommentti (pätkä/vapaa piste) on eri asia (T221).
          onComment: (id) => onOpenMarkerDetail(id),
          // T222: "Siirretty" hero-overflowsta → panoroi merkkiin + ohje. Varsinainen siirto =
          // raahaus kartalla (vain oman pätkän merkit draggable, V150). Backend sallii oman pätkän
          // sijaintimuutoksen range-sisällä (V150b).
          onMoveMarker: (id) => {
            markerManager.panTo(id)
            showWarning('Raahaa merkkiä kartalla uuteen paikkaan — muutos tallentuu', 4000)
          },
          // T78/V43: talkoolainen muokkaa oman pätkän rajoja kentällä. Server sallii (V93:
          // talkoolainen_code === assigned_code). Päivitä store + backend + kartta + näkymä.
          onEditBounds: (startDist, endDist) => {
            const updatedSeg = updateSegment(segmentStore, seg.id, { startDist, endDist })
            const flagErr = () => showWarning('⚠ Pätkän rajojen tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, { startDist, endDist })
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) {
              renderSegmentOverlay()
              segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll()), updatedSeg)
              // T222/V150: rajat muuttuivat → oma merkki-setti muuttuu → päivitä raahattavuus.
              markerManager.setDraggablePredicate(m => currentSegmentMarkerIds()?.has(m.id) ?? false)
            }
          },
          // T224 (C)/V38/V93: talkoolainen muokkaa oman pätkän varustelistaa (valmisteluvaihe).
          // Sama tallennuspolku kuin rajoilla: store + backend + näkymä-refresh.
          onEquipmentChange: (equipment) => {
            const updatedSeg = updateSegment(segmentStore, seg.id, { equipment })
            const flagErr = () => showWarning('⚠ Varustelistan tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, { equipment })
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll()), updatedSeg)
          },
          // T230/V93: talkoolainen merkitsee pätkän valmiiksi (asettaminen/purku). Sama tallennuspolku.
          onComplete: (completed) => {
            const updatedSeg = updateSegment(segmentStore, seg.id, { completed })
            const flagErr = () => showWarning('⚠ Pätkän valmiiksi-merkinnän tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, { completed })
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) {
              renderSegmentOverlay()
              segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll()), updatedSeg)
            }
          },
          // T232 (B)/V156: GPS-toggle herosta (siirretty yläpalkista). Ohjaa GpsNavigatoria (T30,
          // oma sijainti) — ERILLINEN driveModesta. Palauttaa uuden aktiivitilan napin ilmeeseen.
          onToggleGps: () => {
            if (gpsNavigator.isActive()) { gpsNavigator.stop(); return false }
            gpsNavigator.start(); return true
          },
          isGpsActive: () => gpsNavigator.isActive(),
          // T232 (F)/V159: hero:n valittu merkki (◀▶-selailu/reconcile) → synkkaa kartan korostus.
          // null = ei valittua (done/väärä phase) → tyhjennä. Korostus SEURAA valintaa, ei suoraan
          // firstUnsetMarkeria (estää "highlight osoittaa eri merkkiin kuin hero" -epäjohdonmukaisuuden).
          onNavigate: (id) => {
            if (!nextHighlight) return
            if (!id) { nextHighlight.clear(); return }
            const m = markerManager.getAll().find(x => x.id === id)
            if (m) nextHighlight.set(m.lat, m.lon)
            else nextHighlight.clear()
          },
          // T232 (E)/T229: "+ Merkki" hero-overflowsta → sign-picker kartan keskelle (POST omalle
          // pätkälle V149). Sama polku kuin yläpalkin #btn-add-marker (poistuu T233).
          onAddMarker: () => {
            const c = map.getCenter()
            placeMode.openPicker(c.lat, c.lng, window.innerWidth / 2, window.innerHeight / 2)
          },
          // T218/V143 (skenaario 2): keräyslistan "Haettu"-kuittaus. Suora status-asetus (EI 'kerää'-
          // action, joka heittää suunniteltu-tilaisille — sama syy kuin bulkCollect yllä). Kuka tahansa
          // autentikoitu, ei ownership-gatea; kerätty ↔ suunniteltu. bulkSetStatus persistoi + onUpdate.
          onCollectMarker: (id, collected) => markerManager.bulkSetStatus([id], collected ? 'kerätty' : 'suunniteltu'),
        },
      )
      const segMarkers0 = getMarkersForSegment(seg, markerManager.getAll())
      segmentView.update(segMarkers0)
      // T224 (D): "tässä on sun pätkä" — zoomaa pätkään heti latauksessa.
      fitMapToSegment(map, routes, seg, segMarkers0)
      // T224 (b1): korosta seuraava asettamaton merkki kartalla (kartta = päänavigointi).
      nextHighlight = new NextMarkerHighlight(map)
      updateNextHighlight(seg, segMarkers0)
      // T222/V150: vain oman pätkän merkit raahattavia — vieraita ei voi siirtää (backend 403).
      markerManager.setDraggablePredicate(m => currentSegmentMarkerIds()?.has(m.id) ?? false)
    }
  }

  const driveMode = new DriveMode(map, routes[0].routePoints, km => {
    progressBar.update(km)
  })

  // T204/V134: RouteBar-jako. Talkoolainen saa täyden drive-kontrollin (RouteBar: reittivalinta
  // + ◀▶-nuolet + km-scrubber); järjestäjä saa vain kevyen näytä/piilota-reittivalitsimen
  // (RouteVisibilityControl). Drive-DOM (scrubber, ◀▶) renderöityy VAIN talkoolaiselle —
  // piilotetaan järjestäjältä. (GpsDrivePanel poistettu T224/V148 — hero on ainoa ohjaus.)
  const isTalkoolainen = getRole() === 'talkoolainen'
  let routeBar: RouteBar | null = null
  let routeVis: RouteVisibilityControl | null = null
  const routeSelectorEl = document.getElementById('route-selector')!

  if (isTalkoolainen) {
    // T224 (A/V148): talkoolaisen alapalkki (`#route-bar`) POISTETTU kokonaan — se ei tuonut
    // arvoa pätkäkeskeisessä flowssa (hero + kartta + "Kaikki merkit"/"Varustelista" -napit riittää).
    // RouteBar luodaan yhä driveMode-reitin + activeRouteProviderin vuoksi, mutta itse palkki
    // piilotetaan. (◀▶/scrubber ohjasi koko reittiä, ei pätkää → hämäävä; pois näkyvistä.)
    routeBar = new RouteBar(
      routes, polylines, map, driveMode, markerManager,
      routeSelectorEl,
      document.getElementById('route-track-fill') as HTMLElement,
      () => { progressBar.update(0); progressBar.refreshDots() },
    )
    document.getElementById('route-bar')?.setAttribute('hidden', '')
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

  // T224 (F)/V148: talkoolaisen seuraava-merkki-ohjaus asuu YKSIN SegmentView-herossa (ylhäällä).
  // Vanha alapalkin GpsDrivePanel (⇒ Seuraava / ✓ Aseta / Ei tarpeen) poistettu duplikaationa —
  // hero on ainoa Aseta/ohjaa-kontrolli. Oikea GPS-geolokaatio elää erikseen (gps-navigator.ts).

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

  // T233/V155: talkoolaisen yläpalkin "🎒 Varustelista" → avaa SegmentView:n EquipmentModal
  // (siirretty pois pätkänäkymän panelista, ettei kilpaile hero-primaryn kanssa). Nappi vain
  // talkoolaiselle (data-role-hide="järjestäjä"). Merkin-lisäys (T229) siirtyi hero-overflowiin.
  document.getElementById('btn-varuste')?.addEventListener('click', () => segmentView?.openEquipment())

  document.getElementById('btn-modal-close')!.addEventListener('click', closeMarkerModal)
  markerModalBackdrop.addEventListener('click', closeMarkerModal)
  markerModal.addEventListener('click', e => e.stopPropagation())

  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())

  // T39: "hyppää seuraavaan merkkiin" — siirtää driveMode-kursorin seuraavan merkin
  // distanceFromStart-kohtaan aktiivisella reitillä (edessäpäin). Ei GPS-riippuvainen — käyttää
  // vain merkin distanceFromStart-arvoa (nextMarkerAhead) + driveMode.jumpToDistance. Jos edessä
  // ei ole merkkiä, ei tehdä mitään (kursori jää paikalleen).
  document.getElementById('btn-route-next-marker')?.addEventListener('click', () => {
    const route = activeRouteProvider()
    const currentDistM = driveMode.currentKm() * 1000
    const target = nextMarkerAhead(markerManager.getAll(), currentDistM, route.id)
    if (target) driveMode.jumpToDistance(target.distanceFromStart)
  })

  return { markerManager, driveMode, routeBar, progressBar, placeMode, markerModal, closeMarkerModal }
}
