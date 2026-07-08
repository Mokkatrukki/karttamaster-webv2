import L from 'leaflet'
import type { MarkerStatus } from '../logic/types'
import { getIconById } from '../logic/icon-set'
import type { SignVisual } from '../logic/sign-visual'

// T140/B59: statusväri ULKOREUNAAN (kortin reuna), ei täyttöön — täyttö (kuva/ikoni/tyyppiväri)
// pysyy tyyppikohtaisena niin merkin tyyppi tunnistuu suoraan, sama sisältö kaikissa statuksissa
// (myös kerätty). Neljä selkeästi erottuvaa sävyä (vihreä/sininen/violetti/kulta), ei saman perheen
// pastelleja. V136/T208: kaikki merkit neliökortteja (ei teardrop), status = kortin reuna.
// V132/T202: statusvärit Reittimerkki-palettiin (§C). Leaflet-DivIcon-SVG ei peri
// :root-tokeneja (vrt. T120) → arvot tässä, synkassa style.css --status-* -tokenien kanssa.
const STATUS_RING: Partial<Record<MarkerStatus, string>> = {
  asetettu:    '#2FA35B', // vihreä — asetettu paikalleen
  tarkistettu: '#3B82C4', // sininen — tarkistettu (eri sävy kuin 'left'-tyypin #2563EB)
  kerätty:     '#8A5CD1', // violetti — kerätty/purettu (eri sävyperhe kuin vihreä/sininen)
  ei_tarpeen:  '#C9922E', // kulta — ei tarvita, pois fokuksesta
}

// T161/T-C: kuva-kyltti suorakaide-korttina — koko kyltti näkyy (object-fit:contain),
// EI enää croppausta 24px-ympyrään. V87 säilyy: kortin reuna = status, sisältö (kuva) = tyyppi.
// Fallback (V99/T103): valkotaustainen <img> peittää alla olevan compact-chipin; onerror poistaa
// kuvan → chip (tyyppiväri + compact-teksti) paljastuu. Sama onerror-sopimus kuin ennen.
const CARD = 40   // kortin sivu px
const TIP = 8     // osoitin-kolmion korkeus
function imageMarkerSvg(imageSrc: string, status: MarkerStatus, compact: string, color: string): string {
  const isPlanned = status === 'suunniteltu'
  const bColor = STATUS_RING[status] ?? '#8A968D' // suunniteltu/ei-status → neutraali
  const bStyle = isPlanned ? 'dashed' : 'solid'
  const tip = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${TIP}" viewBox="0 0 16 8" style="position:absolute;bottom:0;left:${(CARD - 16) / 2}px;pointer-events:none;display:block"><path d="M0,0 L8,8 L16,0 Z" fill="${color}"/></svg>`
  return `
    <div style="position:relative;width:${CARD}px;height:${CARD + TIP}px">
      <div style="position:absolute;top:0;left:0;width:${CARD}px;height:${CARD}px;box-sizing:border-box;background:white;border:3px ${bStyle} ${bColor};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3)">
        <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:${color};color:white;font-family:sans-serif;font-weight:bold;font-size:12px">${compact}</span>
        <img src="${imageSrc}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;pointer-events:none">
      </div>
      ${tip}
    </div>`
}

// T172/V107: yhdistelmämerkki — pystypino kepissä, parts[0] ylin. Sama leveys (STACK)
// kaikilla osilla, 1px jakoviiva slottien välissä. Yksi ankkuripiste/tip koko pinolle
// (ei per-osa tippiä) — koko pino on yksi kartta-objekti. Status = yhteinen ulkoreuna (V87).
const STACK = 40
function comboSlotSvg(part: SignVisual, color: string): string {
  if (part.kind === 'image') {
    return `<div style="width:100%;height:${STACK}px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${part.src}" alt="" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain;pointer-events:none"></div>`
  }
  if (part.kind === 'icon') {
    const iconEntry = getIconById(part.id)
    const svg = iconEntry
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconEntry.svgContent}</svg>`
      : ''
    return `<div style="width:100%;height:${STACK}px;background:${color};display:flex;align-items:center;justify-content:center">${svg}</div>`
  }
  return `<div style="width:100%;height:${STACK}px;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font:900 13px sans-serif">${part.text}</div>`
}

function comboMarkerSvg(parts: SignVisual[], status: MarkerStatus, color: string): string {
  const isPlanned = status === 'suunniteltu'
  const bColor = STATUS_RING[status] ?? '#8A968D'
  const bStyle = isPlanned ? 'dashed' : 'solid'
  const height = parts.length * STACK
  const slots = parts.map((p, i) =>
    `${i > 0 ? `<div style="width:100%;height:1px;background:var(--border-default,#334155)"></div>` : ''}${comboSlotSvg(p, color)}`,
  ).join('')
  const tip = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${TIP}" viewBox="0 0 16 8" style="position:absolute;bottom:0;left:${(STACK - 16) / 2}px;pointer-events:none;display:block"><path d="M0,0 L8,8 L16,0 Z" fill="${color}"/></svg>`
  return `
    <div style="position:relative;width:${STACK}px;height:${height + TIP}px">
      <div style="position:absolute;top:0;left:0;width:${STACK}px;height:${height}px;box-sizing:border-box;border:3px ${bStyle} ${bColor};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;flex-direction:column">${slots}</div>
      ${tip}
    </div>`
}

// V136/T208: ikoni/label-merkki neliökorttina (EI teardrop-ympyrä) — yhtenäinen
// koko + rounding kuva- ja combomerkin kanssa. Täyttö = tyyppiväri, valkoinen glyfi/
// ikoni keskellä. Status = kortin reuna (V87): asetetut → status-väri solid; suunniteltu/
// tuleva → valkoinen katkoviiva. Kärki-kolmio alareunassa tyyppivärillä (ankkuri = kärjen kärki).
function cardSvg(type: string, status: MarkerStatus, colorOverride?: string, compactOverride?: string, iconId?: string): string {
  let glyph: string
  let color: string
  let isUpcoming = false

  switch (type) {
    // Tyyppivärit synkassa SIGN_TYPES (sign-picker.ts) kanssa — V132/T202.
    case 'right':          glyph = '→'; color = '#16A34A'; break
    case 'left':           glyph = '←'; color = '#2563EB'; break
    case 'upcoming-right': glyph = '↱'; color = '#C2410C'; isUpcoming = true; break
    case 'upcoming-left':  glyph = '↰'; color = '#9333EA'; isUpcoming = true; break
    default:               glyph = compactOverride ?? '?'; color = colorOverride ?? '#8A968D'; break
  }
  const isPlanned = status === 'suunniteltu'
  // Status = kortin reuna (V87). suunniteltu/tuleva → valkoinen katkoviiva; muut → status-väri solid.
  const statusRing = (!isUpcoming && !isPlanned) ? STATUS_RING[status] : undefined
  const bColor = statusRing ?? 'white'
  const bStyle = (isPlanned || isUpcoming) ? 'dashed' : 'solid'
  const bWidth = statusRing ? 4 : 3

  // V50: Lucide-ikoni upotettuna (ei suuntatyypeille); muuten glyfi-teksti (nuoli/compactLabel).
  const iconEntry = (type === 'right' || type === 'left' || type === 'upcoming-right' || type === 'upcoming-left')
    ? null
    : (iconId ? getIconById(iconId) : null)
  const content = iconEntry
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconEntry.svgContent}</svg>`
    : `<span style="color:#fff;font-family:sans-serif;font-weight:bold;font-size:18px;line-height:1">${glyph}</span>`

  const tip = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${TIP}" viewBox="0 0 16 8" style="position:absolute;bottom:0;left:${(CARD - 16) / 2}px;pointer-events:none;display:block"><path d="M0,0 L8,8 L16,0 Z" fill="${color}"/></svg>`

  return `
    <div style="position:relative;width:${CARD}px;height:${CARD + TIP}px">
      <div style="position:absolute;top:0;left:0;width:${CARD}px;height:${CARD}px;box-sizing:border-box;background:${color};border:${bWidth}px ${bStyle} ${bColor};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">${content}</div>
      ${tip}
    </div>`
}

export function createSignIcon(type: string, status: MarkerStatus = 'suunniteltu', color?: string, compact?: string, iconId?: string, imageSrc?: string, visualParts?: SignVisual[]): L.DivIcon {
  // T172/V107: yhdistelmämerkki — pystypino kun 2+ osaa. Yksittäisen osan tapaus (0-1)
  // käyttää olemassa olevaa yksi-visual-renderöintiä (backward-compat).
  if (visualParts && visualParts.length > 1) {
    const height = visualParts.length * STACK + TIP
    return L.divIcon({
      html: comboMarkerSvg(visualParts, status, color ?? '#8A968D'),
      className: '',
      iconSize: [STACK, height],
      iconAnchor: [STACK / 2, height],
      popupAnchor: [0, -(height + 4)],
    })
  }
  // Kuva → suorakaide-kortti (koko kyltti näkyy). Muut → ympyrä (nuoli/ikoni/label).
  if (imageSrc) {
    return L.divIcon({
      html: imageMarkerSvg(imageSrc, status, compact ?? '', color ?? '#8A968D'),
      className: '',
      iconSize: [CARD, CARD + TIP],
      iconAnchor: [CARD / 2, CARD + TIP],
      popupAnchor: [0, -(CARD + TIP + 4)],
    })
  }
  return L.divIcon({
    html: cardSvg(type, status, color, compact, iconId),
    className: '',
    iconSize: [CARD, CARD + TIP],
    iconAnchor: [CARD / 2, CARD + TIP],
    popupAnchor: [0, -(CARD + TIP + 4)],
  })
}
