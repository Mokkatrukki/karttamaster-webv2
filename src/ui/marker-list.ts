import type { MarkerManager } from '../map/markers'
import { routePositionPct, nearestPointIndex } from '../logic/bearing'
import type { MarkerType, RoutePoint, MarkerStatus } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignLibrary } from '../logic/sign-library'
import { listTemplates } from '../logic/sign-library'
import { getRole } from '../logic/role'
import { validActions, isTerminal } from '../logic/marker-status'
import type { StatusAction } from '../logic/marker-status'

function typeInfo(type: MarkerType) {
  return SIGN_TYPES.find((s) => s.type === type) ?? SIGN_TYPES[0]
}

const ACTION_LABELS: Record<StatusAction, string> = {
  aseta: '✓ Aseta',
  ohita: 'Ei tarpeen',
  tarkista: '✓ Tarkista',
  kerää: '✓ Kerää',
  peru: '↩ Peru',
}

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const SECONDARY_ACTIONS: StatusAction[] = ['peru', 'ohita']

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

function renderStatusActions(markerId: string, status: MarkerStatus): string {
  if (isTerminal(status)) return ''
  const actions = validActions(status)
  const primary = actions.filter((a) => !SECONDARY_ACTIONS.includes(a))
  const secondary = actions.filter((a) => SECONDARY_ACTIONS.includes(a))
  const primaryBtns = primary
    .map((a) => `<button class="btn-status-primary" data-id="${markerId}" data-action="${a}">${ACTION_LABELS[a]}</button>`)
    .join('')
  const secondaryBtns = secondary
    .map((a) => `<button class="btn-status-secondary" data-id="${markerId}" data-action="${a}">${ACTION_LABELS[a]}</button>`)
    .join('')
  return `<div class="marker-actions">${primaryBtns}${secondaryBtns}</div>`
}

export function renderMarkerList(manager: MarkerManager, highlightId?: string, segmentMarkerIds?: Set<string>, library?: SignLibrary | null): void {
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
  }

  countEl.textContent = String(markers.length)
  listEl.innerHTML = markers.length === 0
    ? '<p class="empty-state">Ei merkkejä</p>'
    : markers.map((m) => {
        const info = typeInfo(m.type)
        const km = (m.distanceFromStart / 1000).toFixed(2)
        const highlighted = m.id === highlightId ? ' marker-item--new' : ''
        const statusBadge = `<span class="marker-status marker-status--${m.status}">${STATUS_LABELS[m.status]}</span>`
        const actions = isTalkoolainen ? renderStatusActions(m.id, m.status) : ''
        const libraryTemplates = library ? listTemplates(library) : []
        const typeSelect = !isTalkoolainen
          ? `<select class="marker-type-select" data-id="${m.id}" title="Vaihda tyyppi">${
              SIGN_TYPES.map((t) => `<option value="${t.type}"${t.type === m.type ? ' selected' : ''}>${t.label}</option>`).join('')
            }${libraryTemplates.length > 0 ? `<optgroup label="Omat mallit">${
              libraryTemplates.map((t) => `<option value="${t.id}" data-color="${t.color}" data-short="${t.shortLabel}"${t.id === m.type ? ' selected' : ''}>${t.label}</option>`).join('')
            }</optgroup>` : ''}</select>`
          : ''
        const checkbox = !isTalkoolainen
          ? `<input type="checkbox" class="marker-item-checkbox" data-id="${m.id}" aria-label="Valitse merkki">`
          : ''
        return `
          <div class="marker-item${highlighted}" data-id="${m.id}">
            ${checkbox}
            <span class="marker-icon" style="color:${info.color}">${info.label[0]}</span>
            <div class="marker-info">
              <div>${info.label}</div>
              <div class="marker-km">${km} km · ${Math.round(m.bearing)}°</div>
              ${statusBadge}
              ${typeSelect}
              <input class="marker-note" data-id="${m.id}" type="text" placeholder="Paikkaohjeet..." maxlength="200">
              ${actions}
            </div>
            <button class="btn-delete" data-id="${m.id}" title="Poista">✕</button>
          </div>`
      }).join('')

  // Set note values via DOM to avoid XSS
  markers.forEach((m) => {
    const input = listEl.querySelector<HTMLInputElement>(`.marker-note[data-id="${m.id}"]`)
    if (input && m.locationNote) input.value = m.locationNote
  })

  listEl.querySelectorAll<HTMLInputElement>('.marker-note').forEach((input) => {
    input.addEventListener('click', (e) => e.stopPropagation())
    input.addEventListener('blur', () => {
      manager.updateNote(input.dataset.id ?? '', input.value.trim())
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
    })
  })

  listEl.querySelectorAll<HTMLButtonElement>('.btn-status-primary, .btn-status-secondary').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.id ?? ''
      const action = btn.dataset.action as StatusAction
      manager.updateStatus(id, action)
    })
  })

  listEl.querySelectorAll<HTMLSelectElement>('.marker-type-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      e.stopPropagation()
      const selectedOption = sel.options[sel.selectedIndex]
      const color = selectedOption?.dataset.color
      const shortLabel = selectedOption?.dataset.short
      manager.updateType(sel.dataset.id ?? '', sel.value as MarkerType, color, shortLabel)
    })
  })

  listEl.querySelectorAll('.marker-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('btn-delete')) return
      if (target.classList.contains('marker-note')) return
      if (target.classList.contains('btn-status-primary')) return
      if (target.classList.contains('btn-status-secondary')) return
      if (target.classList.contains('marker-type-select')) return
      if (target.classList.contains('marker-item-checkbox')) return
      manager.panTo((el as HTMLElement).dataset.id ?? '')
    })
  })

  listEl.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      manager.remove((btn as HTMLElement).dataset.id ?? '')
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
