import type { MarkerManager } from '../map/markers'
import { routePositionPct, nearestPointIndex } from '../logic/bearing'
import type { RoutePoint, MarkerStatus } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignLibrary } from '../logic/sign-library'
import { getRole } from '../logic/role'
import { isTerminal } from '../logic/marker-status'

function typeInfo(type: string) {
  return SIGN_TYPES.find((s) => s.type === type) ?? SIGN_TYPES[0]
}

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const ALL_STATUSES: { value: MarkerStatus; label: string }[] = [
  { value: 'suunniteltu', label: 'Suunniteltu' },
  { value: 'asetettu', label: 'Asetettu' },
  { value: 'tarkistettu', label: 'Tarkistettu' },
  { value: 'kerätty', label: 'Kerätty' },
  { value: 'ei_tarpeen', label: 'Ei tarpeen' },
]

function updateBulkApplyBtn(listEl: HTMLElement, modal: HTMLElement | null): void {
  const checkboxes = listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]')
  const checked = Array.from(checkboxes).filter((cb) => cb.checked)
  const applyBtn = modal?.querySelector<HTMLButtonElement>('#btn-bulk-apply')
  const selectAll = modal?.querySelector<HTMLInputElement>('#bulk-select-all')
  if (applyBtn) {
    applyBtn.textContent = `Aseta (${checked.length})`
    applyBtn.disabled = checked.length === 0
  }
  if (selectAll) {
    selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length
    selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length
  }
}

function updateBulkCheckinBtns(listEl: HTMLElement, modal: HTMLElement | null): void {
  const checkboxes = listEl.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]')
  const checked = Array.from(checkboxes).filter((cb) => cb.checked)
  const asetaBtn = modal?.querySelector<HTMLButtonElement>('#btn-bulk-checkin-aseta')
  const ohitaBtn = modal?.querySelector<HTMLButtonElement>('#btn-bulk-checkin-ohita')
  const selectAll = modal?.querySelector<HTMLInputElement>('#bulk-checkin-select-all')
  const n = checked.length
  if (asetaBtn) { asetaBtn.textContent = `✓ Aseta (${n})`; asetaBtn.disabled = n === 0 }
  if (ohitaBtn) { ohitaBtn.textContent = `Ei tarpeen (${n})`; ohitaBtn.disabled = n === 0 }
  if (selectAll) {
    selectAll.indeterminate = n > 0 && n < checkboxes.length
    selectAll.checked = checkboxes.length > 0 && n === checkboxes.length
  }
}

export function renderMarkerList(manager: MarkerManager, highlightId?: string, segmentMarkerIds?: Set<string>, _library?: SignLibrary | null, onOpenDetail?: (id: string) => void): void {
  const allMarkers = manager.getAll()
  // V33: talkoolainen sees only their segment's markers when segmentMarkerIds provided
  const markers = segmentMarkerIds ? allMarkers.filter(m => segmentMarkerIds.has(m.id)) : allMarkers
  const countEl = document.getElementById('marker-count')
  const listEl = document.getElementById('marker-modal-items')
  if (!countEl || !listEl) return

  const isTalkoolainen = getRole() === 'talkoolainen'
  const modal = document.getElementById('marker-modal')

  // Wider modal + bulk toolbar for järjestäjä
  if (!isTalkoolainen) {
    modal?.classList.add('modal--järjestäjä')
    document.getElementById('marker-bulk-action-bar')?.remove()
    let toolbar = document.getElementById('marker-bulk-toolbar')
    if (!toolbar) {
      toolbar = document.createElement('div')
      toolbar.id = 'marker-bulk-toolbar'
      toolbar.className = 'bulk-status-toolbar'
      listEl.parentElement?.insertBefore(toolbar, listEl)
    }
    toolbar.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">
        <input type="checkbox" id="bulk-select-all" class="marker-item-checkbox">
        <span style="font-size:12px;color:var(--text-muted)">Valitse kaikki</span>
      </label>
      <select class="bulk-status-select" id="bulk-status-select">
        ${ALL_STATUSES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')}
      </select>
      <button class="btn-bulk-apply" id="btn-bulk-apply" disabled>Aseta (0)</button>`
  } else {
    modal?.classList.remove('modal--järjestäjä')
    document.getElementById('marker-bulk-toolbar')?.remove()
    // BulkActionBar for talkoolainen (sticky bottom)
    let actionBar = document.getElementById('marker-bulk-action-bar')
    if (!actionBar) {
      actionBar = document.createElement('div')
      actionBar.id = 'marker-bulk-action-bar'
      actionBar.className = 'bulk-action-bar'
      listEl.parentElement?.appendChild(actionBar)
    }
    actionBar.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">
        <input type="checkbox" id="bulk-checkin-select-all" class="marker-item-checkbox">
        <span style="font-size:12px;color:var(--text-muted)">Valitse kaikki</span>
      </label>
      <button class="btn-bulk-checkin-aseta" id="btn-bulk-checkin-aseta" disabled>✓ Aseta (0)</button>
      <button class="btn-bulk-checkin-ohita" id="btn-bulk-checkin-ohita" disabled>Ei tarpeen (0)</button>`
  }

  countEl.textContent = String(markers.length)
  listEl.innerHTML = markers.length === 0
    ? '<p class="empty-state">Ei merkkejä</p>'
    : markers.map((m) => {
        const info = typeInfo(m.type)
        const km = (m.distanceFromStart / 1000).toFixed(2)
        const highlighted = m.id === highlightId ? ' marker-item--new' : ''
        const statusBadge = `<span class="marker-status marker-status--${m.status}">${STATUS_LABELS[m.status]}</span>`
        const checkbox = !isTalkoolainen
          ? `<input type="checkbox" class="marker-item-checkbox" data-id="${m.id}" aria-label="Valitse merkki">`
          : (!isTerminal(m.status) ? `<input type="checkbox" class="marker-checkin-cb" data-id="${m.id}" aria-label="Valitse merkki">` : '')
        return `
          <div class="marker-item${highlighted}" data-id="${m.id}">
            ${checkbox}
            <span class="marker-icon" style="color:${info.color}">${info.label[0]}</span>
            <span class="marker-km">${km} km</span>
            ${statusBadge}
            <span class="marker-type-label">${info.label}</span>
          </div>`
      }).join('')

  listEl.querySelectorAll('.marker-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('marker-item-checkbox')) return
      if (target.classList.contains('marker-checkin-cb')) return
      const id = (el as HTMLElement).dataset.id ?? ''
      if (onOpenDetail) {
        onOpenDetail(id)
      } else {
        manager.panTo(id)
      }
    })
  })

  // Bulk toolbar event handlers (järjestäjä only)
  if (!isTalkoolainen) {
    const toolbar = document.getElementById('marker-bulk-toolbar')
    const selectAllCb = toolbar?.querySelector<HTMLInputElement>('#bulk-select-all')
    const applyBtn = toolbar?.querySelector<HTMLButtonElement>('#btn-bulk-apply')

    listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]').forEach((cb) => {
      cb.addEventListener('change', () => updateBulkApplyBtn(listEl, modal))
    })

    selectAllCb?.addEventListener('change', () => {
      const checked = selectAllCb.checked
      listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]').forEach((cb) => {
        cb.checked = checked
      })
      updateBulkApplyBtn(listEl, modal)
    })

    applyBtn?.addEventListener('click', () => {
      const statusSel = toolbar?.querySelector<HTMLSelectElement>('#bulk-status-select')
      const status = (statusSel?.value ?? 'suunniteltu') as MarkerStatus
      const ids = Array.from(listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]'))
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.id ?? '')
        .filter(Boolean)
      if (ids.length > 0) manager.bulkSetStatus(ids, status)
    })
  } else {
    // BulkActionBar event handlers (talkoolainen only)
    const actionBar = document.getElementById('marker-bulk-action-bar')
    const selectAllCb = actionBar?.querySelector<HTMLInputElement>('#bulk-checkin-select-all')
    const asetaBtn = actionBar?.querySelector<HTMLButtonElement>('#btn-bulk-checkin-aseta')
    const ohitaBtn = actionBar?.querySelector<HTMLButtonElement>('#btn-bulk-checkin-ohita')

    listEl.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]').forEach((cb) => {
      cb.addEventListener('change', () => updateBulkCheckinBtns(listEl, modal))
    })

    selectAllCb?.addEventListener('change', () => {
      const checked = selectAllCb.checked
      listEl.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]').forEach((cb) => {
        cb.checked = checked
      })
      updateBulkCheckinBtns(listEl, modal)
    })

    asetaBtn?.addEventListener('click', () => {
      const ids = Array.from(listEl.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]'))
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.id ?? '')
        .filter(Boolean)
      if (ids.length > 0) manager.bulkSetStatus(ids, 'asetettu')
    })

    ohitaBtn?.addEventListener('click', () => {
      const ids = Array.from(listEl.querySelectorAll<HTMLInputElement>('.marker-checkin-cb[data-id]'))
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.id ?? '')
        .filter(Boolean)
      if (ids.length > 0) manager.bulkSetStatus(ids, 'ei_tarpeen')
    })
  }
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
