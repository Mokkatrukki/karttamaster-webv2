import type { MarkerManager } from './markers'
import { routePositionPct, nearestPointIndex } from './bearing'
import type { MarkerType, RoutePoint } from './types'
import { SIGN_TYPES } from './sign-picker'

function typeInfo(type: MarkerType) {
  return SIGN_TYPES.find((s) => s.type === type) ?? SIGN_TYPES[0]
}

export function renderMarkerList(manager: MarkerManager, highlightId?: string): void {
  const markers = manager.getAll()
  const countEl = document.getElementById('marker-count')
  const listEl = document.getElementById('marker-modal-items')
  if (!countEl || !listEl) return

  countEl.textContent = String(markers.length)
  listEl.innerHTML = markers.length === 0
    ? '<p style="padding:12px;color:#6b7280;font-size:13px">Ei merkkejä</p>'
    : markers.map((m) => {
        const info = typeInfo(m.type)
        const km = (m.distanceFromStart / 1000).toFixed(2)
        const highlighted = m.id === highlightId ? ' marker-item--new' : ''
        return `
          <div class="marker-item${highlighted}" data-id="${m.id}">
            <span class="marker-icon" style="color:${info.color}">${info.label[0]}</span>
            <div class="marker-info">
              <div>${info.label}</div>
              <div class="marker-km">${km} km · ${Math.round(m.bearing)}°</div>
            </div>
            <button class="btn-delete" data-id="${m.id}" title="Poista">✕</button>
          </div>`
      }).join('')

  listEl.querySelectorAll('.marker-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('btn-delete')) return
      manager.panTo((el as HTMLElement).dataset.id ?? '')
    })
  })

  listEl.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      manager.remove((btn as HTMLElement).dataset.id ?? '')
    })
  })
}

export function renderSignDots(
  manager: MarkerManager,
  totalDistance: number,
  activeRouteId: string,
  activeRoutePoints: RoutePoint[],
): void {
  const track = document.getElementById('route-track')
  if (!track) return

  track.querySelectorAll('.route-sign-dot').forEach((el) => el.remove())

  if (totalDistance <= 0) return

  // Only show dots for markers on the active drive route
  manager.getForRoute(activeRouteId).forEach((m) => {
    const idx = nearestPointIndex(activeRoutePoints, m.lat, m.lon)
    const dist = activeRoutePoints[idx].distanceFromStart
    const pct = routePositionPct(dist, totalDistance)
    const info = typeInfo(m.type)
    const km = (dist / 1000).toFixed(2)
    const label = `${info.shortLabel} · ${km} km`

    const dot = document.createElement('div')
    dot.className = `route-sign-dot ${m.type}`
    dot.style.left = `${pct}%`
    dot.style.background = info.color
    dot.innerHTML = `<span class="sign-tooltip">${label}</span>`
    track.appendChild(dot)
  })
}
