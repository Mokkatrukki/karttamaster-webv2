import L from 'leaflet'
import type { RoutePoint } from './types'

const STEP_METERS = 50   // advance 50m per "next" press
const ZOOM_DRIVE = 17

export class DriveMode {
  private active = false
  private currentIndex = 0
  private routePoints: RoutePoint[]
  private map: L.Map
  private onProgress: (km: number) => void

  constructor(map: L.Map, routePoints: RoutePoint[], onProgress: (km: number) => void) {
    this.map = map
    this.routePoints = routePoints
    this.onProgress = onProgress
  }

  start(): void {
    this.active = true
    this.currentIndex = 0
    this.panToCurrent()
  }

  stop(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  next(): void {
    if (!this.active) return
    const current = this.routePoints[this.currentIndex]
    const targetDist = current.distanceFromStart + STEP_METERS
    let i = this.currentIndex
    while (i < this.routePoints.length - 1 && this.routePoints[i].distanceFromStart < targetDist) i++
    this.currentIndex = i
    this.panToCurrent()
  }

  prev(): void {
    if (!this.active) return
    const current = this.routePoints[this.currentIndex]
    const targetDist = current.distanceFromStart - STEP_METERS
    let i = this.currentIndex
    while (i > 0 && this.routePoints[i].distanceFromStart > targetDist) i--
    this.currentIndex = i
    this.panToCurrent()
  }

  currentKm(): number {
    return this.routePoints[this.currentIndex]?.distanceFromStart / 1000 ?? 0
  }

  private panToCurrent(): void {
    const pt = this.routePoints[this.currentIndex]
    this.map.setView([pt.lat, pt.lon], ZOOM_DRIVE, { animate: true })
    this.onProgress(this.currentKm())
  }
}
