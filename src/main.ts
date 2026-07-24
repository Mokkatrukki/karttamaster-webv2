import './style.css'
import L from 'leaflet'
import { loadGpx } from './logic/gpx'
import { buildRoutePoints } from './logic/bearing'
import type { MarkerManager } from './map/markers'
import { fetchMarkers } from './logic/sync'
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

// Kaksi tapahtumaa erottuvat värisävyperheellä (SPEC §C, DESIGN §Reitti-/pätkävärit):
// SyöteMTB = viileä/sininen, Syötekylä Gravel Fest = lämmin oranssi-puna.
export const ROUTE_DEFS: Omit<RouteConfig, 'routePoints'>[] = [
  { id: 'smtb-30',  label: '30 km',  color: '#4C97D6', file: '/smtb-2026-30km.gpx' },
  { id: 'smtb-55',  label: '55 km',  color: '#2F6FB0', file: '/smtb-2026-55km.gpx' },
  { id: 'sgf-62',   label: '62 km',  color: '#E9A13B', file: '/sgf-2026-62km.gpx' },
  { id: 'sgf-125',  label: '125 km', color: '#E2662A', file: '/sgf-2026-125km.gpx' },
  { id: 'sgf-175',  label: '175 km', color: '#C4384A', file: '/sgf-2026-175km.gpx' },
]

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

  const polylines = routes.map(r =>
    L.polyline(r.routePoints.map(p => [p.lat, p.lon] as [number, number]), {
      color: r.color, weight: 6, opacity: 0.85,
    }).addTo(map)
  )
  map.fitBounds(L.featureGroup(polylines).getBounds(), { padding: [20, 20] })

  // Ref täytetään markers-wiring.ts:ssä — segments-wiring tarvitsee merkit pätkän
  // status-väritykseen (V96) mutta MarkerManager luodaan vasta sen jälkeen.
  const markerManagerRef: { current: MarkerManager | null } = { current: null }

  // Talkoolaiselle alueet ovat vain kontekstia (noutopisteet/pudotuspisteet) — niiden
  // latausvirhe ei saa peittää pätkänäkymän otsikkoa pysyvällä "päivitä sivu" -bannerilla
  // (puhdas kenttäkokemus). Järjestäjälle alueet ovat työkalu → näytä virhe.
  await wireAreas(map, talkoolainenCode, () => {
    if (!talkoolainenCode) showWarning('⚠ Alueiden lataus epäonnistui — päivitä sivu', 0)
  })

  const { segmentStore, segmentOverlay, renderSegmentOverlay, segmentPanel } = await wireSegments(
    map, routes, talkoolainenCode, initialMarkers, markerManagerRef,
    () => showWarning('⚠ Pätkän tallennus epäonnistui (muisti täynnä?)', 5000),
    () => showWarning('⚠ Pätkien lataus epäonnistui — päivitä sivu', 0),
  )

  const { markerManager, driveMode, progressBar, placeMode, markerModal, closeMarkerModal } = wireMarkers(
    map, routes, polylines, initialMarkers, talkoolainenCode,
    { segmentStore, renderSegmentOverlay, segmentPanel, showWarning, gpsNavigator },
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
