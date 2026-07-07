import L from 'leaflet'
import type { MarkerStatus } from '../logic/types'
import { getIconById } from '../logic/icon-set'
import type { SignVisual } from '../logic/sign-visual'

const W = 32
const H = 52
const CX = W / 2   // 16
const CY = 28      // circle center y within SVG
const R  = 14

// T140/B59: statusväri siirtyi ULKOREUNAAN (stroke), ei täyttöön — täyttö (kuva/ikoni) pysyy aina
// tyyppikohtaisena niin merkin tyyppi tunnistuu edelleen suoraan kuvasta, sama kuva kaikissa
// statuksissa (myös kerätty). Neljä keskenään selkeästi erottuvaa sävyä (vihreä/sininen/violetti/
// harmaa), ei saman perheen pastelleja (entinen #4ade80 vs #6ee7b7 -pari oli lähes identtinen).
const STATUS_RING: Partial<Record<MarkerStatus, string>> = {
  asetettu:    '#22c55e', // vihreä — asetettu paikalleen
  tarkistettu: '#0ea5e9', // taivassininen — tarkistettu (eri sävy kuin 'left'-tyypin indigo #2563eb)
  kerätty:     '#8b5cf6', // violetti — kerätty/purettu (selvästi eri sävyperhe kuin vihreä/sininen)
  ei_tarpeen:  '#78716c', // neutraali harmaa — ei tarvita, pois fokuksesta
}

// T161/T-C: kuva-kyltti suorakaide-korttina — koko kyltti näkyy (object-fit:contain),
// EI enää croppausta 24px-ympyrään. V87 säilyy: kortin reuna = status, sisältö (kuva) = tyyppi.
// Fallback (V99/T103): valkotaustainen <img> peittää alla olevan compact-chipin; onerror poistaa
// kuvan → chip (tyyppiväri + compact-teksti) paljastuu. Sama onerror-sopimus kuin ennen.
const CARD = 40   // kortin sivu px
const TIP = 8     // osoitin-kolmion korkeus
function imageMarkerSvg(imageSrc: string, status: MarkerStatus, compact: string, color: string): string {
  const isPlanned = status === 'suunniteltu'
  const bColor = STATUS_RING[status] ?? '#64748b' // suunniteltu/ei-status → neutraali
  const bStyle = isPlanned ? 'dashed' : 'solid'
  const tip = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${TIP}" viewBox="0 0 16 8" style="position:absolute;bottom:0;left:${(CARD - 16) / 2}px;pointer-events:none;display:block"><path d="M0,0 L8,8 L16,0 Z" fill="${bColor}"/></svg>`
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
  const bColor = STATUS_RING[status] ?? '#64748b'
  const bStyle = isPlanned ? 'dashed' : 'solid'
  const height = parts.length * STACK
  const slots = parts.map((p, i) =>
    `${i > 0 ? `<div style="width:100%;height:1px;background:var(--border-default,#334155)"></div>` : ''}${comboSlotSvg(p, color)}`,
  ).join('')
  const tip = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${TIP}" viewBox="0 0 16 8" style="position:absolute;bottom:0;left:${(STACK - 16) / 2}px;pointer-events:none;display:block"><path d="M0,0 L8,8 L16,0 Z" fill="${bColor}"/></svg>`
  return `
    <div style="position:relative;width:${STACK}px;height:${height + TIP}px">
      <div style="position:absolute;top:0;left:0;width:${STACK}px;height:${height}px;box-sizing:border-box;border:3px ${bStyle} ${bColor};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;flex-direction:column">${slots}</div>
      ${tip}
    </div>`
}

function circleSvg(type: string, status: MarkerStatus, colorOverride?: string, compactOverride?: string, iconId?: string): string {
  let arrow: string
  let color: string
  let isUpcoming = false

  switch (type) {
    case 'right':          arrow = '→'; color = '#16a34a'; break
    case 'left':           arrow = '←'; color = '#2563eb'; break
    case 'upcoming-right': arrow = '↱'; color = '#b45309'; isUpcoming = true; break
    case 'upcoming-left':  arrow = '↰'; color = '#7c3aed'; isUpcoming = true; break
    default:               arrow = compactOverride ?? '?'; color = colorOverride ?? '#94a3b8'; break
  }
  const tipHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="10" viewBox="0 0 32 10" style="position:absolute;bottom:0;left:0;pointer-events:none;display:block"><path d="M8,0 L16,10 L24,0 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>`

  // T140/B59: statusväri ulkoreunaan (stroke) — täyttö pysyy aina tyyppivärinä, sama kuva kaikissa statuksissa
  const ringColor = (!isUpcoming && STATUS_RING[status]) ? STATUS_RING[status]! : 'white'
  const ringWidth = (!isUpcoming && STATUS_RING[status]) ? 4 : 2

  // V50: if iconId given and known, embed Lucide SVG paths in circle instead of text
  const iconEntry = (type === 'right' || type === 'left' || type === 'upcoming-right' || type === 'upcoming-left')
    ? null
    : (iconId ? getIconById(iconId) : null)

  const circleContent = iconEntry
    ? `<g transform="translate(6, 18) scale(0.833)" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">${iconEntry.svgContent}</g>`
    : `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="13" fill="white" font-family="sans-serif" font-weight="bold">${arrow}</text>`

  return `
    <div style="position:relative;width:${W}px;height:${H}px">
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
           viewBox="0 0 ${W} ${H}"
           style="display:block;overflow:visible">
        ${isUpcoming
          ? `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" stroke="white" stroke-width="2" stroke-dasharray="4 2" opacity="0.9"/>`
          : status === 'suunniteltu'
            ? `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" fill-opacity="0.55" stroke="white" stroke-width="2" stroke-dasharray="4 2"/>`
            : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" stroke="${ringColor}" stroke-width="${ringWidth}"/>`
        }
        ${circleContent}
      </svg>
      ${tipHtml}
    </div>`
}

export function createSignIcon(type: string, status: MarkerStatus = 'suunniteltu', color?: string, compact?: string, iconId?: string, imageSrc?: string, visualParts?: SignVisual[]): L.DivIcon {
  // T172/V107: yhdistelmämerkki — pystypino kun 2+ osaa. Yksittäisen osan tapaus (0-1)
  // käyttää olemassa olevaa yksi-visual-renderöintiä (backward-compat).
  if (visualParts && visualParts.length > 1) {
    const height = visualParts.length * STACK + TIP
    return L.divIcon({
      html: comboMarkerSvg(visualParts, status, color ?? '#94a3b8'),
      className: '',
      iconSize: [STACK, height],
      iconAnchor: [STACK / 2, height],
      popupAnchor: [0, -(height + 4)],
    })
  }
  // Kuva → suorakaide-kortti (koko kyltti näkyy). Muut → ympyrä (nuoli/ikoni/label).
  if (imageSrc) {
    return L.divIcon({
      html: imageMarkerSvg(imageSrc, status, compact ?? '', color ?? '#94a3b8'),
      className: '',
      iconSize: [CARD, CARD + TIP],
      iconAnchor: [CARD / 2, CARD + TIP],
      popupAnchor: [0, -(CARD + TIP + 4)],
    })
  }
  return L.divIcon({
    html: circleSvg(type, status, color, compact, iconId),
    className: '',
    iconSize: [W, H],
    iconAnchor: [CX, H],
    popupAnchor: [0, -(H + 4)],
  })
}
