import { positionPicker } from '../logic/sign-picker'
import { listFavorites, type SignLibrary } from '../logic/sign-library'
import type { MarkerType } from '../logic/types'
import type { MarkerManager } from '../map/markers'

export class PlaceMode {
  private placeType: MarkerType | null = null
  private pendingDblClick: { lat: number; lon: number } | null = null

  private readonly mapEl: HTMLElement
  private readonly placeModeLabel: HTMLElement
  private readonly btnAddSign: HTMLElement
  private readonly signTypeDropdown: HTMLElement
  private readonly floatingPicker: HTMLElement

  constructor(
    private readonly markerManager: MarkerManager,
    private readonly library: SignLibrary,
    private readonly onOpenPanel?: () => void,
  ) {
    this.mapEl            = document.getElementById('map')!
    this.placeModeLabel   = document.getElementById('place-mode-label')!
    this.btnAddSign       = document.getElementById('btn-add-sign')!
    this.signTypeDropdown = document.getElementById('sign-type-dropdown')!
    this.floatingPicker   = document.getElementById('floating-picker')!

    this.bindEvents()
  }

  isActive(): boolean { return this.placeType !== null }
  isDropdownOpen(): boolean {
    if (this.onOpenPanel) return false
    return this.signTypeDropdown.classList.contains('open')
  }
  isPickerOpen(): boolean { return this.floatingPicker.classList.contains('open') }

  enter(type: MarkerType): void {
    this.placeType = type
    this.mapEl.classList.add('place-mode')
    this.placeModeLabel.classList.add('active')
    this.btnAddSign.classList.add('place-mode')
    ;(this.btnAddSign as HTMLButtonElement).textContent = '✕ Peruuta'
  }

  exit(): void {
    this.placeType = null
    this.mapEl.classList.remove('place-mode')
    this.placeModeLabel.classList.remove('active')
    this.btnAddSign.classList.remove('place-mode')
    ;(this.btnAddSign as HTMLButtonElement).textContent = '+ Merkki'
  }

  closeDropdown(): void {
    if (this.onOpenPanel) return
    this.signTypeDropdown.classList.remove('open')
  }

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

  onMapClick(lat: number, lon: number): boolean {
    if (!this.placeType) return false
    this.markerManager.add(lat, lon, this.placeType)
    this.exit()
    return true
  }

  private openDropdown(): void {
    if (this.onOpenPanel) {
      this.onOpenPanel()
      return
    }
    const rect = this.btnAddSign.getBoundingClientRect()
    this.signTypeDropdown.style.top  = `${rect.bottom + 4}px`
    this.signTypeDropdown.style.left = `${rect.left}px`
    this.signTypeDropdown.classList.add('open')
  }

  private bindEvents(): void {
    this.btnAddSign.addEventListener('click', () => {
      if (this.placeType) { this.exit(); return }
      this.isDropdownOpen() ? this.closeDropdown() : this.openDropdown()
    })

    this.signTypeDropdown.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('.sign-type-btn') as HTMLElement | null
      if (!btn) return
      this.closeDropdown()
      this.enter(btn.dataset.type as MarkerType)
    })

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
      if (!this.onOpenPanel &&
          !this.signTypeDropdown.contains(target) &&
          !this.btnAddSign.contains(target)) {
        this.closeDropdown()
      }
      if (!this.floatingPicker.contains(target)) this.closePicker()
    })
  }
}
