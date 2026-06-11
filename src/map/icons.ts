import L from 'leaflet'
import type { MarkerType, MarkerStatus } from '../logic/types'

const W = 32
const H = 52
const CX = W / 2   // 16
const CY = 28      // circle center y within SVG
const R  = 14

const STATUS_DOT_COLOR: Partial<Record<MarkerStatus, string>> = {
  asetettu:    '#4ade80',
  tarkistettu: '#93c5fd',
  kerätty:     '#6ee7b7',
  ei_tarpeen:  '#fbbf24',
}

function circleSvg(type: MarkerType, bearing: number, status: MarkerStatus): string {
  let arrow: string
  let color: string
  let shortLabel: string

  switch (type) {
    case 'right':          arrow = '→'; color = '#16a34a'; shortLabel = 'O';  break
    case 'left':           arrow = '←'; color = '#2563eb'; shortLabel = 'V';  break
    case 'upcoming-right': arrow = '↱'; color = '#b45309'; shortLabel = 'TO'; break
    case 'upcoming-left':  arrow = '↰'; color = '#7c3aed'; shortLabel = 'TV'; break
  }

  const isUpcoming = type === 'upcoming-left' || type === 'upcoming-right'
  const opacity = status === 'suunniteltu' ? 0.45 : 1.0
  const dotColor = STATUS_DOT_COLOR[status]
  const dotHtml = dotColor
    ? `<span style="position:absolute;bottom:12px;right:0px;width:8px;height:8px;border-radius:50%;background:${dotColor};border:1.5px solid #fff;pointer-events:none"></span>`
    : ''

  const tipHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="10" viewBox="0 0 32 10" style="position:absolute;bottom:0;left:0;pointer-events:none;display:block"><path d="M8,0 L16,10 L24,0 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>`

  return `
    <div style="position:relative;width:${W}px;height:${H}px;opacity:${opacity}">
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
           viewBox="0 0 ${W} ${H}"
           style="transform:rotate(${bearing}deg);transform-origin:${CX}px ${CY}px;display:block;overflow:visible">
        <g class="sign-handle">
          <line x1="${CX}" y1="6" x2="${CX}" y2="18"
                stroke="${color}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="${CX}" cy="5" r="5" fill="${color}" stroke="white" stroke-width="2"/>
          <line x1="${CX - 4}" y1="5" x2="${CX + 4}" y2="5"
                stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        ${isUpcoming
          ? `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" stroke="white" stroke-width="2" stroke-dasharray="4 2" opacity="0.9"/>`
          : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${color}" stroke="white" stroke-width="2"/>`
        }
        <text x="${CX}" y="${CY + 5}" text-anchor="middle"
              font-size="13" fill="white" font-family="sans-serif" font-weight="bold">${arrow}</text>
      </svg>
      <span style="position:absolute;top:16px;right:-4px;background:${color};color:#fff;border-radius:6px;min-width:12px;height:12px;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;padding:0 2px;line-height:1;pointer-events:none">${shortLabel}</span>
      ${dotHtml}
      ${tipHtml}
    </div>`
}

export function createSignIcon(type: MarkerType, bearing: number, status: MarkerStatus = 'suunniteltu'): L.DivIcon {
  return L.divIcon({
    html: circleSvg(type, bearing, status),
    className: '',
    iconSize: [W, H],
    iconAnchor: [CX, H],
    popupAnchor: [0, -(H + 4)],
  })
}
