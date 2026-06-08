import L from 'leaflet'

export class GpsNavigator {
  private map: L.Map
  private watchId: number | null = null
  private dot: L.CircleMarker | null = null
  private firstFix = true

  constructor(map: L.Map) {
    this.map = map
  }

  start(): void {
    if (this.watchId !== null) return
    this.firstFix = true
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.dot?.remove()
    this.dot = null
    this.firstFix = true
  }

  isActive(): boolean {
    return this.watchId !== null
  }

  private onPosition(pos: GeolocationPosition): void {
    const { latitude, longitude } = pos.coords
    if (!this.dot) {
      this.dot = L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#1d4ed8',
        weight: 2,
        fillOpacity: 0.9,
        opacity: 1,
        className: 'gps-dot',
      }).addTo(this.map)
    } else {
      this.dot.setLatLng([latitude, longitude])
    }
    if (this.firstFix) {
      this.map.panTo([latitude, longitude])
      this.firstFix = false
    }
  }
}
