import L from 'leaflet'
import type { MarkerStatus } from '../logic/types'
import { getIconById } from '../logic/icon-set'

const W = 32
const H = 52
const CX = W / 2   // 16
const CY = 28      // circle center y within SVG
const R  = 14

// T138/V85: statusbadge korvaa entisen 8px pisteen — isompi, glyfillinen, korkeampi kontrasti
const STATUS_BADGE: Partial<Record<MarkerStatus, { glyph: string; color: string }>> = {
  asetettu:    { glyph: '✓', color: '#4ade80' },
  tarkistettu: { glyph: '✓', color: '#93c5fd' },
  kerätty:     { glyph: '✓', color: '#6ee7b7' },
  ei_tarpeen:  { glyph: '✕', color: '#fbbf24' },
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
  // T138/V85: yksi selkeä statusbadge — ei enää duplikoi tyyppitekstiä (entinen nurkkabadge poistettu)
  const statusBadge = STATUS_BADGE[status]
  const statusBadgeHtml = statusBadge
    ? `<span style="position:absolute;bottom:12px;right:0px;width:16px;height:16px;border-radius:50%;background:${statusBadge.color};color:#0f172a;font-size:11px;font-weight:900;line-height:1;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.35);pointer-events:none">${statusBadge.glyph}</span>`
    : ''

  const tipHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="10" viewBox="0 0 32 10" style="position:absolute;bottom:0;left:0;pointer-events:none;display:block"><path d="M8,0 L16,10 L24,0 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>`

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
            : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" stroke="white" stroke-width="2"/>`
        }
        ${circleContent}
      </svg>
      ${statusBadgeHtml}
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
