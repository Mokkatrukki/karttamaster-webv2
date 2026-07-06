import { positionPicker } from '../logic/sign-picker'
import { listFavorites, type SignLibrary, type SignTemplate } from '../logic/sign-library'
import { signImageTag } from '../logic/sign-images'
import { compactLabel } from '../logic/sign-visual'
import type { MarkerType } from '../logic/types'
import type { MarkerManager } from '../map/markers'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export class PlaceMode {
  private pendingDblClick: { lat: number; lon: number } | null = null
  private readonly floatingPicker: HTMLElement
  // T136/V83: sidebar-valittu malli — seuraava kartan klikki sijoittaa sen, ei suosikkivaatimusta
  private armedTemplate: SignTemplate | null = null

  constructor(
    private readonly markerManager: MarkerManager,
    private readonly library: SignLibrary,
  ) {
    this.floatingPicker = document.getElementById('floating-picker')!
    this.bindEvents()
  }

  isPickerOpen(): boolean { return this.floatingPicker.classList.contains('open') }

  isArmed(): boolean { return this.armedTemplate !== null }

  armFromSidebar(template: SignTemplate): void {
    this.closePicker()
    this.armedTemplate = template
    document.getElementById('map')?.classList.add('place-mode')
  }

  disarm(): void {
    this.armedTemplate = null
    document.getElementById('map')?.classList.remove('place-mode')
  }

  // Kutsutaan kartan single-clickistä main.ts:ssä kun isArmed(). Palauttaa true jos sijoitti.
  placeArmedAt(lat: number, lon: number): boolean {
    if (!this.armedTemplate) return false
    const t = this.armedTemplate
    this.markerManager.add(lat, lon, t.id as MarkerType, t.color, t.label)
    this.disarm()
    return true
  }

  openPicker(lat: number, lon: number, clientX: number, clientY: number): void {
    this.pendingDblClick = { lat, lon }
    this.floatingPicker.innerHTML = listFavorites(this.library).map(t => `
      <button class="sign-type-btn" data-type="${escapeHtml(t.id)}" data-color="${escapeHtml(t.color)}" data-label="${escapeHtml(t.label)}">
        <span class="sign-swatch" style="background:${escapeHtml(t.color)};position:relative;overflow:hidden">${escapeHtml(compactLabel(t.label))}${signImageTag(t.imageId ?? t.id, 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff')}</span>
        ${escapeHtml(t.label)}
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
      this.markerManager.add(lat, lon, btn.dataset.type as MarkerType, btn.dataset.color, btn.dataset.label)
      this.closePicker()
    })

    this.floatingPicker.addEventListener('mousedown', e => e.stopPropagation())

    document.addEventListener('mousedown', e => {
      const target = e.target as HTMLElement
      if (!this.floatingPicker.contains(target)) this.closePicker()
    })
  }
}
