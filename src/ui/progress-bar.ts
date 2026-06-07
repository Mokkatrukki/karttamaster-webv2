import { routePositionPct } from '../logic/bearing'
import { renderSignDots } from './marker-list'
import type { RouteConfig } from '../logic/multi-route'
import type { DriveMode } from '../map/drive'
import type { MarkerManager } from '../map/markers'

export class ProgressBar {
  private readonly trackFill: HTMLElement
  private readonly trackHandle: HTMLElement
  private readonly routeTrack: HTMLElement
  private readonly routeKmEl: HTMLElement
  private trackDragging = false

  constructor(
    private readonly getActiveRoute: () => RouteConfig,
    private readonly getActiveTotalM: () => number,
    private readonly driveMode: DriveMode,
    private readonly markerManager: MarkerManager,
  ) {
    this.trackFill   = document.getElementById('route-track-fill') as HTMLElement
    this.trackHandle = document.getElementById('route-track-handle') as HTMLElement
    this.routeTrack  = document.getElementById('route-track') as HTMLElement
    this.routeKmEl   = document.getElementById('route-km')!
    this.bindDrag()
  }

  update(km: number): void {
    const total = this.getActiveTotalM()
    const pct = routePositionPct(km * 1000, total)
    this.trackFill.style.width   = `${pct}%`
    this.trackHandle.style.left  = `${pct}%`
    this.routeKmEl.textContent   = `${km.toFixed(2)} / ${(total / 1000).toFixed(1)} km`
  }

  refreshDots(): void {
    const r = this.getActiveRoute()
    renderSignDots(this.markerManager, this.getActiveTotalM(), r.id, r.routePoints)
  }

  private jumpToFraction(clientX: number): void {
    const rect = this.routeTrack.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetDist = fraction * this.getActiveTotalM()
    const pts = this.getActiveRoute().routePoints
    let best = 0, bestDiff = Infinity
    for (let i = 0; i < pts.length; i++) {
      const diff = Math.abs(pts[i].distanceFromStart - targetDist)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    this.driveMode.jumpTo(best)
  }

  private bindDrag(): void {
    this.routeTrack.addEventListener('mousedown', e => {
      this.trackDragging = true
      this.jumpToFraction(e.clientX)
    })
    this.routeTrack.addEventListener('touchstart', e => {
      this.trackDragging = true
      this.jumpToFraction(e.touches[0].clientX)
    }, { passive: true })
    document.addEventListener('mousemove', e => {
      if (this.trackDragging) this.jumpToFraction(e.clientX)
    })
    document.addEventListener('touchmove', e => {
      if (this.trackDragging) this.jumpToFraction(e.touches[0].clientX)
    }, { passive: true })
    document.addEventListener('mouseup',  () => { this.trackDragging = false })
    document.addEventListener('touchend', () => { this.trackDragging = false })
  }
}
