import L from 'leaflet'
import { loadGpx } from './gpx'
import { buildRoutePoints, nearestPointIndex, routePositionPct } from './bearing'
import { MarkerManager } from './markers'
import { DriveMode } from './drive'
import { renderMarkerList, renderSignDots } from './ui'
import { positionPicker, SIGN_TYPES } from './sign-picker'
import { TILE_LAYERS } from './tile-layers'
import type { MarkerType } from './types'

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
  btnLayer.textContent = TILE_LAYERS[activeLayerIdx].label
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
  const rawCoords = await loadGpx('/route.gpx')
  const routePoints = buildRoutePoints(rawCoords)
  const totalDistance = routePoints[routePoints.length - 1]?.distanceFromStart ?? 0
  const totalKm = totalDistance / 1000

  const latlngs = routePoints.map((p) => [p.lat, p.lon] as [number, number])
  const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 6, opacity: 0.8 }).addTo(map)
  map.fitBounds(polyline.getBounds(), { padding: [20, 20] })

  const routeKmEl = document.getElementById('route-km')!
  const trackFill = document.getElementById('route-track-fill') as HTMLElement
  const trackHandle = document.getElementById('route-track-handle') as HTMLElement
  const routeTrack = document.getElementById('route-track') as HTMLElement
  const mapEl = document.getElementById('map')!
  const placeModeLabel = document.getElementById('place-mode-label')!
  const btnAddSign = document.getElementById('btn-add-sign')!
  const signTypeDropdown = document.getElementById('sign-type-dropdown')!
  const floatingPicker = document.getElementById('floating-picker')!
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  function updateProgressBar(km: number) {
    const pct = routePositionPct(km * 1000, totalDistance)
    trackFill.style.width = `${pct}%`
    trackHandle.style.left = `${pct}%`
    routeKmEl.textContent = `${km.toFixed(2)} / ${totalKm.toFixed(1)} km`
  }

  updateProgressBar(0)

  const markerManager = new MarkerManager(map, routePoints, () => {
    renderMarkerList(markerManager)
    renderSignDots(markerManager, totalDistance)
  })

  const driveMode = new DriveMode(map, routePoints, (km) => {
    updateProgressBar(km)
  })

  // ── Progress bar drag ──
  let trackDragging = false

  function jumpToTrackFraction(clientX: number) {
    const rect = routeTrack.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetDist = fraction * totalDistance
    let best = 0, bestDiff = Infinity
    for (let i = 0; i < routePoints.length; i++) {
      const diff = Math.abs(routePoints[i].distanceFromStart - targetDist)
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

  polyline.on('click', (e: L.LeafletMouseEvent) => {
    const idx = nearestPointIndex(routePoints, e.latlng.lat, e.latlng.lng)
    driveMode.jumpTo(idx)
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
    // Measure after display
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
