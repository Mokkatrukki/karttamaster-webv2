import L from 'leaflet'
import { loadGpx } from './gpx'
import { buildRoutePoints, nearestPointIndex, routePositionPct } from './bearing'
import { MarkerManager } from './markers'
import { DriveMode } from './drive'
import { renderMarkerList, renderSignDots } from './ui'
import type { MarkerType } from './types'

const map = L.map('map')

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map)

async function init() {
  const rawCoords = await loadGpx('/route.gpx')
  const routePoints = buildRoutePoints(rawCoords)
  const totalDistance = routePoints[routePoints.length - 1]?.distanceFromStart ?? 0
  const totalKm = totalDistance / 1000

  const latlngs = routePoints.map((p) => [p.lat, p.lon] as [number, number])
  const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 6, opacity: 0.8 }).addTo(map)
  map.fitBounds(polyline.getBounds(), { padding: [20, 20] })

  // ── Progress bar elements ──
  const routeKmEl = document.getElementById('route-km')!
  const trackFill = document.getElementById('route-track-fill') as HTMLElement
  const trackHandle = document.getElementById('route-track-handle') as HTMLElement
  const routeTrack = document.getElementById('route-track') as HTMLElement

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
    const idx = nearestPointIndex(routePoints, 0, 0) // seed
    let best = 0
    let bestDiff = Infinity
    for (let i = 0; i < routePoints.length; i++) {
      const diff = Math.abs(routePoints[i].distanceFromStart - targetDist)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    driveMode.jumpTo(best)
  }

  routeTrack.addEventListener('mousedown', (e) => {
    trackDragging = true
    jumpToTrackFraction(e.clientX)
  })
  routeTrack.addEventListener('touchstart', (e) => {
    trackDragging = true
    jumpToTrackFraction(e.touches[0].clientX)
  }, { passive: true })

  document.addEventListener('mousemove', (e) => {
    if (!trackDragging) return
    jumpToTrackFraction(e.clientX)
  })
  document.addEventListener('touchmove', (e) => {
    if (!trackDragging) return
    jumpToTrackFraction(e.touches[0].clientX)
  }, { passive: true })

  document.addEventListener('mouseup', () => { trackDragging = false })
  document.addEventListener('touchend', () => { trackDragging = false })

  // ── GPX line click → jump to that point ──
  polyline.on('click', (e: L.LeafletMouseEvent) => {
    const idx = nearestPointIndex(routePoints, e.latlng.lat, e.latlng.lng)
    driveMode.jumpTo(idx)
  })

  // ── Drive controls in route bar ──
  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())
  document.getElementById('btn-route-stop')!.addEventListener('click', () => {
    driveMode.stop()
    updateProgressBar(0)
  })

  // ── Add-mode state ──
  let addMode: MarkerType | null = null

  function setAddMode(type: MarkerType | null) {
    addMode = type
    const label = document.getElementById('add-mode-label')!
    if (type) {
      const dir = type === 'right' ? '→ Oikealle' : '← Vasemmalle'
      label.textContent = `Klikkaa: ${dir}`
      label.classList.add('active')
    } else {
      label.classList.remove('active')
    }
  }

  // ── Sign picker panel ──
  let pendingLat = 0
  let pendingLon = 0
  const pickerPanel = document.getElementById('sign-picker-panel')!

  function openSignPicker(lat: number, lon: number) {
    pendingLat = lat
    pendingLon = lon
    pickerPanel.classList.add('open')
  }

  function closeSignPicker() {
    pickerPanel.classList.remove('open')
  }

  document.getElementById('sign-picker-close')!.addEventListener('click', closeSignPicker)
  document.getElementById('sign-picker-left')!.addEventListener('click', () => {
    markerManager.add(pendingLat, pendingLon, 'left')
    closeSignPicker()
  })
  document.getElementById('sign-picker-right')!.addEventListener('click', () => {
    markerManager.add(pendingLat, pendingLon, 'right')
    closeSignPicker()
  })
  pickerPanel.addEventListener('mousedown', (e) => e.stopPropagation())

  // ── Marker modal ──
  const markerModalBackdrop = document.getElementById('marker-modal-backdrop')!
  const markerModal = document.getElementById('marker-modal')!

  function openMarkerModal() {
    markerModalBackdrop.classList.add('open')
    markerModal.classList.add('open')
  }

  function closeMarkerModal() {
    markerModalBackdrop.classList.remove('open')
    markerModal.classList.remove('open')
  }

  document.getElementById('btn-list')!.addEventListener('click', openMarkerModal)
  document.getElementById('btn-modal-close')!.addEventListener('click', closeMarkerModal)
  markerModalBackdrop.addEventListener('click', closeMarkerModal)
  markerModal.addEventListener('click', (e) => e.stopPropagation())

  // ── Toolbar buttons ──
  document.getElementById('btn-add-right')!.addEventListener('click', () => {
    setAddMode(addMode === 'right' ? null : 'right')
  })
  document.getElementById('btn-add-left')!.addEventListener('click', () => {
    setAddMode(addMode === 'left' ? null : 'left')
  })

  // ── Map click / dblclick ──
  map.doubleClickZoom.disable()
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (pickerPanel.classList.contains('open')) { closeSignPicker(); return }
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; return }
    clickTimer = setTimeout(() => {
      clickTimer = null
      if (!addMode) return
      markerManager.add(e.latlng.lat, e.latlng.lng, addMode)
      setAddMode(null)
    }, 250)
  })

  map.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null }
    setAddMode(null)
    openSignPicker(e.latlng.lat, e.latlng.lng)
  })

  // ── Keyboard ──
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (pickerPanel.classList.contains('open')) { closeSignPicker(); return }
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
