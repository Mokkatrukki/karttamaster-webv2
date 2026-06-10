import L from 'leaflet'
import type { SignMarker } from '../logic/types'

export class MarkerInteraction {
  private rotatingId: string | null = null
  private rotatingCenter: { x: number; y: number } | null = null
  private _armedId: string | null = null
  private contextMenu: HTMLElement | null = null
  private _contextMenuMarkerId: string | null = null

  private readonly handleMouseMove = (e: MouseEvent) => {
    this.applyRotation(e.clientX, e.clientY)
  }
  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) this.applyRotation(e.touches[0].clientX, e.touches[0].clientY)
  }
  private readonly handleRotateEnd = () => {
    if (!this.rotatingId) return
    this.rotatingId = null
    this.rotatingCenter = null
    this.map.dragging.enable()
    const c = this.map.getContainer()
    c.removeEventListener('mousemove', this.handleMouseMove)
    c.removeEventListener('mouseup', this.handleRotateEnd)
    c.removeEventListener('touchmove', this.handleTouchMove)
    c.removeEventListener('touchend', this.handleRotateEnd)
    this.disarm()
    this.onSave()
    this.onUpdate()
  }
  private readonly handleEscKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (this.rotatingId) {
      this.handleRotateEnd()
    } else {
      this.disarm()
    }
  }
  private readonly handleMenuOutside = () => {
    this.hideContextMenu()
  }

  constructor(
    private map: L.Map,
    private leafletMarkers: Map<string, L.Marker>,
    private getMarker: (id: string) => SignMarker | undefined,
    private onRemove: (id: string) => void,
    private onSave: () => void,
    private onUpdate: () => void,
    private onArmChange?: (armedId: string | null) => void,
  ) {
    MarkerInteraction.injectStyles()
  }

  get isRotating(): boolean { return this.rotatingId !== null }
  get armedId(): string | null { return this._armedId }
  get activeContextMenuMarkerId(): string | null { return this._contextMenuMarkerId }

  arm(id: string): void {
    this.disarm()
    this._armedId = id
    const el = this.leafletMarkers.get(id)?.getElement()
    if (el) el.classList.add('marker-armed')
    this.onArmChange?.(id)
    document.addEventListener('keydown', this.handleEscKey)
  }

  disarm(): void {
    if (!this._armedId) return
    const el = this.leafletMarkers.get(this._armedId)?.getElement()
    if (el) el.classList.remove('marker-armed')
    this._armedId = null
    document.removeEventListener('keydown', this.handleEscKey)
    this.onArmChange?.(null)
  }

  startRotation(id: string): void {
    const m = this.getMarker(id)
    if (!m) return
    this.rotatingId = id
    const pt = this.map.latLngToContainerPoint([m.lat, m.lon])
    this.rotatingCenter = { x: pt.x, y: pt.y }
    this.map.dragging.disable()
    const c = this.map.getContainer()
    c.addEventListener('mousemove', this.handleMouseMove)
    c.addEventListener('mouseup', this.handleRotateEnd)
    c.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    c.addEventListener('touchend', this.handleRotateEnd)
  }

  applyRotation(clientX: number, clientY: number): void {
    if (!this.rotatingId || !this.rotatingCenter) return
    const rect = this.map.getContainer().getBoundingClientRect()
    const dx = clientX - rect.left - this.rotatingCenter.x
    const dy = clientY - rect.top - this.rotatingCenter.y
    const bearing = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360
    const m = this.getMarker(this.rotatingId)
    if (!m) return
    m.bearing = bearing
    const el = this.leafletMarkers.get(this.rotatingId)?.getElement()
    const svg = el?.querySelector('svg') as HTMLElement | null
    if (svg) svg.style.transform = `rotate(${bearing}deg)`
  }

  showContextMenu(m: SignMarker, anchorEl: HTMLElement): void {
    this.hideContextMenu()
    const rect = anchorEl.getBoundingClientRect()
    const menu = document.createElement('div')
    menu.className = 'marker-ctx-menu'
    menu.style.top = `${rect.top - 48}px`
    menu.style.left = `${rect.left + rect.width / 2}px`
    menu.style.transform = 'translateX(-50%)'
    menu.addEventListener('click', (e) => e.stopPropagation())
    menu.addEventListener('mousedown', (e) => e.stopPropagation())
    menu.addEventListener('touchstart', (e) => e.stopPropagation())

    const rotateBtn = document.createElement('button')
    rotateBtn.className = 'marker-ctx-rotate'
    rotateBtn.textContent = '↻ Käännä'
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.hideContextMenu()
      this.arm(m.id)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'marker-ctx-delete'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.hideContextMenu()
      this.onRemove(m.id)
    })

    menu.appendChild(rotateBtn)
    menu.appendChild(deleteBtn)
    document.body.appendChild(menu)
    this.contextMenu = menu
    this._contextMenuMarkerId = m.id

    setTimeout(() => {
      document.addEventListener('click', this.handleMenuOutside, { once: true })
    }, 300)
  }

  hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove()
      this.contextMenu = null
      this._contextMenuMarkerId = null
    }
  }

  static injectStyles(): void {
    if (document.getElementById('marker-ctx-styles')) return
    const style = document.createElement('style')
    style.id = 'marker-ctx-styles'
    style.textContent = `
      .marker-ctx-menu {
        position: fixed;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        display: flex;
        gap: 4px;
        padding: 4px;
        z-index: 2000;
        pointer-events: auto;
      }
      .marker-ctx-menu button {
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .marker-ctx-rotate { background: #f59e0b; color: #111; }
      .marker-ctx-delete { background: #ef4444; color: #fff; }
      .sign-handle { display: none; }
      .marker-armed .sign-handle { display: block; }
      .marker-armed { cursor: grab !important; }
    `
    document.head.appendChild(style)
  }
}
