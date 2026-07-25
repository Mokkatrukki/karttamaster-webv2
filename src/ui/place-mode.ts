import { positionPicker } from '../logic/sign-picker'
import { listFavorites, type SignLibrary, type SignTemplate } from '../logic/sign-library'
import { signImageTag } from '../logic/sign-images'
import { compactLabel } from '../logic/sign-visual'
import { getIconById, renderIconSvg } from '../logic/icon-set'
import type { MarkerType } from '../logic/types'
import type { MarkerManager } from '../map/markers'
import { mapMode as sharedMapMode, type MapModeState } from '../logic/map-mode'

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
    // T307/V218: merkin sijoitus on muokkaustilan toiminto. Injektoitavissa testeille;
    // tuotannossa sama jaettu tila kuin raahauksella ja rajakahvoilla (⊥ rinnakkaisia mekanismeja).
    private readonly mapMode: MapModeState = sharedMapMode,
    // T237: "💬 Huomio" -valinta pickeristä. Puuttuu → riviä ei renderöidä lainkaan
    // (esim. testit / näkymät joissa huomiota ei tueta).
    private readonly onPlaceComment?: (lat: number, lon: number) => void,
  ) {
    this.floatingPicker = document.getElementById('floating-picker')!
    this.bindEvents()
    // Muokkaustilasta poistuminen purkaa myös viritetyn mallin ja avoimen pickerin —
    // muuten "katselu" jäisi vuotamaan sijoituskyvyn seuraavaan karttaklikkiin.
    this.mapMode.onChange(() => {
      if (this.mapMode.canPlaceMarkers()) return
      this.disarm()
      this.closePicker()
    })
  }

  isPickerOpen(): boolean { return this.floatingPicker.classList.contains('open') }

  isArmed(): boolean { return this.armedTemplate !== null }

  armFromSidebar(template: SignTemplate): void {
    // V218: katselutilassa no-op — sivupalkin mallin klikkaus ei viritä karttaa sijoitusvalmiiksi.
    if (!this.mapMode.canPlaceMarkers()) return
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
    if (!this.mapMode.canPlaceMarkers()) return false
    if (!this.armedTemplate) return false
    const t = this.armedTemplate
    this.markerManager.add(lat, lon, t.id as MarkerType, t.color, t.label, t.iconId, t.parts, t.imageId, t.id)
    this.disarm()
    return true
  }

  openPicker(lat: number, lon: number, clientX: number, clientY: number): void {
    // V218: kartan tuplaklikki-haara no-op katselutilassa — pendingDblClick jää null:iksi
    // ∴ myöskään pickerin klikkikäsittelijä ei voi luoda merkkiä (kaksinkertainen portti).
    if (!this.mapMode.canPlaceMarkers()) return
    this.pendingDblClick = { lat, lon }
    this.floatingPicker.innerHTML = listFavorites(this.library).map(t => {
      // V99-precedence sama kuin sign-library-panel.ts buildRow(): kuva > ikoni > compactLabel
      const iconEntry = t.iconId ? getIconById(t.iconId) : null
      const swatchInner = iconEntry ? renderIconSvg(t.iconId!, 14) : escapeHtml(compactLabel(t.label))
      return `
      <button class="sign-type-btn" data-type="${escapeHtml(t.id)}" data-color="${escapeHtml(t.color)}" data-label="${escapeHtml(t.label)}" data-icon="${escapeHtml(t.iconId ?? '')}" data-image="${escapeHtml(t.imageId ?? '')}" data-parts="${escapeHtml(t.parts ? JSON.stringify(t.parts) : '')}">
        <span class="sign-swatch" style="background:${escapeHtml(t.color)};position:relative;overflow:hidden">${swatchInner}${signImageTag(t.imageId ?? t.id, 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff')}</span>
        ${escapeHtml(t.label)}
      </button>`
    }).join('')
    // T237/V245: huomio EI ole merkkityyppi — erotinviiva ennen sitä on pakollinen. Tasavertaisena
    // mallilistassa se luettaisiin merkiksi, ja huomion koko pointti on ettei se mene merkkeihin.
    if (this.onPlaceComment) {
      this.floatingPicker.innerHTML += `
      <div class="floating-picker-divider" role="separator"></div>
      <button class="sign-type-btn floating-picker-comment" data-comment="1">
        <span class="sign-swatch comment-swatch">💬</span>
        Huomio
      </button>`
    }
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
      if (!this.mapMode.canPlaceMarkers()) { this.closePicker(); return }
      const { lat, lon } = this.pendingDblClick
      // T237: huomio-haara ENNEN merkin luontia — tämä rivi ⊥ ole SignTemplate ∴ markerManager.add
      // saisi undefined-tyypin ja loisi rikkinäisen merkin.
      if (btn.dataset.comment) {
        this.closePicker()
        this.onPlaceComment?.(lat, lon)
        return
      }
      const parts = btn.dataset.parts ? JSON.parse(btn.dataset.parts) : undefined
      // T215/V143: viimeinen arg = templateId (= data-type, joka on template.id) → denormalisoi
      // template-viite myös picker-polulla (kuten sidebar armFromSidebar). Ilman tätä talkoolaisen
      // pickeristä sijoittama merkki jäisi ilman templateId:tä (dynaaminen tyyppisuodatin, T218).
      this.markerManager.add(lat, lon, btn.dataset.type as MarkerType, btn.dataset.color, btn.dataset.label, btn.dataset.icon || undefined, parts, btn.dataset.image || undefined, btn.dataset.type)
      this.closePicker()
    })

    this.floatingPicker.addEventListener('mousedown', e => e.stopPropagation())

    document.addEventListener('mousedown', e => {
      const target = e.target as HTMLElement
      if (!this.floatingPicker.contains(target)) this.closePicker()
    })
  }
}
