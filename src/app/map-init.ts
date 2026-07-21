import L from 'leaflet'
import { TILE_LAYERS } from '../logic/tile-layers'
import { LeftPanel } from '../ui/left-panel'
import { GpsNavigator } from '../map/gps-navigator'

const LS_KEY = 'karttamaster-layer'

export interface MapInit {
  map: L.Map
  toolbarMenu: HTMLElement
  // T232 (B): GPS-toggle asuu talkoolaisen SegmentView-herossa → navigaattori altistetaan
  // wireMarkersille. Yläpalkin #btn-gps poistettu (T233).
  gpsNavigator: GpsNavigator
}

export function initMap(): MapInit {
  const map = L.map('map', { zoomSnap: 0.25, zoomDelta: 0.25, zoomControl: false })
  // B86/V122 — zoom-kontrolli oikeaan yläkulmaan, ei peitä vasemman sivupalkin ▶-togglea mobiililla
  L.control.zoom({ position: 'topright' }).addTo(map)
  // E2E testability hook — not used in production
  ;(window as unknown as Record<string, unknown>)['__testMap'] = map

  const savedLayerId = localStorage.getItem(LS_KEY) ?? TILE_LAYERS[0].id
  let activeLayerIdx = Math.max(0, TILE_LAYERS.findIndex(l => l.id === savedLayerId))
  let currentTileLayer = L.tileLayer(TILE_LAYERS[activeLayerIdx].urlTemplate, {
    attribution: TILE_LAYERS[activeLayerIdx].attribution,
    maxZoom: TILE_LAYERS[activeLayerIdx].maxZoom,
    maxNativeZoom: TILE_LAYERS[activeLayerIdx].maxNativeZoom,
  }).addTo(map)

  const btnLayer = document.getElementById('btn-layer')
  if (btnLayer) {
    // T259/R9: nappi näyttää AKTIIVISEN karttatyylin nimen (käyttäjäpalaute: "kerro mikä tyyli on")
    // — klikki kiertää seuraavaan. Aiemmin kiinteä "Karttatyyli" + vain title-tooltip (epäselvä).
    const syncLayerLabel = () => { btnLayer.textContent = `Karttatyyli: ${TILE_LAYERS[activeLayerIdx].label}` }
    syncLayerLabel()
    btnLayer.addEventListener('click', () => {
      activeLayerIdx = (activeLayerIdx + 1) % TILE_LAYERS.length
      const cfg = TILE_LAYERS[activeLayerIdx]
      currentTileLayer.remove()
      currentTileLayer = L.tileLayer(cfg.urlTemplate, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, maxNativeZoom: cfg.maxNativeZoom }).addTo(map)
      localStorage.setItem(LS_KEY, cfg.id)
      syncLayerLabel()
    })
  }

  const toolbarMenu = document.getElementById('toolbar-menu')!

  const leftPanelEl = document.getElementById('left-panel')
  if (leftPanelEl) new LeftPanel(leftPanelEl, () => map.invalidateSize())

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleInvalidateSize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => map.invalidateSize(), 150)
  }
  window.addEventListener('resize', scheduleInvalidateSize)
  window.addEventListener('orientationchange', scheduleInvalidateSize)
  window.visualViewport?.addEventListener('resize', scheduleInvalidateSize)

  document.getElementById('btn-menu')?.addEventListener('click', e => {
    e.stopPropagation()
    toolbarMenu.classList.toggle('open')
  })
  document.addEventListener('click', () => {
    toolbarMenu.classList.remove('open')
  })

  // T232/T233: GPS-toggle siirtyi talkoolaisen SegmentView-heroon (gpsNavigator altistetaan
  // wireMarkersille). Yläpalkin #btn-gps poistettu (index.html) — ei enää toolbar-wiringiä.
  const gpsNavigator = new GpsNavigator(map)

  return { map, toolbarMenu, gpsNavigator }
}
