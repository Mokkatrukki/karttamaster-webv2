import L from 'leaflet'
import {
  cornersFromRect,
  cornersToRect,
  latLngToLocal,
  localToLatLng,
  rotateLocal,
} from '../logic/area-geometry'

export interface EditableRect {
  centerLat: number
  centerLng: number
  widthM: number
  heightM: number
  rotation: number
}

const CORNER_ICON = L.divIcon({
  className: 'area-corner-handle',
  html: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const ROTATION_ICON = L.divIcon({
  className: 'area-rotation-handle',
  html: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Distance in meters from center to rotation arm tip
const ROTATION_ARM_OFFSET_M = 20

function rectToCorners(rect: EditableRect): [L.LatLng, L.LatLng, L.LatLng, L.LatLng] {
  const pts = cornersFromRect(rect.centerLat, rect.centerLng, rect.widthM, rect.heightM, rect.rotation)
  return pts.map(p => L.latLng(p.lat, p.lng)) as [L.LatLng, L.LatLng, L.LatLng, L.LatLng]
}

function rotationArmTip(rect: EditableRect): L.LatLng {
  // Arm starts North (vM=+offset), rotated CW by rect.rotation — V70
  const arm = rotateLocal(0, ROTATION_ARM_OFFSET_M, rect.rotation)
  const tip = localToLatLng(arm.uM, arm.vM, rect.centerLat, rect.centerLng)
  return L.latLng(tip.lat, tip.lng)
}

export class MapRectEditor {
  private drawPreview: L.Polygon | null = null
  private drawStart: L.LatLng | null = null
  private drawActive = false

  private editId: string | null = null
  private editRect: EditableRect | null = null
  private cornerHandles: L.Marker[] = []
  private rotationHandle: L.Marker | null = null
  private rotationLine: L.Polyline | null = null
  private editOnUpdate: ((r: EditableRect) => void) | null = null
  private editOnDone: (() => void) | null = null
  private onMapClickOutsideHandler: ((e: L.LeafletMouseEvent) => void) | null = null

  private readonly onMapMouseMove = (e: L.LeafletMouseEvent) => this.handleDrawMove(e)
  private readonly onMapMouseUp = (e: L.LeafletMouseEvent) => this.handleDrawEnd(e)
  private readonly onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.drawActive) this.cancelDraw()
      else if (this.editId) this.stopEdit()
    }
  }

  constructor(private readonly map: L.Map) {
    MapRectEditor.injectStyles()
  }

  // ── Draw mode ─────────────────────────────────────────────────────────────

  startDraw(onDone: (rect: { centerLat: number; centerLng: number; widthM: number; heightM: number }) => void): void {
    this.stopEdit()
    this.drawActive = true
    this.map.getContainer().style.cursor = 'crosshair'
    this.map.dragging.disable()
    document.addEventListener('keydown', this.onDocKeyDown)

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      this.drawStart = e.latlng
      this.drawPreview = L.polygon([], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 4',
        className: 'area-draw-preview',
      }).addTo(this.map)

      this.map.on('mousemove', this.onMapMouseMove)
      this.map.once('mouseup', this.onMapMouseUp)
      this.map.off('mousedown', onMouseDown)
    }

    this.map.once('mousedown', onMouseDown)

    // Store cleanup reference on instance for cancelDraw
    ;(this as any)._drawOnDone = onDone
  }

  private handleDrawMove(e: L.LeafletMouseEvent): void {
    if (!this.drawStart || !this.drawPreview) return
    const a = this.drawStart
    const b = e.latlng
    this.drawPreview.setLatLngs([
      [a.lat, a.lng],
      [a.lat, b.lng],
      [b.lat, b.lng],
      [b.lat, a.lng],
    ])
  }

  private handleDrawEnd(e: L.LeafletMouseEvent): void {
    this.map.off('mousemove', this.onMapMouseMove)
    const start = this.drawStart
    const preview = this.drawPreview
    if (start && preview) {
      preview.remove()
      const rect = cornersToRect(
        { lat: start.lat, lng: start.lng },
        { lat: e.latlng.lat, lng: e.latlng.lng },
      )
      this.finishDraw()
      ;(this as any)._drawOnDone?.(rect)
    } else {
      this.finishDraw()
    }
  }

  private finishDraw(): void {
    this.drawActive = false
    this.drawStart = null
    this.drawPreview = null
    this.map.getContainer().style.cursor = ''
    this.map.dragging.enable()
    document.removeEventListener('keydown', this.onDocKeyDown)
  }

  private cancelDraw(): void {
    this.map.off('mousemove', this.onMapMouseMove)
    this.drawPreview?.remove()
    this.finishDraw()
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  isEditing(): boolean {
    return this.editId !== null
  }

  startEdit(
    id: string,
    rect: EditableRect,
    onUpdate: (r: EditableRect) => void,
    onDone: () => void,
  ): void {
    this.stopEdit()
    this.editId = id
    this.editRect = { ...rect }
    this.editOnUpdate = onUpdate
    this.editOnDone = onDone

    // Exit edit when user clicks outside handles/polygon (V69)
    this.onMapClickOutsideHandler = () => {
      const done = this.editOnDone
      this.stopEdit()
      done?.()
    }
    this.map.on('click', this.onMapClickOutsideHandler)
    document.addEventListener('keydown', this.onDocKeyDown)
    this.buildHandles()
  }

  stopEdit(): void {
    if (!this.editId) return
    this.cornerHandles.forEach(h => h.remove())
    this.cornerHandles = []
    this.rotationHandle?.remove()
    this.rotationHandle = null
    this.rotationLine?.remove()
    this.rotationLine = null
    if (this.onMapClickOutsideHandler) {
      this.map.off('click', this.onMapClickOutsideHandler)
      this.onMapClickOutsideHandler = null
    }
    this.editId = null
    this.editRect = null
    this.editOnUpdate = null
    this.editOnDone = null
    document.removeEventListener('keydown', this.onDocKeyDown)
  }

  private buildHandles(): void {
    if (!this.editRect) return
    const rect = this.editRect
    const corners = rectToCorners(rect)

    // 4 corner handles
    corners.forEach((pos, i) => {
      const h = L.marker(pos, { draggable: true, icon: CORNER_ICON }).addTo(this.map)
      h.on('drag', () => this.onCornerDrag(i))
      h.on('dragend', () => this.onCornerDragEnd())
      this.cornerHandles.push(h)
    })

    // Rotation arm line + tip handle
    const center = L.latLng(rect.centerLat, rect.centerLng)
    const tip = rotationArmTip(rect)
    this.rotationLine = L.polyline([center, tip], {
      color: '#f59e0b',
      weight: 2,
      dashArray: '4 3',
    }).addTo(this.map)
    this.rotationHandle = L.marker(tip, { draggable: true, icon: ROTATION_ICON }).addTo(this.map)
    this.rotationHandle.on('drag', () => this.onRotationDrag())
  }

  private onCornerDrag(draggedIndex: number): void {
    if (!this.editRect) return
    const rect = this.editRect
    const draggedPos = this.cornerHandles[draggedIndex].getLatLng()
    const oppositeIndex = (draggedIndex + 2) % 4
    const oppositePos = rectToCorners(rect)[oppositeIndex]

    // Center = midpoint of the two opposite corners (world coords) — V71
    const centerLat = (draggedPos.lat + oppositePos.lat) / 2
    const centerLng = (draggedPos.lng + oppositePos.lng) / 2

    // Project dragged corner into rectangle's rotated frame to get widthM/heightM — V71
    const draggedLocal = latLngToLocal(draggedPos.lat, draggedPos.lng, centerLat, centerLng)
    const frame = rotateLocal(draggedLocal.uM, draggedLocal.vM, -rect.rotation)

    const updated: EditableRect = {
      centerLat,
      centerLng,
      widthM: Math.max(2 * Math.abs(frame.uM), 1),
      heightM: Math.max(2 * Math.abs(frame.vM), 1),
      rotation: rect.rotation,
    }
    this.editRect = updated

    const newCorners = rectToCorners(updated)
    newCorners.forEach((pos, i) => {
      if (i !== draggedIndex) {
        this.cornerHandles[i].setLatLng(pos)
      }
    })

    const tip = rotationArmTip(updated)
    this.rotationLine?.setLatLngs([L.latLng(updated.centerLat, updated.centerLng), tip])
    this.rotationHandle?.setLatLng(tip)

    this.editOnUpdate?.(updated)
  }

  private onCornerDragEnd(): void {
    // editOnDone signals edit session complete; keep handles active (user stays in edit mode)
  }

  private onRotationDrag(): void {
    if (!this.editRect || !this.rotationHandle) return
    const rect = this.editRect
    const tipPos = this.rotationHandle.getLatLng()
    const local = latLngToLocal(tipPos.lat, tipPos.lng, rect.centerLat, rect.centerLng)
    // atan2(uM, vM): vM=north is 0°, clockwise positive (matches bearing convention)
    const rotationRad = Math.atan2(local.uM, local.vM)
    const rotation = ((rotationRad * 180 / Math.PI) + 360) % 360
    const updated: EditableRect = { ...rect, rotation }
    this.editRect = updated

    // Snap tip to exact arm distance
    const exactTip = rotationArmTip(updated)
    this.rotationHandle.setLatLng(exactTip)
    this.rotationLine?.setLatLngs([L.latLng(updated.centerLat, updated.centerLng), exactTip])

    // Update corner positions for new rotation
    const newCorners = rectToCorners(updated)
    newCorners.forEach((pos, i) => this.cornerHandles[i].setLatLng(pos))

    this.editOnUpdate?.(updated)
  }

  static injectStyles(): void {
    if (document.getElementById('map-rect-editor-styles')) return
    const style = document.createElement('style')
    style.id = 'map-rect-editor-styles'
    style.textContent = `
      .area-corner-handle {
        width: 14px !important;
        height: 14px !important;
        border-radius: 50%;
        background: var(--surface-card, #1e293b);
        border: 2px solid #3b82f6;
        cursor: grab;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .area-corner-handle:active { cursor: grabbing; }
      .area-rotation-handle {
        width: 14px !important;
        height: 14px !important;
        border-radius: 50%;
        background: #f59e0b;
        border: 2px solid #fff;
        cursor: grab;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .area-rotation-handle:active { cursor: grabbing; }
    `
    document.head.appendChild(style)
  }
}
