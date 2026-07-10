import type { MarkerManager } from '../map/markers'
import { routePositionPct, nearestPointIndex } from '../logic/bearing'
import type { RoutePoint, MarkerStatus } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import { compactLabel } from '../logic/sign-visual'
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

// T102: bulk kohdistuu VAIN näkyviin (filtteröityihin) riveihin. Suodatetut rivit
// saavat .marker-item--filtered-out — ne jätetään kaikkien bulk-operaatioiden ulkopuolelle.
function visibleCheckboxes(listEl: HTMLElement, selector: string): HTMLInputElement[] {
  return Array.from(listEl.querySelectorAll<HTMLInputElement>(selector)).filter(
    (cb) => !cb.closest('.marker-item')?.classList.contains('marker-item--filtered-out'),
  )
}

function updateBulkApplyBtn(listEl: HTMLElement, modal: HTMLElement | null): void {
  const checkboxes = visibleCheckboxes(listEl, '.marker-item-checkbox[data-id]')
  const checked = checkboxes.filter((cb) => cb.checked)
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
  const checkboxes = visibleCheckboxes(listEl, '.marker-checkin-cb[data-id]')
  const checked = checkboxes.filter((cb) => cb.checked)
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

// T102: reaaliaikainen filtteri (haku label|km TAI tyyppi). Piilottaa rivit
// .marker-item--filtered-out-luokalla ja näyttää "Ei tuloksia" tyhjälle tulokselle.
// Palauttaa näkyvien rivien määrän.
function applyMarkerFilter(listEl: HTMLElement, search: string, type: string): number {
  const q = search.trim().toLowerCase()
  const items = listEl.querySelectorAll<HTMLElement>('.marker-item')
  let visible = 0
  items.forEach((item) => {
    const matchesSearch = q === '' || (item.dataset.search ?? '').includes(q)
    const matchesType = type === '' || item.dataset.type === type
    const show = matchesSearch && matchesType
    item.classList.toggle('marker-item--filtered-out', !show)
    if (show) visible++
  })
  let emptyEl = listEl.querySelector<HTMLElement>('.filter-empty-state')
  if (items.length > 0 && visible === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('p')
      emptyEl.className = 'empty-state filter-empty-state'
      emptyEl.textContent = 'Ei tuloksia'
      listEl.appendChild(emptyEl)
    }
  } else if (emptyEl) {
    emptyEl.remove()
  }
  return visible
}

export function renderMarkerList(manager: MarkerManager, highlightId?: string, segmentMarkerIds?: Set<string>, library?: SignLibrary | null, onOpenDetail?: (id: string) => void, pendingIds?: Set<string>): void {
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

    // T102: haku + tyyppifiltteri modaalin yläosaan (järjestäjä). Säilytä nykyinen
    // haku/tyyppi uudelleenrenderöinnin yli (esim. bulk-apply → renderMarkerList).
    let filterBar = document.getElementById('marker-filter-bar')
    const prevSearch = filterBar?.querySelector<HTMLInputElement>('#marker-search')?.value ?? ''
    const prevType = filterBar?.querySelector<HTMLSelectElement>('#marker-type-filter')?.value ?? ''
    if (!filterBar) {
      filterBar = document.createElement('div')
      filterBar.id = 'marker-filter-bar'
      filterBar.className = 'marker-filter-bar'
      listEl.parentElement?.insertBefore(filterBar, listEl)
    }
    const presentTypes = Array.from(new Set(markers.map((m) => m.type)))
    const typeOptions = presentTypes
      .map((t) => {
        const label = library?.get(t)?.label ?? SIGN_TYPES.find((s) => s.type === t)?.label ?? t
        return `<option value="${t}"${t === prevType ? ' selected' : ''}>${label}</option>`
      })
      .join('')
    filterBar.innerHTML = `
      <input type="text" id="marker-search" class="marker-search" placeholder="Hae merkki..." aria-label="Hae merkki">
      <select id="marker-type-filter" class="marker-type-filter" aria-label="Suodata tyypin mukaan">
        <option value="">Kaikki tyypit</option>
        ${typeOptions}
      </select>
      <button type="button" id="marker-filter-clear" class="marker-filter-clear" title="Nollaa suodattimet" aria-label="Nollaa suodattimet">✕</button>`
    const searchRestore = filterBar.querySelector<HTMLInputElement>('#marker-search')
    if (searchRestore) searchRestore.value = prevSearch

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
    document.getElementById('marker-filter-bar')?.remove() // T102: filtteri vain järjestäjälle
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
        const displayColor = m.color ?? info.color
        const templateLabel = library?.get(m.type)?.label
        const displayLabel = templateLabel ?? info.label
        const displayShortLabel = compactLabel(m.label ?? displayLabel)
        const km = (m.distanceFromStart / 1000).toFixed(2)
        const highlighted = m.id === highlightId ? ' marker-item--new' : ''
        // T185/V117: vahvistamaton kirjoitus näkyy listalla persistentisti "tallentamatta".
        const isPending = pendingIds?.has(m.id) ?? false
        const pendingCls = isPending ? ' marker-item--pending' : ''
        const pendingTag = isPending ? '<span class="marker-pending-tag" title="Odottaa tallennusta palvelimelle">tallentamatta</span>' : ''
        const statusBadge = `<span class="marker-status marker-status--${m.status}">${STATUS_LABELS[m.status]}</span>`
        const checkbox = !isTalkoolainen
          ? `<input type="checkbox" class="marker-item-checkbox" data-id="${m.id}" aria-label="Valitse merkki">`
          : (!isTerminal(m.status) ? `<input type="checkbox" class="marker-checkin-cb" data-id="${m.id}" aria-label="Valitse merkki">` : '')
        const deleteBtn = !isTalkoolainen
          ? `<button class="btn-delete" data-id="${m.id}" title="Poista" style="flex-shrink:0">✕</button>`
          : ''
        const noteDot = m.locationNote
          ? `<span class="marker-note-dot" aria-label="Kommentti kirjoitettu"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>`
          : ''
        // T102: haku matchaa label TAI km-väli. Tyyppifiltteri lukee data-type.
        const searchStr = `${displayLabel} ${m.label ?? ''} ${km}`.toLowerCase().replace(/"/g, '')
        return `
          <div class="marker-item${highlighted}${pendingCls}" data-id="${m.id}" data-type="${m.type}" data-search="${searchStr}">
            ${checkbox}
            <span class="marker-icon" style="color:${displayColor}">${displayShortLabel}</span>
            <span class="marker-type-label">${displayLabel}</span>
            ${noteDot}
            ${pendingTag}
            <span class="marker-km">${km} km</span>
            ${statusBadge}
            ${deleteBtn}
          </div>`
      }).join('')

  listEl.querySelectorAll('.marker-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('marker-item-checkbox')) return
      if (target.classList.contains('marker-checkin-cb')) return
      if (target.classList.contains('btn-delete')) return
      const id = (el as HTMLElement).dataset.id ?? ''
      if (onOpenDetail) {
        onOpenDetail(id)
        // V127: merkin valinta → sulje overlay-sivupalkki mobiilissa (LeftPanel kuuntelee).
        // Vain detail-polussa, EI panTo-only-polussa.
        document.dispatchEvent(new CustomEvent('marker-detail-opened'))
      } else {
        manager.panTo(id)
      }
    })
  })

  listEl.querySelectorAll<HTMLButtonElement>('.btn-delete[data-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.id ?? ''
      if (id && window.confirm('Poistetaanko merkki?')) manager.remove(id)
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
      // T102: "Valitse kaikki" valitsee VAIN näkyvät (filtteröidyt) rivit.
      visibleCheckboxes(listEl, '.marker-item-checkbox[data-id]').forEach((cb) => {
        cb.checked = checked
      })
      updateBulkApplyBtn(listEl, modal)
    })

    applyBtn?.addEventListener('click', () => {
      const statusSel = toolbar?.querySelector<HTMLSelectElement>('#bulk-status-select')
      const status = (statusSel?.value ?? 'suunniteltu') as MarkerStatus
      // T102: bulk kohdistuu VAIN näkyviin (filtteröityihin) riveihin.
      const ids = visibleCheckboxes(listEl, '.marker-item-checkbox[data-id]')
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.id ?? '')
        .filter(Boolean)
      if (ids.length > 0) manager.bulkSetStatus(ids, status)
    })

    // T102: filtteri-events (haku + tyyppi + nollaus). Filtteröinti EI renderöi
    // listaa uudelleen — piilottaa rivit → kirjoitusfokus säilyy.
    const filterBar = document.getElementById('marker-filter-bar')
    const searchInput = filterBar?.querySelector<HTMLInputElement>('#marker-search')
    const typeFilter = filterBar?.querySelector<HTMLSelectElement>('#marker-type-filter')
    const clearBtn = filterBar?.querySelector<HTMLButtonElement>('#marker-filter-clear')
    const runFilter = () => {
      applyMarkerFilter(listEl, searchInput?.value ?? '', typeFilter?.value ?? '')
      // Piilotettujen rivien valinnat pois → bulk pysyy näkyvissä riveissä.
      listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]').forEach((cb) => {
        if (cb.closest('.marker-item')?.classList.contains('marker-item--filtered-out')) cb.checked = false
      })
      updateBulkApplyBtn(listEl, modal)
    }
    searchInput?.addEventListener('input', runFilter)
    typeFilter?.addEventListener('change', runFilter)
    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = ''
      if (typeFilter) typeFilter.value = ''
      // Nollaa myös checkbox-valinnat.
      listEl.querySelectorAll<HTMLInputElement>('.marker-item-checkbox[data-id]').forEach((cb) => {
        cb.checked = false
      })
      runFilter()
    })
    // Sovella säilytetty filtteri (uudelleenrenderöinnin jälkeen).
    applyMarkerFilter(listEl, searchInput?.value ?? '', typeFilter?.value ?? '')
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
    const dotColor = m.color ?? info.color
    const dotShortLabel = compactLabel(m.label ?? info.label)
    const km = (dist / 1000).toFixed(2)
    const label = `${dotShortLabel} · ${km} km`

    const dot = document.createElement('div')
    dot.className = `route-sign-dot ${m.type}`
    dot.style.left = `${pct}%`
    dot.style.background = dotColor
    dot.innerHTML = `<span class="sign-tooltip">${label}</span>`
    track.appendChild(dot)
  })
}
