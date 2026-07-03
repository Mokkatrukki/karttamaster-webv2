import L from 'leaflet'
import type { MarkerStatus } from '../logic/types'
import { getIconById } from '../logic/icon-set'

const W = 32
const H = 52
const CX = W / 2   // 16
const CY = 28      // circle center y within SVG
const R  = 14

// T139/B58: koko ympyrän täyttöväri vaihtuu statuksen mukaan (ei enää tyyppiväri kaikissa
// statuksissa) — asetettu/tarkistettu/kerätty erotettava toisistaan yhdellä silmäyksellä,
// ei vain vieressä. Neljä keskenään selkeästi erottuvaa sävyä (vihreä/sininen/violetti/harmaa),
// ei saman perheen pastelleja (entinen #4ade80 vs #6ee7b7 -pari oli lähes identtinen).
const STATUS_FILL: Partial<Record<MarkerStatus, string>> = {
  asetettu:    '#22c55e', // vihreä — asetettu paikalleen
  tarkistettu: '#0ea5e9', // taivassininen — tarkistettu (eri sävy kuin 'left'-tyypin indigo #2563eb)
  kerätty:     '#8b5cf6', // violetti — kerätty/purettu (selvästi eri sävyperhe kuin vihreä/sininen)
  ei_tarpeen:  '#78716c', // neutraali harmaa — ei tarvita, pois fokuksesta
}
// Terminaalitiloissa tyyppi-ikoni vaihtuu isoksi ✓/✕-glyfiksi — tila tärkeämpi kuin tyyppi enää
const STATUS_GLYPH: Partial<Record<MarkerStatus, string>> = {
  kerätty:    '✓',
  ei_tarpeen: '✕',
}

function circleSvg(type: string, status: MarkerStatus, colorOverride?: string, shortLabelOverride?: string, iconId?: string): string {
  let arrow: string
  let color: string
  let isUpcoming = false

  switch (type) {
    case 'right':          arrow = '→'; color = '#16a34a'; break
    case 'left':           arrow = '←'; color = '#2563eb'; break
    case 'upcoming-right': arrow = '↱'; color = '#b45309'; isUpcoming = true; break
    case 'upcoming-left':  arrow = '↰'; color = '#7c3aed'; isUpcoming = true; break
    default:               arrow = shortLabelOverride ?? '?'; color = colorOverride ?? '#94a3b8'; break
  }
  const tipHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="10" viewBox="0 0 32 10" style="position:absolute;bottom:0;left:0;pointer-events:none;display:block"><path d="M8,0 L16,10 L24,0 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>`

  // T139/B58: statuksen mukainen täyttöväri (ei tyyppiväri) suunniteltua/upcoming-tyyppejä lukuun ottamatta —
  // asetettu/tarkistettu/kerätty erottuvat toisistaan värillä ilman että pitää verrata pieniä badgeja vierekkäin
  const fillColor = (!isUpcoming && STATUS_FILL[status]) ? STATUS_FILL[status]! : color

  // V50: if iconId given and known, embed Lucide SVG paths in circle instead of text
  const iconEntry = (type === 'right' || type === 'left' || type === 'upcoming-right' || type === 'upcoming-left')
    ? null
    : (iconId ? getIconById(iconId) : null)

  // T139: terminaalitiloissa (kerätty/ei_tarpeen) iso ✓/✕ korvaa tyyppi-ikonin — status painaa enemmän kuin tyyppi
  const terminalGlyph = STATUS_GLYPH[status]
  const circleContent = terminalGlyph
    ? `<text x="${CX}" y="${CY + 6}" text-anchor="middle" font-size="16" fill="white" font-family="sans-serif" font-weight="900">${terminalGlyph}</text>`
    : iconEntry
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
            : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${fillColor}" stroke="white" stroke-width="2"/>`
        }
        ${circleContent}
      </svg>
      ${tipHtml}
    </div>`
}

export function createSignIcon(type: string, status: MarkerStatus = 'suunniteltu', color?: string, shortLabel?: string, iconId?: string): L.DivIcon {
  return L.divIcon({
    html: circleSvg(type, status, color, shortLabel, iconId),
    className: '',
    iconSize: [W, H],
    iconAnchor: [CX, H],
    popupAnchor: [0, -(H + 4)],
  })
}
