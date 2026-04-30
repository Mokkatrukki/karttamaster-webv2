import type { MarkerManager } from './markers'

export function renderMarkerList(manager: MarkerManager): void {
  const markers = manager.getAll()
  const countEl = document.getElementById('marker-count')
  const listEl = document.getElementById('marker-list-items')
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
