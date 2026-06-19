import { positionPicker } from '../logic/sign-picker'
import { listFavorites, type SignLibrary } from '../logic/sign-library'
import type { MarkerType } from '../logic/types'
import type { MarkerManager } from '../map/markers'

export class PlaceMode {
  private pendingDblClick: { lat: number; lon: number } | null = null
  private readonly floatingPicker: HTMLElement

  constructor(
    private readonly markerManager: MarkerManager,
    private readonly library: SignLibrary,
  ) {
    this.floatingPicker = document.getElementById('floating-picker')!
    this.bindEvents()
  }

  isPickerOpen(): boolean { return this.floatingPicker.classList.contains('open') }

  openPicker(lat: number, lon: number, clientX: number, clientY: number): void {
    this.pendingDblClick = { lat, lon }
    this.floatingPicker.innerHTML = listFavorites(this.library).map(t => `
      <button class="sign-type-btn" data-type="${t.id}" data-color="${t.color}" data-short="${t.shortLabel}">
        <span class="sign-swatch" style="background:${t.color}">${t.shortLabel}</span>
        ${t.label}
      </button>`).join('')
    this.floatingPicker.classList.add('open')
    requestAnimationFrame(() => {
      const { offsetWidth: w, offsetHeight: h } = this.floatingPicker
      const pos = positionPicker(clientX, clientY, w, h, window.innerWidth, window.innerHeight)
      this.floatingPicker.style.left = `${pos.x}px`
      this.floatingPicker.style.top  = `${pos.y}px`
    })
  }

  closePicker(): void {
    this.floatingPicker.classList.remove('open')
    this.pendingDblClick = null
  }

  private bindEvents(): void {
    this.floatingPicker.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('.sign-type-btn') as HTMLElement | null
      if (!btn || !this.pendingDblClick) return
      const { lat, lon } = this.pendingDblClick
      this.markerManager.add(lat, lon, btn.dataset.type as MarkerType)
      this.closePicker()
    })

    this.floatingPicker.addEventListener('mousedown', e => e.stopPropagation())

    document.addEventListener('mousedown', e => {
      const target = e.target as HTMLElement
      if (!this.floatingPicker.contains(target)) this.closePicker()
    })
  }
}
