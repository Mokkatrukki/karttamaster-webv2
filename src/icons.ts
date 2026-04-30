import L from 'leaflet'
import type { MarkerType } from './types'

// Handle hidden by default via CSS (.sign-handle { display:none }).
// Shown only when parent has .marker-armed class.
// transform-origin at circle center so drag feels natural.
const W = 32
const H = 50
const CX = W / 2   // 16
const CY = 38      // circle center y within SVG (anchor point)
const R  = 14

function circleSvg(type: MarkerType, bearing: number): string {
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

  return `
    <div style="position:relative;width:${W}px;height:${H}px">
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
      <span style="position:absolute;top:28px;right:-4px;background:${color};color:#fff;border-radius:6px;min-width:12px;height:12px;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;padding:0 2px;line-height:1;pointer-events:none">${shortLabel}</span>
    </div>`
}

export function createSignIcon(type: MarkerType, bearing: number): L.DivIcon {
  return L.divIcon({
    html: circleSvg(type, bearing),
    className: '',
    iconSize: [W, H],
    iconAnchor: [CX, CY],
    popupAnchor: [0, -(CY + 4)],
  })
}
