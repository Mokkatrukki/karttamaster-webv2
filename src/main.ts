import './style.css'
import L from 'leaflet'
import { loadGpx } from './logic/gpx'
import { buildRoutePoints } from './logic/bearing'
import { buildDirectionArrows } from './map/route-direction'
import type { MarkerManager } from './map/markers'
import { fetchMarkers } from './logic/sync'
import { backfillDistanceByRoute } from './logic/marker-distance'
// T303/V215: reittilista on `src/logic/route-defs.ts`:ssä jotta huoltoskriptit voivat lukea
// saman lähteen ilman Leaflet/DOM-riippuvuutta. Re-export säilyttää olemassa olevat importit.
import { ROUTE_DEFS } from './logic/route-defs'
export { ROUTE_DEFS }
import { startOutboxRetry, setOutboxReauthHandler, outbox } from './logic/outbox-instance'
import type { RouteConfig } from './logic/multi-route'
import { initMap } from './app/map-init'
import { wireAreas } from './app/areas-wiring'
import { wireSegments } from './app/segments-wiring'
import { wireMarkers } from './app/markers-wiring'
import { wireAuth } from './app/role-view'
import { initTalkoolainenMode } from './app/talkoolainen-mode'
import { initTheme } from './logic/theme'

// V132/T202: palauta käyttäjän valitsema teema ennen renderiä (estää välkkeen).
initTheme()

// T408/V293: zoom kuuluu KARTALLE. `maximum-scale=1.0, user-scalable=no` on pyyntö jonka iOS
// Safari on ohittanut iOS 10:stä (2016) lähtien, ja `touch-action` ei kata Safarin omia
// `gesture*`-tapahtumia. Ilman tätä pinch toolbarin tai heron päällä zoomaa koko sovelluksen —
// kartta-app jossa chrome venyy ruudun ulkopuolelle on käytännössä rikki (hanskat, kirkas
// aurinko: ele osuu kehykseen jatkuvasti). Kartan sisällä ele jätetään Leafletille.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e: Event) => {
    const t = e.target
    if (t instanceof Element && t.closest('#map')) return
    e.preventDefault()
  }, { passive: false })
}


const { map, toolbarMenu, gpsNavigator } = initMap()

let activeMarkerManager: MarkerManager | null = null

const warningEl = document.getElementById('distance-warning')!
let warningTimer: ReturnType<typeof setTimeout> | null = null
// ms <= 0 → persistentti (ei auto-piiloa) — käytetään latausvirheelle (T184/V118),
// jottei viesti katoa ennen kuin käyttäjä ehtii päivittää sivun.
function showWarning(msg: string, ms = 4000): void {
  warningEl.textContent = msg
  warningEl.style.display = 'block'
  if (warningTimer) clearTimeout(warningTimer)
  if (ms > 0) warningTimer = setTimeout(() => { warningEl.style.display = 'none' }, ms)
}

async function init(talkoolainenCode?: string) {
  // T183/V116: käynnistä durable-outboxin retry — toimittaa edellisen session
  // vahvistamattomat kirjoitukset (startup + 'online' + periodinen backoff).
  startOutboxRetry()

  // T184/V118: erottele lataus-epäonnistuminen tyhjästä tuloksesta. Epäonnistuessa
  // näytä persistentti virhe eikä hiljaa tyhjää karttaa (→ estää duplikaatit).
  const markersResult = await fetchMarkers()
  if (!markersResult.ok) {
    showWarning('⚠ Merkkien lataus epäonnistui — päivitä sivu', 0)
  }
  const initialMarkers = markersResult.ok ? markersResult.markers : []

  const routes: RouteConfig[] = await Promise.all(
    ROUTE_DEFS.map(async def => {
      const coords = await loadGpx(def.file)
      return { ...def, routePoints: buildRoutePoints(coords) }
    })
  )

  // T300/V212/B115: lazy backfill — vanhoilla merkeillä on vain yksi km-luku vaikka ne
  // kuuluvat useaan reittiin. lat/lon on totuus ∴ km per reitti lasketaan geometriasta heti
  // kun GPX:t ovat ladattu. EI kantamigraatiota eikä kirjoitusta — vanhaan dataan ei kosketa
  // (§C-parkki, käyttäjäpäätös 2026-07-25). Ilman tätä pätkäsuodatus jäisi legacy-fallbackiin.
  backfillDistanceByRoute(initialMarkers, routes)

  const polylines = routes.map(r =>
    // T304/V216: dashArray = 2. kanava. Jaetulla osuudella ylempi reitti paljastaa aukoistaan
    // alla kulkevan ∴ päällekkäisyys ei enää piilota reittiä kokonaan.
    L.polyline(r.routePoints.map(p => [p.lat, p.lon] as [number, number]), {
      color: r.color, weight: 6, opacity: 0.85, dashArray: r.dashArray,
    }).addTo(map)
  )
  map.fitBounds(L.featureGroup(polylines).getBounds(), { padding: [20, 20] })

  // T286: suuntanuolet — pienet, huomaamattomat. Näkyvät VAIN kun reitti on näkyvissä JA
  // kartta on zoomattu tarpeeksi lähelle (MIN_ARROW_ZOOM) → yleiskuvassa reitit pysyvät
  // siisteinä, nuolet paljastuvat lähikuvassa. Seuraa reittiviivan add/remove + zoomend.
  const MIN_ARROW_ZOOM = 12
  const arrowSyncs = polylines.map((pl, i) => {
    const arrows = buildDirectionArrows(routes[i].routePoints, routes[i].color)
    const sync = () => {
      const show = map.hasLayer(pl) && map.getZoom() >= MIN_ARROW_ZOOM
      if (show) arrows.addTo(map)
      else map.removeLayer(arrows)
    }
    pl.on('add', sync)
    pl.on('remove', sync)
    sync()
    return sync
  })
  map.on('zoomend', () => arrowSyncs.forEach(s => s()))

  // Ref täytetään markers-wiring.ts:ssä — segments-wiring tarvitsee merkit pätkän
  // status-väritykseen (V96) mutta MarkerManager luodaan vasta sen jälkeen.
  const markerManagerRef: { current: MarkerManager | null } = { current: null }

  // Talkoolaiselle alueet ovat vain kontekstia (noutopisteet/pudotuspisteet) — niiden
  // latausvirhe ei saa peittää pätkänäkymän otsikkoa pysyvällä "päivitä sivu" -bannerilla
  // (puhdas kenttäkokemus). Järjestäjälle alueet ovat työkalu → näytä virhe.
  await wireAreas(map, talkoolainenCode, () => {
    if (!talkoolainenCode) showWarning('⚠ Alueiden lataus epäonnistui — päivitä sivu', 0)
  })

  const { segmentStore, segmentOverlay, renderSegmentOverlay, segmentPanel, setOnFocusChange, clearFocusSegment } = await wireSegments(
    map, routes, talkoolainenCode, initialMarkers, markerManagerRef,
    () => showWarning('⚠ Pätkän tallennus epäonnistui (muisti täynnä?)', 5000),
    () => showWarning('⚠ Pätkien lataus epäonnistui — päivitä sivu', 0),
    (msg) => showWarning(msg, 2500),
  )

  const { markerManager, driveMode, progressBar, placeMode, markerModal, closeMarkerModal, mapFilterBar } = wireMarkers(
    map, routes, polylines, initialMarkers, talkoolainenCode,
    {
      segmentStore, renderSegmentOverlay, segmentPanel, showWarning, gpsNavigator,
      // T374/V269/B157: reittivalitsimen kytkin ulottuu pätkäkerrokseen asti.
      // T389/V281: sama kanava vie näkyvyyden myös LUONNIN reittiehdokkaisiin — suodatin on
      // se työkalu jolla järjestäjä kertoo minkä reitin pätkää on tekemässä (B164).
      setSegmentVisibleRoutes: ids => {
        segmentOverlay.setVisibleRoutes(ids)
        segmentPanel.setVisibleRoutes(ids)
      },
      // T377/V271: suodatin pätkäkerrokselle — overlay soveltaa, ⊥ päätä.
      setSegmentMapFilter: filter => segmentOverlay.setMapFilter(filter),
      clearFocusSegment,
    },
  )
  markerManagerRef.current = markerManager
  // T377/V272: korostus & suodatinbarin "vain tämä pätkä" ovat SAMA tila — bar näyttää sen &
  // tarjoaa ✕:n, laukaisin pysyy kartalla/modaalissa (⊥ kahta laukaisinta samalle asialle).
  setOnFocusChange(segmentId => mapFilterBar?.setIsolatedSegment(segmentId))
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

  // T254/V174 (R1 keystone): talkoolaiselle kaksi moodia (koti↔kartta). Oletus = koti
  // (pätkänäkymä, kartta piilossa). "Kartalle →" → kartta + invalidateSize (V176, kartta
  // oli display:none). "🏠" → koti. Vain talkoolaiselle — järjestäjän layout ennallaan.
  if (talkoolainenCode) {
    initTalkoolainenMode({
      btnToMap: document.getElementById('btn-to-map'),
      btnHome: document.getElementById('btn-home-view'),
      onEnterKartta: () => map.invalidateSize(),
    })
  }
}

if (import.meta.env.DEV) {
  import('./devtools/feedback-widget').then(({ FeedbackWidget }) => new FeedbackWidget())
}

// B92/T209: init() lisää dokumentti-/karttatason kuuntelijoita ja rakentaa DOM:ia — ei
// idempotentti. Logout→login ilman reloadia (onLoggedOut → authScreen.start() → tämä
// callback uudelleen) ajaisi init():n toistamiseen → tuplapillerit + tuplakuuntelijat.
// Ensimmäinen auth käynnistää sovelluksen; uudelleenkirjautuminen tekee puhtaan reloadin.
let appInitialized = false
const authScreen = wireAuth(toolbarMenu, () => activeMarkerManager, (code) => {
  if (appInitialized) { window.location.reload(); return }
  appInitialized = true
  init(code).catch(console.error)
})
// T186/V119: kirjoituksen 401 → re-auth-modaali; onnistuneen kirjautumisen jälkeen
// toimita jonossa olevat kirjoitukset (ei katoa, ei duplikaatteja).
setOutboxReauthHandler(() => authScreen.promptReauth(() => { void outbox.flush() }))
authScreen.start().catch(console.error)
