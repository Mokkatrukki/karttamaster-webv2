import type L from 'leaflet'
import { MarkerManager } from '../map/markers'
import { DriveMode } from '../map/drive'
import { RouteBar } from '../map/route-bar'
import { RouteVisibilityControl } from '../map/route-visibility-control'
import { MapFilterBar } from '../ui/map-filter-bar'
import type { MapFilter } from '../logic/map-filter'
import { isolatedMarkerIds } from '../logic/map-filter'
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
import { getSegmentForCode, getMarkersForSegment, updateSegment, segmentPrimaryRouteId, segmentPeers } from '../logic/segments'
import { boundsPatch } from '../logic/segment-backfill'
import type { Segment } from '../logic/segments'
import { fitMapToSegment } from '../map/segment-fit'
import { firstUnsetMarker, distanceAhead } from '../logic/navigation'
import { CommentLayer, type CommentDraft } from '../map/comment-layer'
import { fetchComments, addCommentImage, updateComment, type Comment } from '../logic/comments'
import { CommentPointModal } from '../ui/comment-point-modal'
import { CommentPanel } from '../ui/comment-panel'
import type { GpsNavigator, GpsState } from '../map/gps-navigator'
import { updateSegmentRemote } from '../logic/segment-sync'
import { outbox, setOutboxChangeHandler } from '../logic/outbox-instance'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import type { SegmentPanel } from '../ui/segment-panel'
import { mapMode, type MapMode, type MapModeState } from '../logic/map-mode'
import { initMapModeToggle } from '../ui/map-mode-toggle'

// T307/V218: `document.body.dataset.mapMode` asetetaan TÄSTÄ yhdestä paikasta (CSS-korostus
// T308 + E2E-assertit lukevat sen). UI-toggle EI kirjoita attribuuttia itse — se kutsuu
// `mapMode.toggle()` ja tämä kuuntelija heijastaa tilan DOM:iin ∴ yksi totuus.
// Idempotentti: uusi kutsu korvaa arvon, kuuntelija lisätään kertaalleen per wireMarkers.
export function syncMapModeToBody(state: MapModeState = mapMode): () => void {
  const apply = (m: MapMode): void => { document.body.dataset.mapMode = m }
  apply(state.get())
  return state.onChange(apply)
}

// T341/V247: talkoolaisen GPS-napin label yhdestä paikasta — hero (`.segment-view-gps-btn`) ja
// yläpalkin ⋯ (`#btn-tk-gps`) lukevat SAMAN GpsNavigator-tilan. Kaksi labelia = kaksi totuutta.
export function gpsButtonLabel(state: GpsState): string {
  if (state === 'päällä') return '📍 GPS päällä'
  if (state === 'haetaan') return '📍 Haetaan…'
  return '📍 GPS'
}

// T341/V247 (fix B133): GPS-toggle kytketään ROOLIN perusteella, EI pätkän olemassaolon.
// Oma sijainti on laitteen tieto ∴ jos tämä elää `if (seg)`-lohkon sisällä, nappi renderöityy
// kuuntelijatta aina kun pätkää ei löydy (lataus kaatui / koodilla ei pätkää) → klikkaus ei tee
// mitään eikä mikään kerro siitä. Paikannusvirhe ei myöskään saa olla hiljainen (V247).
export function wireGpsButton(
  gps: Pick<GpsNavigator, 'start' | 'stop' | 'getState'>,
  showWarning: (msg: string, ms?: number) => void,
): (state: GpsState, msg?: string) => void {
  const sync = (state: GpsState, msg?: string): void => {
    document.querySelectorAll<HTMLElement>('#btn-tk-gps, .segment-view-gps-btn').forEach(btn => {
      btn.textContent = gpsButtonLabel(state)
      btn.classList.toggle('gps-active', state !== 'pois')
    })
    if (msg) showWarning(`⚠ ${msg}`, 5000)
  }
  document.getElementById('btn-tk-gps')?.addEventListener('click', () => {
    if (gps.getState() !== 'pois') { gps.stop(); sync('pois'); return }
    gps.start(sync)
  })
  sync(gps.getState())
  return sync
}

export interface MarkersWiring {
  markerManager: MarkerManager
  driveMode: DriveMode
  routeBar: RouteBar | null
  progressBar: ProgressBar
  placeMode: PlaceMode
  markerModal: HTMLElement
  closeMarkerModal: () => void
  // T237(d)/V243: main.ts kytkee tämän segments-wiringin fokus-refiin.
  commentLayer: CommentLayer
  // T377/V272: suodatinbar — main.ts kytkee sen korostustilaan (isolointi).
  mapFilterBar: MapFilterBar | null
}

interface MarkersWiringDeps {
  segmentStore: Map<string, Segment>
  renderSegmentOverlay: () => void
  // T374/V269/B157: reittivalitsin asuu täällä, pätkäkerros segments-wiringissä ∴ näkyvyys
  // välitetään setterillä. `renderSegmentOverlay` piirtää uuden tilan.
  setSegmentVisibleRoutes: (ids: string[]) => void
  // T377/V271: suodatin päättää, kerrokset soveltavat — pätkäkerros elää segments-wiringissä.
  setSegmentMapFilter: (filter: MapFilter) => void
  // T377: isoloinnin nollaus barista sammuttaa korostuksen (yksi tila, ⊥ kaksi).
  clearFocusSegment: () => void
  segmentPanel: SegmentPanel
  showWarning: (msg: string, ms?: number) => void
  // T232 (B): GPS-navigaattori (luotu map-init.ts:ssä) → talkoolaisen SegmentView-heron GPS-toggle.
  gpsNavigator: GpsNavigator
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
  const {
    segmentStore, renderSegmentOverlay, segmentPanel, showWarning, gpsNavigator,
    setSegmentVisibleRoutes, setSegmentMapFilter, clearFocusSegment,
  } = deps

  let progressBar!: ProgressBar
  let statusPanel!: StatusPanel
  let segmentView: SegmentView | null = null
  let signLibrary: SignLibrary | null = null
  // T224 (b1)/T256: korosta pätkän seuraava asettamaton merkki kartalla (vain asettaminen-phase).
  // R6/V178: ikoni-hehku (.marker-next-highlight) renkaan sijaan → markerManager.setNextHighlight.
  function updateNextHighlight(seg: Segment, segMarkers: SignMarker[]): void {
    // T328/V237: sama akseli kuin herossa — akseli tulee PÄTKÄSTÄ, ei erillisenä parametrina,
    // muuten kartan korostus osoittaisi eri merkkiin kuin "Seuraava merkki" -palkki (B126).
    const next = seg.phase === 'asettaminen' ? firstUnsetMarker(segMarkers, seg) : null
    markerManager.setNextHighlight(next?.id ?? null)
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
    return new Set(getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg)).map(m => m.id))
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
        const segMarkers = getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg))
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

  // T335/V243: talkoolaisella korostus on AUTOMAATTI, ei kytkin — hän katsoo vain omaa pätkäänsä
  // (max 2 nappia -periaate: ei kolmatta valintaa metsässä). Sama omistajapäättely kuin
  // `segmentOverlay.setContextOwn` (segments-wiring) → yksi lähde, ei toisintoa.
  // locked: himmennetty ei ota klikkejä — talkoolaisen vieras merkki on read-only (V142).
  if (talkoolainenCode) {
    const own = getSegmentForCode(segmentStore, talkoolainenCode)
    if (own) markerManager.setFocusSegment(own, { locked: true, peers: segmentPeers(segmentStore, own) })
  }

  // T309/V221: siirron km-akseli = talkoolaisen oman pätkän PRIMARY-reitti (⊥ lähin reitti yli
  // kaikkien) → jaetulla osuudella merkki mitataan samasta reitistä kuin serverin
  // `markerInOwnSegment` ∴ ei putoa pätkästä liikkumatta käytännössä minnekään (B121, B100-oppi).
  // Järjestäjä (ei koodia) → undefined = MarkerManagerin fallback (merkin ENTINEN akseli).
  markerManager.setKmAxisRouteFn(() => {
    if (!talkoolainenCode) return undefined
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    return seg ? segmentPrimaryRouteId(seg) : undefined
  })

  // T307/V218 + T222/V150: raahattavuus = muokkaustila JA rooli-/pätkäehto. `baseDraggable`
  // pitää V150-ehdon (talkoolainen: vain oman pätkän merkit; järjestäjä: kaikki) ja
  // `applyDraggable` yhdistää sen moodiin. Kutsutaan (a) initissä, (b) kun pätkän rajat
  // muuttuvat (oma merkki-setti muuttuu), (c) kun moodi vaihtuu → merkit päivittyvät ILMAN
  // reloadia (setDraggablePredicate sovittaa jo piirretyt Leaflet-markerit heti).
  let baseDraggable: (m: SignMarker) => boolean = () => true
  const applyDraggable = (): void => {
    markerManager.setDraggablePredicate(m => mapMode.canDragMarkers() && baseDraggable(m))
  }
  mapMode.onChange(() => applyDraggable())
  applyDraggable()
  // Yksi paikka joka heijastaa moodin DOM:iin (CSS-korostus T308 lukee body[data-map-mode]).
  syncMapModeToBody()
  // T308/V219: toggle-napit (järjestäjä #btn-map-mode, talkoolainen ⋯ #btn-tk-map-mode) +
  // pysyvä "Muokkaustila"-pilleri. Sama tila molemmille rooleille (ei rooli-logiikkaa).
  initMapModeToggle()

  // T185/V117: outbox-jonon muutos → päivitä kartan pending-korostus + listan "tallentamatta".
  // Käsittelijä kattaa myös 2xx-vahvistuksen (avain poistuu → korostus katoaa).
  setOutboxChangeHandler((keys) => {
    markerManager.setPendingKeys(keys)
    renderMarkerList(markerManager, undefined, currentSegmentMarkerIds(), signLibrary, onOpenMarkerDetail, markerPendingIds())
  })
  // Edellisen session vahvistamattomat kirjoitukset voivat olla vielä jonossa käynnistyessä.
  markerManager.setPendingKeys(outbox.pendingResourceKeys())

  if (talkoolainenCode) {
    // T341/V247 (B133): GPS ENNEN pätkähakua — oma sijainti ei riipu pätkästä. Jos tämä
    // siirtyy `if (seg)`:n sisään, talkoolainen jää ilman GPS:ää aina kun pätkä puuttuu.
    const syncGpsLabel = wireGpsButton(gpsNavigator, showWarning)

    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (seg) {
      // T230/V93 + T257/R8: pätkän valmiiksi-merkintä. Jaettu SegmentView-heron (onComplete)
      // ja yläpalkin ⋯-toiminnon (R8) välillä — sama tallennuspolku (store + backend + refresh).
      const applyComplete = (completed: boolean) => {
        const updatedSeg = updateSegment(segmentStore, seg.id, { completed })
        const flagErr = () => showWarning('⚠ Pätkän valmiiksi-merkinnän tallennus epäonnistui — yritä uudelleen', 5000)
        updateSegmentRemote(seg.id, { completed })
          .then(ok => { if (!ok) flagErr() })
          .catch(() => flagErr())
        if (updatedSeg) {
          renderSegmentOverlay()
          segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
        }
      }
      // T232/E + T257/R8: "Lisää merkki" — sign-picker kartan keskelle (POST omalle pätkälle V149).
      const openAddMarkerPicker = () => {
        // T307/V218: napin painallus ON eksplisiittinen käyttäjätoimi (kielletty on automaattinen
        // siirtymä merkin/pätkän VALINNASTA) ∴ "+ Merkki" avaa muokkaustilan sen sijaan että
        // olisi hiljaa toimimaton. Tila näkyy heti (pilleri + kehys, T308) → käyttäjä tietää.
        if (!mapMode.canPlaceMarkers()) mapMode.set('muokkaus')
        const c = map.getCenter()
        placeMode.openPicker(c.lat, c.lng, window.innerWidth / 2, window.innerHeight / 2)
      }
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
          if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
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
            // T363/V258: rajat & JÄLKI muuttuvat yhdessä. Jälki ⊥ saa jäädä jälkeen — muuten
            // jäsenyys (V259) vastaisi rajaa jota ⊥ enää ole & talkoolainen näkisi merkkejä
            // jotka hän juuri rajasi pois (tai päinvastoin).
            const patch = boundsPatch(seg, routes, startDist, endDist)
            const updatedSeg = updateSegment(segmentStore, seg.id, patch)
            const flagErr = () => showWarning('⚠ Pätkän rajojen tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, patch)
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) {
              renderSegmentOverlay()
              segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
              // T222/V150: rajat muuttuivat → oma merkki-setti muuttuu → päivitä raahattavuus.
              applyDraggable()
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
            if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
          },
          // T230/V93: talkoolainen merkitsee pätkän valmiiksi (asettaminen/purku). Jaettu applyComplete (R8).
          onComplete: applyComplete,
          // T232 (B)/V156: GPS-toggle. Ohjaa GpsNavigatoria (T30, oma sijainti) — ERILLINEN
          // driveModesta. Palauttaa uuden aktiivitilan napin ilmeeseen. R8: GPS myös yläpalkin ⋯:ssä.
          onToggleGps: () => {
            if (gpsNavigator.isActive()) { gpsNavigator.stop(); syncGpsLabel('pois'); return false }
            gpsNavigator.start(syncGpsLabel)
            return gpsNavigator.isActive()
          },
          isGpsActive: () => gpsNavigator.isActive(),
          // T341/V247: hero-nappi lukee saman tilan kuin ⋯-nappi — "Haetaan…" ennen ensimmäistä
          // fixiä, ei valheellista "GPS päällä" (B133).
          gpsLabel: () => gpsButtonLabel(gpsNavigator.getState()),
          // T232 (F)/V159: hero:n valittu merkki (◀▶-selailu/reconcile) → synkkaa kartan korostus.
          // null = ei valittua (done/väärä phase) → tyhjennä. Korostus SEURAA valintaa, ei suoraan
          // firstUnsetMarkeria (estää "highlight osoittaa eri merkkiin kuin hero" -epäjohdonmukaisuuden).
          onNavigate: (id) => {
            // R6/V178: ikoni-hehku seuraa hero:n valintaa (◀▶). null = ei korostusta.
            markerManager.setNextHighlight(id ?? null)
          },
          // T232 (E)/T229 + R8: "+ Merkki" hero-overflowsta / yläpalkin ⋯:stä → sign-picker kartan
          // keskelle (POST omalle pätkälle V149). Jaettu openAddMarkerPicker.
          onAddMarker: openAddMarkerPicker,
          // T237/V245: "💬 Huomio" hero-⋯:stä — sama toiminto kuin yläpalkin ⋯:ssä.
          onAddComment: () => {
            const c = map.getCenter()
            openCommentDraft(c.lat, c.lng)
          },
          // T218/V143 (skenaario 2): keräyslistan "Haettu"-kuittaus. Suora status-asetus (EI 'kerää'-
          // action, joka heittää suunniteltu-tilaisille — sama syy kuin bulkCollect yllä). Kuka tahansa
          // autentikoitu, ei ownership-gatea; kerätty ↔ suunniteltu. bulkSetStatus persistoi + onUpdate.
          onCollectMarker: (id, collected) => markerManager.bulkSetStatus([id], collected ? 'kerätty' : 'suunniteltu'),
        },
      )
      const segMarkers0 = getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg))
      segmentView.update(segMarkers0)
      // T224 (D): "tässä on sun pätkä" — zoomaa pätkään heti latauksessa.
      fitMapToSegment(map, routes, seg, segMarkers0)
      // T224 (b1)/T256: korosta seuraava asettamaton merkki kartalla (kartta = päänavigointi).
      updateNextHighlight(seg, segMarkers0)
      // T222/V150: vain oman pätkän merkit raahattavia — vieraita ei voi siirtää (backend 403).
      // T307/V218: lisäksi vain muokkaustilassa (applyDraggable yhdistää ehdot).
      baseDraggable = m => currentSegmentMarkerIds()?.has(m.id) ?? false
      applyDraggable()

      // T257/R8/V179: talkoolaisen yläpalkin ⋯-toiminnot (VISION "GPS ym ylävalikkoon").
      // Karttamoodissa hero-chrome minimaali (T255) → Lisää merkki ⋯:ssä.
      // GPS kytkettiin jo ylempänä (T341/V247) — se ei tarvitse pätkää, tämä tarvitsee.
      // T351/V254 (B140): "Merkitse pätkä valmiiksi" EI enää täällä — se on hero:n done-rivillä
      // (`segment-hero.ts`, `actions.onComplete` → applyComplete). Yksi sisääntulo per rooli.
      document.getElementById('btn-tk-add-marker')?.addEventListener('click', openAddMarkerPicker)
      // T237/V245: huomio kartan keskelle. ⊥ vaadi muokkaustilaa toisin kuin merkin lisäys:
      // huomio ⊥ mutatoi merkkidataa eikä voi vahingossa siirtää mitään — muokkaustilan portti
      // (V218) suojaa merkkejä, ⊥ havaintoja. Talkoolaisen kynnys jättää huomio ! olla matala.
      document.getElementById('btn-tk-add-note')?.addEventListener('click', () => {
        // T366/V264: kartan keskipiste on vain LÄHTÖARVAUS — luonnospinni on raahattava ja
        // lopullinen sijainti luetaan vasta Lähetä-hetkellä.
        const c = map.getCenter()
        openCommentDraft(c.lat, c.lng)
      })
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
    routeVis = new RouteVisibilityControl(routes, polylines, map, markerManager, ids => {
      // T374/V269/B157: reitin piilotus vie pätkäviivat & nimilaput mukanaan.
      setSegmentVisibleRoutes(ids)
      renderSegmentOverlay()
    })
    // T377: järjestäjän alapalkki poistuu kokonaan — reittivalinta asuu suodatinbarissa
    // kartan yläpuolella (yksi "mitä näkyy" -pinta, ⊥ kahta). Drive-osat olivat jo piilossa (V134).
    document.getElementById('route-bar')?.setAttribute('hidden', '')
  }

  // T377/V272: suodatinbar kartan yläpuolelle. Järjestäjä saa 4 akselia, talkoolainen kapean
  // "Näytä"-valinnan (T379). Bar PÄÄTTÄÄ tilan; sovellus tapahtuu tässä callbackissa (V271).
  const filterBarEl = document.getElementById('map-filter-bar')
  let mapFilterBar: MapFilterBar | null = null
  if (filterBarEl) {
    mapFilterBar = new MapFilterBar(filterBarEl, {
      routes: routes.map(r => ({ id: r.id, label: r.label, color: r.color, dashArray: r.dashArray, event: r.event })),
      getSegmentName: id => segmentStore.get(id)?.displayName,
      narrow: isTalkoolainen,
      onIsolationClear: () => clearFocusSegment(),
      onChange: filter => {
        // V243-amend: himmennysporras on JÄRJESTÄJÄN asetus. Talkoolaisen automaattifokus pysyy
        // kevyt-portaassa ∴ attribuuttia ⊥ kirjoiteta talkoolaisen näkymään lainkaan.
        if (!isTalkoolainen) document.body.dataset.dimLevel = filter.dimLevel
        // Reittiakseli menee Leaflet-kerrokseen kontrollin kautta (se omistaa polylinet).
        if (routeVis && filter.visibleRouteIds) routeVis.setVisibleRoutes(filter.visibleRouteIds)
        markerManager.setMapFilter(filter, {
          isolatedMarkerIds: isolatedMarkerIds(filter, Array.from(segmentStore.values()), markerManager.getAll()),
        })
        setSegmentMapFilter(filter)
        renderSegmentOverlay()
      },
    })
    filterBarEl.removeAttribute('hidden')
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
  // T237: pickerin "💬 Huomio" → luontimodaali samaan lat/loniin johon picker aukesi.
  // Arrow lukee commentModalin vasta klikkihetkellä ∴ määrittelyjärjestys ei sido.
  const placeMode = new PlaceMode(markerManager, signLibrary, mapMode, (lat, lon) =>
    openCommentDraft(lat, lon))
  const signLibraryContainer = document.getElementById('sign-type-dropdown')
  let signLibraryPanel: SignLibraryPanel | null = null
  if (signLibraryContainer) {
    signLibraryPanel = new SignLibraryPanel(
      signLibraryContainer,
      signLibrary,
      () => saveLibrary(signLibrary),
      // T307/V218: sivupalkin "aseta kartalle" on eksplisiittinen käyttäjätoimi → avaa
      // muokkaustila ennen viritystä (PlaceMode.armFromSidebar itse on no-op katselussa).
      // Sama linja kuin talkoolaisen "+ Merkki" — nappi ei jää hiljaa toimimattomaksi.
      (t) => {
        if (!mapMode.canPlaceMarkers()) mapMode.set('muokkaus')
        placeMode.armFromSidebar(t)
      },
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

  // T264/V184: yläpalkin "🎒 Varustelista" -nappi POISTETTU — varuste on nyt koti-Varustelista-tab
  // (inline SegmentEquipment). EquipmentModal avautuu yhä koti-tabin "✎ Muokkaa varusteita" -napista.

  document.getElementById('btn-modal-close')!.addEventListener('click', closeMarkerModal)
  markerModalBackdrop.addEventListener('click', closeMarkerModal)
  markerModal.addEventListener('click', e => e.stopPropagation())

  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())

  // T39: "hyppää seuraavaan merkkiin" — siirtää driveMode-kursorin seuraavan merkin kohtaan
  // aktiivisella reitillä (edessäpäin). Ei GPS-riippuvainen. T327/V235: sekä valinta että
  // kursorin kohde luetaan AKTIIVISEN reitin akselilta (distanceAhead), EI merkin
  // distanceFromStart-skalaarista — se voi olla mitattu toiselta reitiltä ∴ kursori hyppäisi
  // väärään kohtaan (B126). Jos edessä ei ole merkkiä, ei tehdä mitään (kursori jää paikalleen).
  document.getElementById('btn-route-next-marker')?.addEventListener('click', () => {
    const route = activeRouteProvider()
    const currentDistM = driveMode.currentKm() * 1000
    const targetKm = distanceAhead(markerManager.getAll(), currentDistM, route.id)
    if (targetKm !== null) driveMode.jumpToDistance(targetKm)
  })

  // T221/T75: vapaa-piste-kommentit kartalle (targetType='point'). Ikoni-marker, klikkaus →
  // järjestäjä voi poistaa (confirm), muut näkevät tekstin. Haetaan latauksessa; poiston jälkeen
  // uudelleenrender. (Vapaan pisteen SIJOITUS-UI on erillinen jatko — tässä renderöinti + poisto.)
  // T237/T338: klikkaus avaa huomio-modaalin (teksti + kuvat + poisto järjestäjälle) — aiempi
  // confirm/toast-haara korvattu: toast ei mahduta kuvia eikä kerro kuka huomion jätti.
  // T367/V265: oikeuden RATKAISEE serveri (`canEdit` per rivi) — client vain lukee sen.
  // Sääntöä ei toisinneta selaimessa: kaksi toteutusta ajautuisi erilleen ja UI lupaisi
  // mitä API kieltää. Puuttuva kenttä (vanha vastaus välimuistista) = ei oikeutta.
  const canEditComment = (c: Comment): boolean => c.canEdit === true

  const commentModal = new CommentPointModal({
    onChanged: () => refreshPointComments(),
    canDelete: canEditComment,
    // T364/V263: kuittaus on järjestäjän koordinointipäätös — talkoolainen ilmoittaa.
    canResolve: () => getRole() === 'järjestäjä',
    uploadImage: (id, file) => addCommentImage(id, file),
    // B152(a): kuvan lisäys/poisto → näkymä uudelleen tuoreella datalla.
    reload: (id) => fetchComments('point').then(rows => rows?.find(r => r.id === id) ?? null),
    // Ilman luonnosta palautetaan undefined ∴ modaali käyttää avaushetken koordinaatteja.
    // Aiempi `map.getCenter()`-fallback vuoti Leafletin `lng`-nimisen kentän `lon`-paikalle
    // ⇒ POST lähti ilman pituusastetta & serveri hylkäsi sen (missing_coordinates).
    draftPosition: () => commentDraft?.position(),
    onCreateClosed: () => { commentDraft?.remove(); commentDraft = null },
  })

  let commentDraft: CommentDraft | null = null

  // T366/V264: huomion luonnin AINOA sisääntulo. Jokainen polku (yläpalkin ⋯, hero-⋯,
  // merkkipickerin alapalkki) saa saman raahattavan luonnospinnin — erilliset kutsut
  // ajautuivat erilleen heti: kaksi kolmesta avasi modaalin ilman pinniä.
  const openCommentDraft = (lat: number, lon: number): void => {
    commentDraft?.remove()
    commentDraft = commentLayer.startDraft(lat, lon)
    commentModal.openCreate(lat, lon)
  }

  const commentLayer = new CommentLayer(map, (c) => commentModal.openView(c), {
    canEdit: canEditComment,
    // T367: raahaus tallentaa heti. false ⇒ CommentLayer palauttaa pinnin (403 = vieras huomio).
    onMove: (c, lat, lon) => updateComment(c.id, { lat, lon }).then((updated) => {
      if (!updated) {
        showWarning('⚠ Huomion siirto ei onnistunut — se ei ole sinun.', 4000)
        return false
      }
      refreshPointComments()
      return true
    }),
  })

  // T340: järjestäjän sivupalkin lista. Sama data kuin kartalla ∴ yksi refresh päivittää molemmat
  // — erilliset hakukierrokset ajautuisivat eri mielisiksi (B127-oppi).
  const commentPanelEl = document.getElementById('comment-panel-container')
  const commentPanel = commentPanelEl
    ? new CommentPanel(commentPanelEl, {
        // T369/B153: rivi NÄYTTÄÄ missä huomio on — modaali peittäisi juuri sen kartan
        // jota käyttäjä halusi katsoa. Avaaminen on oma nappinsa rivin lopussa.
        onFocus: (c) => {
          if (typeof c.lat === 'number' && typeof c.lon === 'number') {
            map.setView([c.lat, c.lon], 16)
            commentLayer.pulse(c.id)
          }
        },
        onOpen: (c) => commentModal.openView(c),
      })
    : null

  // T370/V266 (B154): talkoolaisen automaattifokus EI himmennä huomioita. Aiempi
  // `setFocusActive(true)` täällä luki V243:a liian leveästi — talkoolainen ei kytkenyt
  // korostusta, joten hänen oma tuore havaintonsa ilmestyi kartalle harmaana ja luettiin
  // poissuljetuksi. Himmennys jää järjestäjän eksplisiittiseen pätkäkorostukseen
  // (segments-wiring setFocusSegment): hän vertailee pätkiä, talkoolainen tekee työtä.

  const refreshPointComments = () => {
    void fetchComments('point').then((rows) => {
      if (!rows) return
      commentLayer.render(rows)
      commentPanel?.setComments(rows)
    })
  }
  refreshPointComments()

  return { markerManager, driveMode, routeBar, progressBar, placeMode, markerModal, closeMarkerModal, commentLayer, mapFilterBar }
}
