import type L from 'leaflet'

// T441/V327 — NÄKYVÄ IKKUNA.
//
// Kartta on täysleveä & hero/paneelit ovat sen PÄÄLLÄ (tietoinen layout-valinta: mobiilissa
// paneelin verran kutistettu kartta veisi ~40 % näkyvästä maastosta). ∴ kartta-elementin
// keskipiste ⊥ ole se piste jonka käyttäjä näkee. `map.setView(ll, z)` osuu paneelin taakse.
//
// Sääntö asuu TÄSSÄ yhdessä paikassa jonka läpi ∀ keskityskutsu kulkee (markers.panTo,
// segment-fit, drive.panToCurrent). Hajautettuna se on palannut jo kolmesti — jokainen uusi
// kutsupaikka unohtaa sen uudelleen.
//
// Mitat LUETAAN elementeiltä ajossa ⊥ kovakoodata: hero-korkeus vaihtelee vaiheittain (T422),
// `safe-area-inset-bottom` laitteittain, sivupaneeli avautuu & sulkeutuu.

export interface VisiblePadding {
  top: number
  right: number
  bottom: number
  left: number
}

/** Suorakulmion mitat — sama muoto kuin `DOMRect` (mitä `getBoundingClientRect` antaa). */
export interface RectLike {
  top: number
  right: number
  bottom: number
  left: number
}

export const ZERO_PADDING: VisiblePadding = { top: 0, right: 0, bottom: 0, left: 0 }

/** "Näytä kartalla" -zoom (T441c). */
export const ZOOM_SHOW = 18

/**
 * Kohdistus merkkiin LÄHENTÄÄ, ⊥ koskaan loitonna (V327).
 * Loitontaminen on yksi ele; lähentäminen hanska kädessä useita ∴ epäsymmetria on käyttäjän
 * puolella. 15 → 18, mutta 19 → 19.
 */
export function zoomForShow(currentZoom: number, target: number = ZOOM_SHOW): number {
  return currentZoom < target ? target : currentZoom
}

// Paneeli joka syö yli tämän osuuden kartasta ⊥ ole "reunapaneeli" vaan peittää näkymän —
// silloin paddingista ei ole apua ja se vain heittäisi keskityksen kartan ulkopuolelle.
const MAX_INTRUSION_RATIO = 0.6

/**
 * PUHDAS osa: peittävien suorakulmioiden mitoista → näkyvän ikkunan padding.
 *
 * Kukin peittäjä lasketaan siihen reunaan johon se on telakoitunut = se reuna jonka
 * suuntaan tunkeuma on PIENIN. Sama peittäjä ⊥ voi syödä kahta reunaa (muuten avattu
 * sivupaneeli veisi myös ylä- ja alareunan koko korkeudeltaan).
 */
export function paddingFromRects(
  container: RectLike,
  overlays: RectLike[],
  safeBottom = 0,
): VisiblePadding {
  const width = container.right - container.left
  const height = container.bottom - container.top
  const pad: VisiblePadding = { top: 0, right: 0, bottom: Math.max(0, safeBottom), left: 0 }
  if (width <= 0 || height <= 0) return pad

  for (const o of overlays) {
    // Peittäjä joka ⊥ leikkaa karttaa lainkaan (piilotettu, ruudun ulkopuolella) ohitetaan.
    if (o.right <= container.left || o.left >= container.right) continue
    if (o.bottom <= container.top || o.top >= container.bottom) continue

    const candidates: Array<[keyof VisiblePadding, number, number]> = [
      ['left', o.right - container.left, width],
      ['right', container.right - o.left, width],
      ['top', o.bottom - container.top, height],
      ['bottom', container.bottom - o.top, height],
    ]
    let best: [keyof VisiblePadding, number, number] | null = null
    for (const c of candidates) {
      if (c[1] <= 0) continue
      if (!best || c[1] < best[1]) best = c
    }
    if (!best) continue
    const [side, amount, extent] = best
    if (amount > extent * MAX_INTRUSION_RATIO) continue
    if (amount > pad[side]) pad[side] = amount
  }
  return pad
}

// Peittävät elementit. Lista on näkyvä tarkoituksella: uusi kelluva paneeli ! lisätä tähän,
// ⊥ omaan keskityslogiikkaansa.
const OVERLAY_SELECTORS = [
  '#left-panel',
  '#map-filter-bar',
  '#marker-overview',
  '#segment-view-container',
  '#route-bar',
]

function isVisible(el: Element): boolean {
  const he = el as HTMLElement
  if (he.hidden) return false
  if (typeof getComputedStyle !== 'function') return true
  const cs = getComputedStyle(he)
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  return true
}

function safeAreaBottom(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 0
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

/** Kartan näkyvän ikkunan padding — mitat luetaan DOM:ista ajossa. */
export function visiblePadding(map: L.Map): VisiblePadding {
  const container = map?.getContainer?.()
  if (!container || typeof container.getBoundingClientRect !== 'function') return { ...ZERO_PADDING }
  const box = container.getBoundingClientRect()
  const overlays: RectLike[] = []
  if (typeof document !== 'undefined') {
    for (const sel of OVERLAY_SELECTORS) {
      const el = document.querySelector(sel)
      if (!el || !isVisible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      overlays.push(r)
    }
  }
  return paddingFromRects(box, overlays, safeAreaBottom())
}

export interface CenterOptions {
  /** Kohdezoom. Oletus: nykyinen (panorointi ⊥ muuta zoomia). */
  zoom?: number
  /** Lisäpadding oikealle (telakan mitattu leveys, T402) — yhdistetään maksimilla. */
  extraRight?: number
  animate?: boolean
}

function withExtra(pad: VisiblePadding, opts: CenterOptions): VisiblePadding {
  const extra = Math.max(0, opts.extraRight ?? 0)
  return extra > pad.right ? { ...pad, right: extra } : pad
}

/** Keskitä piste NÄKYVÄN ikkunan keskelle (⊥ kartta-elementin keskelle). */
export function centerOn(map: L.Map, latlng: [number, number], opts: CenterOptions = {}): void {
  const zoom = opts.zoom ?? map.getZoom()
  const pad = withExtra(visiblePadding(map), opts)
  if (pad.top === 0 && pad.right === 0 && pad.bottom === 0 && pad.left === 0) {
    map.setView(latlng, zoom, opts.animate === undefined ? undefined : { animate: opts.animate })
    return
  }
  // `setView` ⊥ tue paddingia ∴ yhden pisteen `fitBounds` + `maxZoom` antaa tarkalleen
  // halutun zoomin ja siirtää keskipisteen paddingin verran.
  map.fitBounds([latlng, latlng], {
    paddingTopLeft: [pad.left, pad.top],
    paddingBottomRight: [pad.right, pad.bottom],
    maxZoom: zoom,
    animate: opts.animate,
  })
}

export interface FitOptions {
  maxZoom?: number
  /** Reunapehmuste näkyvän ikkunan SISÄLLÄ (ettei viiva liimaudu reunaan). */
  inset?: number
  extraRight?: number
}

/** Rajaa joukko pisteitä NÄKYVÄÄN ikkunaan. */
export function fitVisible(map: L.Map, latlngs: [number, number][], opts: FitOptions = {}): void {
  if (latlngs.length === 0) return
  const inset = opts.inset ?? 0
  const pad = withExtra(visiblePadding(map), { extraRight: opts.extraRight })
  map.fitBounds(latlngs, {
    paddingTopLeft: [pad.left + inset, pad.top + inset],
    paddingBottomRight: [pad.right + inset, pad.bottom + inset],
    maxZoom: opts.maxZoom,
  })
}
