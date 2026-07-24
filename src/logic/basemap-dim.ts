// T287/V201: pohjakartan näkyvyys — puhdas logiikka (clamp + persist + slider-map).
// Ei Leafletia, ei DOM:ia → Vitest-pure. Näkyvyys = tilePanen opacity SUORAAN
// (slider% / 100). Default 100 % = koko kartta. 0 % = pohja häviää, .leaflet-container
// valkoinen tausta jää (paperi). 50 % = 50 % kuultaa läpi.
export const BASEMAP_OPACITY_LS_KEY = 'karttamaster-basemap-opacity'
export const DEFAULT_OPACITY = 1

type Getter = Pick<Storage, 'getItem'>
type Setter = Pick<Storage, 'setItem'>

export function clampOpacity(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_OPACITY
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

export function loadOpacity(store: Getter = localStorage): number {
  const raw = store.getItem(BASEMAP_OPACITY_LS_KEY)
  if (raw == null) return DEFAULT_OPACITY
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? clampOpacity(n) : DEFAULT_OPACITY
}

export function saveOpacity(v: number, store: Setter = localStorage): number {
  const c = clampOpacity(v)
  store.setItem(BASEMAP_OPACITY_LS_KEY, String(c))
  return c
}

// slider 0..100 (%) ↔ opacity 0..1
export function sliderToOpacity(pct: number): number {
  const p = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 100
  return clampOpacity(p / 100)
}

export function opacityToSlider(opacity: number): number {
  return Math.round(clampOpacity(opacity) * 100)
}
