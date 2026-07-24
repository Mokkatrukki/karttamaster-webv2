import type L from 'leaflet'
import { loadOpacity, saveOpacity, sliderToOpacity, opacityToSlider } from '../logic/basemap-dim'

// T287/V201: pohjakartan näkyvyys-slider. Säätää tilePanen opacityä SUORAAN (slider% / 100).
// Default 100 % = koko kartta. 0 % = pohja häviää, .leaflet-container valkoinen tausta jää
// (paperikarttamaster). 50 % = 50 % kuultaa läpi. EI kosketa L.tileLayeria (setOpacity) →
// tilePane persistoituu ∴ säilyy karttatyyli-vaihdossa. Reitit (overlayPane) + merkit
// (markerPane) opaque → koskemattomia (V51). Asuu ⋯-toolbar-valikossa (#btn-layer vieressä)
// → näkyy molemmille rooleille (map-init.ts).
const SVG_DIM = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>`

export class BasemapDimControl {
  private readonly tilePane: HTMLElement
  private slider!: HTMLInputElement

  constructor(
    map: L.Map,
    private readonly container: HTMLElement,
  ) {
    this.tilePane = map.getPane('tilePane')!
    const opacity = loadOpacity()
    this.applyOpacity(opacity)
    this.build(opacity)
  }

  private applyOpacity(opacity: number): void {
    this.tilePane.style.opacity = String(opacity)
  }

  private build(opacity: number): void {
    // V137/B92: idempotentti render — tyhjennä ettei re-init (logout→login) tuplaa.
    this.container.replaceChildren()
    // Klikki/raahaus sliderissä ei saa sulkea ⋯-valikkoa (document-klikki-sulkija map-init.ts).
    this.container.addEventListener('click', e => e.stopPropagation())

    const row = document.createElement('div')
    row.className = 'basemap-dim'

    const label = document.createElement('span')
    label.className = 'basemap-dim-label'
    label.innerHTML = `${SVG_DIM}<span>Pohjan näkyvyys</span>`

    this.slider = document.createElement('input')
    this.slider.type = 'range'
    this.slider.className = 'basemap-dim-slider'
    this.slider.min = '0'
    this.slider.max = '100'
    this.slider.step = '5'
    this.slider.value = String(opacityToSlider(opacity))
    this.slider.setAttribute('aria-label', 'Pohjakartan näkyvyys')
    this.slider.title = 'Pohjakartan näkyvyys — himmennä niin että merkit ja reitit erottuvat paremmin'
    this.slider.addEventListener('input', () => {
      const op = sliderToOpacity(Number(this.slider.value))
      this.applyOpacity(op)
      saveOpacity(op)
    })

    row.appendChild(label)
    row.appendChild(this.slider)
    this.container.appendChild(row)
  }
}
