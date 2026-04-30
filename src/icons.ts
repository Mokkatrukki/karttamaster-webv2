import L from 'leaflet'
import type { MarkerType } from './types'

// Handle hidden by default via CSS (.sign-handle { display:none }).
// Shown only when parent has .marker-armed class (armed rotation state).
// transform-origin at circle center (20px 48px) so drag feels natural.
function arrowSvg(direction: MarkerType, bearing: number): string {
  const arrow = direction === 'right' ? '→' : '←'
  const color = direction === 'right' ? '#16a34a' : '#2563eb'
  const typeLabel = direction === 'right' ? 'O' : 'V'
  return `
    <div style="position:relative;width:40px;height:66px">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="66" viewBox="0 0 40 66"
           style="transform:rotate(${bearing}deg);transform-origin:20px 48px;display:block;overflow:visible">
        <g class="sign-handle">
          <line x1="20" y1="12" x2="20" y2="31" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
          <line x1="20" y1="12" x2="20" y2="31" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="20" cy="10" r="8" fill="${color}" stroke="white" stroke-width="2.5"/>
          <line x1="15" y1="10" x2="25" y2="10" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </g>
        <circle cx="20" cy="48" r="17" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="20" y="54" text-anchor="middle" font-size="18" fill="white"
              font-family="sans-serif" font-weight="bold">${arrow}</text>
      </svg>
      <span style="position:absolute;top:27px;right:-3px;background:${color};color:#fff;border-radius:8px;min-width:14px;height:14px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;padding:0 2px;line-height:1;pointer-events:none">${typeLabel}</span>
    </div>`
}

export function createSignIcon(type: MarkerType, bearing: number): L.DivIcon {
  return L.divIcon({
    html: arrowSvg(type, bearing),
    className: '',
    iconSize: [40, 66],
    iconAnchor: [20, 48],
    popupAnchor: [0, -52],
  })
}
