import L from 'leaflet'
import type { RoutePoint } from '../logic/types'

const STEP_METERS = 50
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
    this.currentIndex = 0
    this.onProgress(0)
  }

  jumpTo(index: number): void {
    this.active = true
    this.currentIndex = Math.max(0, Math.min(index, this.routePoints.length - 1))
    this.panToCurrent()
  }

  jumpToDistance(distM: number): void {
    let best = 0, bestDiff = Infinity
    for (let i = 0; i < this.routePoints.length; i++) {
      const diff = Math.abs(this.routePoints[i].distanceFromStart - distM)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    this.jumpTo(best)
  }

  setRoute(routePoints: RoutePoint[]): void {
    this.routePoints = routePoints
    this.currentIndex = 0
    this.active = true
    this.panToCurrent()
  }

  isActive(): boolean {
    return this.active
  }

  next(): void {
    this.active = true
    const current = this.routePoints[this.currentIndex]
    const targetDist = current.distanceFromStart + STEP_METERS
    let i = this.currentIndex
    while (i < this.routePoints.length - 1 && this.routePoints[i].distanceFromStart < targetDist) i++
    this.currentIndex = i
    this.panToCurrent()
  }

  prev(): void {
    this.active = true
    const current = this.routePoints[this.currentIndex]
    const targetDist = current.distanceFromStart - STEP_METERS
    let i = this.currentIndex
    while (i > 0 && this.routePoints[i].distanceFromStart > targetDist) i--
    this.currentIndex = i
    this.panToCurrent()
  }

  currentKm(): number {
    return (this.routePoints[this.currentIndex]?.distanceFromStart ?? 0) / 1000
  }

  totalKm(): number {
    return (this.routePoints[this.routePoints.length - 1]?.distanceFromStart ?? 0) / 1000
  }

  currentIndex_(): number {
    return this.currentIndex
  }

  private panToCurrent(): void {
    const pt = this.routePoints[this.currentIndex]
    this.map.setView([pt.lat, pt.lon], ZOOM_DRIVE, { animate: true })
    this.onProgress(this.currentKm())
  }
}
