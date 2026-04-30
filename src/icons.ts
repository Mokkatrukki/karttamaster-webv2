import L from 'leaflet'
import type { MarkerType } from './types'

function arrowSvg(direction: MarkerType, bearing: number): string {
  const arrow = direction === 'right' ? '→' : '←'
  const color = direction === 'right' ? '#16a34a' : '#2563eb'
  const typeLabel = direction === 'right' ? 'O' : 'V'
  return `
    <div style="position:relative;width:40px;height:40px">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"
           style="transform:rotate(${bearing}deg);transform-origin:center;display:block">
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="20" y="26" text-anchor="middle" font-size="20" fill="white"
              font-family="sans-serif" font-weight="bold">${arrow}</text>
      </svg>
      <span style="position:absolute;top:-3px;right:-3px;background:${color};color:#fff;border-radius:8px;min-width:14px;height:14px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;padding:0 2px;line-height:1;pointer-events:none">${typeLabel}</span>
    </div>`
}

export function createSignIcon(type: MarkerType, bearing: number): L.DivIcon {
  return L.divIcon({
    html: arrowSvg(type, bearing),
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  })
}
