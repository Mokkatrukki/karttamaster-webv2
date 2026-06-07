import L from 'leaflet'
import { loadGpx } from './logic/gpx'
import { buildRoutePoints, nearestPointIndex, routePositionPct } from './logic/bearing'
import { MarkerManager } from './map/markers'
import { DriveMode } from './map/drive'
import { renderMarkerList, renderSignDots } from './ui/marker-list'
import { positionPicker, SIGN_TYPES } from './logic/sign-picker'
import { TILE_LAYERS } from './logic/tile-layers'
import type { RouteConfig } from './logic/multi-route'
import type { MarkerType } from './logic/types'

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

function cycleLayer() {
  activeLayerIdx = (activeLayerIdx + 1) % TILE_LAYERS.length
  const cfg = TILE_LAYERS[activeLayerIdx]
  currentTileLayer.remove()
  currentTileLayer = L.tileLayer(cfg.urlTemplate, {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
  }).addTo(map)
  localStorage.setItem(LS_KEY, cfg.id)
  const btn = document.getElementById('btn-layer')
  if (btn) btn.textContent = cfg.label
}

const btnLayer = document.getElementById('btn-layer')
if (btnLayer) {
  if (btnLayer) btnLayer.textContent = TILE_LAYERS[activeLayerIdx].label
  btnLayer.addEventListener('click', cycleLayer)
}

function buildSignTypeButtons(): string {
  return SIGN_TYPES.map((s) => `
    <button class="sign-type-btn" data-type="${s.type}">
      <span class="sign-swatch" style="background:${s.color}">${s.shortLabel}</span>
      ${s.label}
    </button>`).join('')
}

async function init() {
  // Load all routes in parallel
  const routes: RouteConfig[] = await Promise.all(
    ROUTE_DEFS.map(async (def) => {
      const coords = await loadGpx(def.file)
      return { ...def, routePoints: buildRoutePoints(coords) }
    })
  )

  // Create polylines for each route
  const polylines = routes.map((r) =>
    L.polyline(r.routePoints.map((p) => [p.lat, p.lon] as [number, number]), {
      color: r.color, weight: 6, opacity: 0.85,
    }).addTo(map)
  )

  // Fit map to all routes combined
  const group = L.featureGroup(polylines)
  map.fitBounds(group.getBounds(), { padding: [20, 20] })

  // UI elements
  const routeKmEl = document.getElementById('route-km')!
  const trackFill = document.getElementById('route-track-fill') as HTMLElement
  const trackHandle = document.getElementById('route-track-handle') as HTMLElement
  const routeTrack = document.getElementById('route-track') as HTMLElement
  const routeSelector = document.getElementById('route-selector')!
  const mapEl = document.getElementById('map')!
  const placeModeLabel = document.getElementById('place-mode-label')!
  const btnAddSign = document.getElementById('btn-add-sign')!
  const signTypeDropdown = document.getElementById('sign-type-dropdown')!
  const floatingPicker = document.getElementById('floating-picker')!
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  // State
  let visibleRouteIds = routes.map((r) => r.id)
  let driveRouteId = routes[0].id

  function driveRoute() { return routes.find((r) => r.id === driveRouteId)! }
  function driveRouteTotal() {
    const pts = driveRoute().routePoints
    return pts[pts.length - 1]?.distanceFromStart ?? 0
  }

  function updateProgressBar(km: number) {
    const total = driveRouteTotal()
    const pct = routePositionPct(km * 1000, total)
    trackFill.style.width = `${pct}%`
    trackHandle.style.left = `${pct}%`
    routeKmEl.textContent = `${km.toFixed(2)} / ${(total / 1000).toFixed(1)} km`
  }

  function refreshSignDots() {
    const r = driveRoute()
    renderSignDots(markerManager, driveRouteTotal(), r.id, r.routePoints)
  }

  updateProgressBar(0)

  const markerManager = new MarkerManager(map, routes, () => {
    renderMarkerList(markerManager)
    refreshSignDots()
  })

  const driveMode = new DriveMode(map, routes[0].routePoints, (km) => {
    updateProgressBar(km)
  })

  // ── Route tabs UI ──
  const SVG_EYE_OPEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
  const SVG_EYE_OFF  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

  function updateRouteSelector() {
    const onlyOneVisible = visibleRouteIds.length <= 1
    routes.forEach((r) => {
      const tab = routeSelector.querySelector(`.route-tab[data-route-id="${r.id}"]`) as HTMLElement | null
      if (!tab) return
      const visBtn = tab.querySelector('.route-tab-vis') as HTMLButtonElement
      const isVisible = visibleRouteIds.includes(r.id)
      const isDriving = r.id === driveRouteId
      tab.classList.toggle('active', isDriving)
      tab.classList.toggle('route-hidden', !isVisible)
      visBtn.innerHTML = isVisible ? SVG_EYE_OPEN : SVG_EYE_OFF
      visBtn.disabled = isVisible && onlyOneVisible
      visBtn.title = isVisible ? 'Piilota reitti' : 'Näytä reitti'
    })
    // Progress bar fill follows active route color
    trackFill.style.background = driveRoute().color
  }

  function setVisibleRoutes(ids: string[]) {
    visibleRouteIds = ids
    routes.forEach((r, i) => {
      const visible = ids.includes(r.id)
      if (visible) polylines[i].addTo(map)
      else polylines[i].remove()
    })
    markerManager.setVisibleRoutes(ids)
    updateRouteSelector()
  }

  function setDriveRoute(id: string) {
    driveRouteId = id
    if (!visibleRouteIds.includes(id)) {
      setVisibleRoutes([...visibleRouteIds, id])
    }
    const r = routes.find((route) => route.id === id)!
    driveMode.setRoute(r.routePoints)
    updateProgressBar(0)
    refreshSignDots()
    updateRouteSelector()
  }

  function toggleRouteVisible(id: string) {
    if (visibleRouteIds.includes(id)) {
      if (visibleRouteIds.length <= 1) return
      const newVisible = visibleRouteIds.filter((rid) => rid !== id)
      if (id === driveRouteId) {
        driveRouteId = newVisible[0]
        const r = routes.find((route) => route.id === driveRouteId)!
        driveMode.setRoute(r.routePoints)
        updateProgressBar(0)
        refreshSignDots()
      }
      setVisibleRoutes(newVisible)
    } else {
      setVisibleRoutes([...visibleRouteIds, id])
    }
  }

  routes.forEach((r) => {
    const tab = document.createElement('div')
    tab.className = 'route-tab'
    tab.dataset.routeId = r.id
    tab.style.background = r.color

    const driveBtn = document.createElement('button')
    driveBtn.className = 'route-tab-drive'
    driveBtn.title = 'Aseta ajettavaksi reitiksi'
    driveBtn.innerHTML = `<span class="tab-color-dot" style="background:${r.color}"></span>${r.label}<span class="tab-arrow">▶</span>`
    driveBtn.addEventListener('click', () => setDriveRoute(r.id))

    const visBtn = document.createElement('button')
    visBtn.className = 'route-tab-vis'
    visBtn.innerHTML = SVG_EYE_OPEN
    visBtn.addEventListener('click', () => toggleRouteVisible(r.id))

    tab.appendChild(driveBtn)
    tab.appendChild(visBtn)
    routeSelector.appendChild(tab)
  })

  updateRouteSelector()

  // ── Progress bar drag ──
  let trackDragging = false

  function jumpToTrackFraction(clientX: number) {
    const rect = routeTrack.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetDist = fraction * driveRouteTotal()
    const pts = driveRoute().routePoints
    let best = 0, bestDiff = Infinity
    for (let i = 0; i < pts.length; i++) {
      const diff = Math.abs(pts[i].distanceFromStart - targetDist)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    driveMode.jumpTo(best)
  }

  routeTrack.addEventListener('mousedown', (e) => { trackDragging = true; jumpToTrackFraction(e.clientX) })
  routeTrack.addEventListener('touchstart', (e) => { trackDragging = true; jumpToTrackFraction(e.touches[0].clientX) }, { passive: true })
  document.addEventListener('mousemove', (e) => { if (trackDragging) jumpToTrackFraction(e.clientX) })
  document.addEventListener('touchmove', (e) => { if (trackDragging) jumpToTrackFraction(e.touches[0].clientX) }, { passive: true })
  document.addEventListener('mouseup', () => { trackDragging = false })
  document.addEventListener('touchend', () => { trackDragging = false })

  // Click on any polyline → jump to nearest point on that route and set as drive route
  polylines.forEach((polyline, i) => {
    polyline.on('click', (e: L.LeafletMouseEvent) => {
      const r = routes[i]
      if (r.id !== driveRouteId) setDriveRoute(r.id)
      const idx = nearestPointIndex(r.routePoints, e.latlng.lat, e.latlng.lng)
      driveMode.jumpTo(idx)
    })
  })

  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())

  // ── Place-mode (toolbar dropdown flow) ──
  let placeType: MarkerType | null = null

  function enterPlaceMode(type: MarkerType) {
    placeType = type
    mapEl.classList.add('place-mode')
    placeModeLabel.classList.add('active')
    btnAddSign.classList.add('place-mode')
    btnAddSign.textContent = '✕ Peruuta'
  }

  function exitPlaceMode() {
    placeType = null
    mapEl.classList.remove('place-mode')
    placeModeLabel.classList.remove('active')
    btnAddSign.classList.remove('place-mode')
    btnAddSign.textContent = '+ Lisää merkki'
  }

  // ── Marker modal ──
  function openMarkerModal(highlightId?: string) {
    renderMarkerList(markerManager, highlightId)
    markerModalBackdrop.classList.add('open')
    markerModal.classList.add('open')
  }

  function closeMarkerModal() {
    markerModalBackdrop.classList.remove('open')
    markerModal.classList.remove('open')
  }

  document.getElementById('btn-list')!.addEventListener('click', () => openMarkerModal())
  document.getElementById('btn-modal-close')!.addEventListener('click', closeMarkerModal)
  markerModalBackdrop.addEventListener('click', closeMarkerModal)
  markerModal.addEventListener('click', (e) => e.stopPropagation())

  // ── Sign type dropdown ──
  signTypeDropdown.innerHTML = buildSignTypeButtons()

  function openDropdown() {
    const rect = btnAddSign.getBoundingClientRect()
    signTypeDropdown.style.top  = `${rect.bottom + 4}px`
    signTypeDropdown.style.left = `${rect.left}px`
    signTypeDropdown.classList.add('open')
  }

  function closeDropdown() {
    signTypeDropdown.classList.remove('open')
  }

  btnAddSign.addEventListener('click', () => {
    if (placeType) { exitPlaceMode(); return }
    signTypeDropdown.classList.contains('open') ? closeDropdown() : openDropdown()
  })

  signTypeDropdown.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.sign-type-btn') as HTMLElement | null
    if (!btn) return
    closeDropdown()
    enterPlaceMode(btn.dataset.type as MarkerType)
  })

  // ── Floating picker (dblclick flow) ──
  let pendingDblClick: { lat: number; lon: number } | null = null

  floatingPicker.innerHTML = buildSignTypeButtons()

  function openFloatingPicker(lat: number, lon: number, clientX: number, clientY: number) {
    pendingDblClick = { lat, lon }
    floatingPicker.classList.add('open')
    requestAnimationFrame(() => {
      const { offsetWidth: w, offsetHeight: h } = floatingPicker
      const pos = positionPicker(clientX, clientY, w, h, window.innerWidth, window.innerHeight)
      floatingPicker.style.left = `${pos.x}px`
      floatingPicker.style.top  = `${pos.y}px`
    })
  }

  function closeFloatingPicker() {
    floatingPicker.classList.remove('open')
    pendingDblClick = null
  }

  floatingPicker.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.sign-type-btn') as HTMLElement | null
    if (!btn || !pendingDblClick) return
    const { lat, lon } = pendingDblClick
    markerManager.add(lat, lon, btn.dataset.type as MarkerType)
    closeFloatingPicker()
  })

  floatingPicker.addEventListener('mousedown', (e) => e.stopPropagation())

  // ── Map click / dblclick ──
  map.doubleClickZoom.disable()
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (floatingPicker.classList.contains('open')) { closeFloatingPicker(); return }
    if (signTypeDropdown.classList.contains('open')) { closeDropdown(); return }
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; return }
    clickTimer = setTimeout(() => {
      clickTimer = null
      if (!placeType) return
      markerManager.add(e.latlng.lat, e.latlng.lng, placeType)
      exitPlaceMode()
    }, 250)
  })

  map.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null }
    exitPlaceMode()
    closeDropdown()
    const originalEvent = (e as any).originalEvent as MouseEvent
    openFloatingPicker(e.latlng.lat, e.latlng.lng, originalEvent.clientX, originalEvent.clientY)
  })

  // ── Outside click closes dropdowns/picker ──
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement
    if (!signTypeDropdown.contains(target) && !btnAddSign.contains(target)) closeDropdown()
    if (!floatingPicker.contains(target)) closeFloatingPicker()
  })

  // ── Keyboard ──
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (floatingPicker.classList.contains('open')) { closeFloatingPicker(); return }
      if (signTypeDropdown.classList.contains('open')) { closeDropdown(); return }
      if (placeType) { exitPlaceMode(); return }
      if (markerModal.classList.contains('open')) { closeMarkerModal(); return }
      if (driveMode.isActive()) { driveMode.stop(); updateProgressBar(0) }
      return
    }
    if (!driveMode.isActive()) return
    if (e.key === 'ArrowRight') { e.preventDefault(); driveMode.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); driveMode.prev() }
  })
}

init().catch(console.error)
