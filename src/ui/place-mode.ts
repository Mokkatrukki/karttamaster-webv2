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
  // T430/V320: yleinen "seuraava karttaklikki tekee TÄMÄN" -viritys. Kasan sijoitus ilman
  // GPS-fixiä käyttää samaa kertaklikkaus-kuviota kuin sivupalkin mallilla sijoitus ∴ kartalla
  // on yhä YKSI klikkikäsittelijä — kaksi kuuntelijaa samasta klikistä olisi B-luokan sekaannus.
  private armedPlacer: ((lat: number, lon: number) => void) | null = null
  // T452/V335: virityksen PURKU on yksi suppilo (Esc, Peruuta, sijoitus, moodinvaihto kulkevat
  // kaikki `disarm()`in läpi) ∴ sijoitustilan siivous (ohjerivi pois, näkymämoodi takaisin)
  // ripustetaan tähän — ei jokaiseen poistumistiehen erikseen, koska juuri se tie joka jää
  // kytkemättä on se jolla käyttäjä jää tilaan josta ⊥ pääse ulos.
  private armedDisarm: (() => void) | null = null

  constructor(
    private readonly markerManager: MarkerManager,
    private readonly library: SignLibrary,
    // T307/V218: merkin sijoitus on muokkaustilan toiminto. Injektoitavissa testeille;
    // tuotannossa sama jaettu tila kuin raahauksella ja rajakahvoilla (⊥ rinnakkaisia mekanismeja).
    private readonly mapMode: MapModeState = sharedMapMode,
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

  isArmed(): boolean { return this.armedTemplate !== null || this.armedPlacer !== null }

  armFromSidebar(template: SignTemplate): void {
    // V218: katselutilassa no-op — sivupalkin mallin klikkaus ei viritä karttaa sijoitusvalmiiksi.
    if (!this.mapMode.canPlaceMarkers()) return
    // T454/V339: toinen sijoitus purkaa edellisen TILAN (esim. kesken jäänyt kasan sijoitus)
    // ∴ ohjerivi & esikatselupiste ⊥ jää roikkumaan merkin sijoituksen päälle.
    this.disarm()
    this.closePicker()
    this.armedTemplate = template
    document.getElementById('map')?.classList.add('place-mode')
  }

  /**
   * T430/V320: viritä kartta yhtä sijoitusta varten. `fn` saa klikin koordinaatit ja päättää
   * itse mitä syntyy — PlaceMode ⊥ tunne kasaa eikä sen sisältöä (kerrosraja).
   */
  armPlacer(fn: (lat: number, lon: number) => void, onDisarm?: () => void): void {
    if (!this.mapMode.canPlaceMarkers()) return
    this.closePicker()
    this.armedTemplate = null
    this.armedPlacer = fn
    this.armedDisarm = onDisarm ?? null
    document.getElementById('map')?.classList.add('place-mode')
  }

  disarm(): void {
    this.clearArmed()
    // Nollataan ENNEN kutsua: siivous joka itse kutsuisi `disarm()`in (esim. moodinvaihto)
    // ⊥ saa laukaista itseään uudelleen.
    const cleanup = this.armedDisarm
    this.armedDisarm = null
    cleanup?.()
  }

  /**
   * T454/V339: VIRITYKSEN purku ilman TILAN purkua. Napautus ! kuluttaa virityksen heti
   * (⊥ kahta sijoitusta yhdestä eleestä & heittävä `fn` ⊥ jätä karttaa viritetyksi), mutta
   * `armedDisarm` on sen TILAN siivous jonka tulosta ollaan juuri käyttämässä — sen ajaminen
   * tässä vei kartan pois näkyvistä samalla napautuksella joka antoi koordinaatin (B186).
   * Kutsuja purkaa tilan `disarm()`illa kun tulos on käytetty tai teko peruttu.
   */
  private clearArmed(): void {
    this.armedTemplate = null
    this.armedPlacer = null
    document.getElementById('map')?.classList.remove('place-mode')
  }

  // Kutsutaan kartan single-clickistä main.ts:ssä kun isArmed(). Palauttaa true jos sijoitti.
  placeArmedAt(lat: number, lon: number): boolean {
    if (!this.mapMode.canPlaceMarkers()) return false
    if (this.armedPlacer) {
      const fn = this.armedPlacer
      // Viritys puretaan ENNEN kutsua: jos `fn` heittää, kartta ⊥ jää sijoitustilaan jossa
      // jokainen seuraava klikki yrittäisi samaa uudelleen. TILAN siivous (`armedDisarm`)
      // jää odottamaan — V339: se purkaisi juuri sen ympäristön jota `fn` tarvitsee.
      this.clearArmed()
      fn(lat, lon)
      return true
    }
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
    const templateHtml = listFavorites(this.library).map(t => {
      // V99-precedence sama kuin sign-library-panel.ts buildRow(): kuva > ikoni > compactLabel
      const iconEntry = t.iconId ? getIconById(t.iconId) : null
      const swatchInner = iconEntry ? renderIconSvg(t.iconId!, 14) : escapeHtml(compactLabel(t.label))
      return `
      <button class="sign-type-btn" data-type="${escapeHtml(t.id)}" data-color="${escapeHtml(t.color)}" data-label="${escapeHtml(t.label)}" data-icon="${escapeHtml(t.iconId ?? '')}" data-image="${escapeHtml(t.imageId ?? '')}" data-parts="${escapeHtml(t.parts ? JSON.stringify(t.parts) : '')}">
        <span class="sign-swatch" style="background:${escapeHtml(t.color)};position:relative;overflow:hidden">${swatchInner}${signImageTag(t.imageId ?? t.id, 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff')}</span>
        ${escapeHtml(t.label)}
      </button>`
    }).join('')

    // T380/V275: pickerin "💬 Huomio" -alapalkki poistettu huomiosysteemin mukana.
    this.floatingPicker.innerHTML = `<div class="floating-picker-list">${templateHtml}</div>`
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
