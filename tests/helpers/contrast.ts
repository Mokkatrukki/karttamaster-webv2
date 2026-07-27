// Jaettu WCAG-kontrastilaskenta testeille. Väri-invariantit (V216, V252, V244) ovat MITATTAVIA
// ∴ ne testataan luvuilla, ei silmällä — ja laskenta elää yhdessä paikassa, ei kopioina.

export const BASEMAP = '#F2F0EA' // vaalea MML-taustakartta (worst case: vaalein pinta)
export const PILL_TEXT = '#17221D' // --text-body, reittipillerin teksti värin PÄÄLLÄ

export function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Väri alfalla taustan päällä → efektiivinen sävy (Leaflet-viivan opacity). */
export function blend(fg: string, bg: string, alpha: number): string {
  const [f, b] = [toRgb(fg), toRgb(bg)]
  return '#' + f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}

/** HSL-sävykulma asteina — sävyeron mittaamiseen (V216: perheen sisällä ! olla sävyero). */
export function hueOf(hex: string): number {
  const [r, g, b] = toRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return ((h * 60) % 360 + 360) % 360
}

/** Pienin kulmaero ympyrällä (350° ja 10° ovat 20° päässä toisistaan, eivät 340°). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}
