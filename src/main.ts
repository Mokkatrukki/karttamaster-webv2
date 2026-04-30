import L from 'leaflet'
import { loadGpx } from './gpx'
import { buildRoutePoints } from './bearing'
import { MarkerManager } from './markers'
import { DriveMode } from './drive'
import { renderMarkerList } from './ui'
import type { MarkerType } from './types'

const map = L.map('map')

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map)

async function init() {
  const rawCoords = await loadGpx('/route.gpx')
  const routePoints = buildRoutePoints(rawCoords)

  const latlngs = routePoints.map((p) => [p.lat, p.lon] as [number, number])
  const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(map)
  map.fitBounds(polyline.getBounds(), { padding: [20, 20] })

  const markerManager = new MarkerManager(map, routePoints, () => {
    renderMarkerList(markerManager)
  })

  const driveMode = new DriveMode(map, routePoints, (km) => {
    const el = document.getElementById('drive-km')
    if (el) el.textContent = `${km.toFixed(2)} km`
  })

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

  // Sign picker panel
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

  // Prevent clicks inside panel from bubbling to map
  pickerPanel.addEventListener('mousedown', (e) => e.stopPropagation())

  // Disable built-in dblclick zoom — repurposed for sign picker
  map.doubleClickZoom.disable()

  // Timer separates single click from the two clicks that precede a dblclick
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (pickerPanel.classList.contains('open')) {
      closeSignPicker()
      return
    }
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      clickTimer = null
      return
    }
    clickTimer = setTimeout(() => {
      clickTimer = null
      if (!addMode) return
      markerManager.add(e.latlng.lat, e.latlng.lng, addMode)
      setAddMode(null)
    }, 250)
  })

  map.on('dblclick', (e: L.LeafletMouseEvent) => {
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    setAddMode(null)
    openSignPicker(e.latlng.lat, e.latlng.lng)
  })

  // Toolbar buttons
  document.getElementById('btn-add-right')!.addEventListener('click', () => {
    setAddMode(addMode === 'right' ? null : 'right')
  })

  document.getElementById('btn-add-left')!.addEventListener('click', () => {
    setAddMode(addMode === 'left' ? null : 'left')
  })

  document.getElementById('btn-drive')!.addEventListener('click', () => {
    driveMode.start()
    document.getElementById('drive-controls')!.classList.add('active')
  })

  document.getElementById('btn-drive-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-drive-prev')!.addEventListener('click', () => driveMode.prev())

  function stopDrive() {
    driveMode.stop()
    document.getElementById('drive-controls')!.classList.remove('active')
  }

  document.getElementById('btn-drive-stop')!.addEventListener('click', stopDrive)

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (pickerPanel.classList.contains('open')) { closeSignPicker(); return }
      if (driveMode.isActive()) stopDrive()
      return
    }
    if (!driveMode.isActive()) return
    if (e.key === 'ArrowRight') { e.preventDefault(); driveMode.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); driveMode.prev() }
  })

  document.getElementById('btn-list')!.addEventListener('click', () => {
    document.getElementById('marker-list-panel')!.classList.toggle('open')
  })
}

init().catch(console.error)
