import type { MarkerManager } from './markers'
import { routePositionPct } from './bearing'

export function renderMarkerList(manager: MarkerManager): void {
  const markers = manager.getAll()
  const countEl = document.getElementById('marker-count')
  const listEl = document.getElementById('marker-modal-items')
  if (!countEl || !listEl) return

  countEl.textContent = String(markers.length)
  listEl.innerHTML = markers.length === 0
    ? '<p style="padding:12px;color:#6b7280;font-size:13px">Ei merkkejä</p>'
    : markers.map((m) => {
        const dir = m.type === 'right' ? '→' : '←'
        const km = (m.distanceFromStart / 1000).toFixed(2)
        return `
          <div class="marker-item" data-id="${m.id}">
            <span class="marker-icon">${dir}</span>
            <div class="marker-info">
              <div>${m.type === 'right' ? 'Oikealle' : 'Vasemmalle'}</div>
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

export function renderSignDots(manager: MarkerManager, totalDistance: number): void {
  const track = document.getElementById('route-track')
  if (!track) return

  track.querySelectorAll('.route-sign-dot').forEach((el) => el.remove())

  if (totalDistance <= 0) return

  manager.getAll().forEach((m) => {
    const pct = routePositionPct(m.distanceFromStart, totalDistance)
    const km = (m.distanceFromStart / 1000).toFixed(2)
    const label = `${m.type === 'right' ? 'O' : 'V'} · ${km} km`

    const dot = document.createElement('div')
    dot.className = `route-sign-dot ${m.type}`
    dot.style.left = `${pct}%`
    dot.innerHTML = `<span class="sign-tooltip">${label}</span>`
    track.appendChild(dot)
  })
}
