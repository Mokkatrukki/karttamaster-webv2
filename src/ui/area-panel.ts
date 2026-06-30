import { createAreaMarker, addFeature } from '../logic/area-types'
import type { AreaMarker, AreaFeature } from '../logic/area-types'
import { AreaDetailsModal } from './area-details-modal'

const FEATURE_COLORS_FIRST = '#4ade80'

export interface AreaPanelCallbacks {
  onAreaAdd?: (area: AreaMarker) => void
  onAreaUpdate?: (area: AreaMarker) => void
  onAreaDelete?: (areaId: string) => void
  onEnterDrawMode?: (onDone: (rect: { centerLat: number; centerLng: number; widthM: number; heightM: number }) => void) => void
  onEnterMapMode?: (onMapClick: (lat: number, lng: number) => void) => void
  onExitMapMode?: () => void
}

export class AreaPanel {
  private areas: AreaMarker[] = []
  private collapsed = true
  private expandedAreas = new Set<string>()
  private readonly detailsModal: AreaDetailsModal

  private readonly listEl: HTMLUListElement
  private readonly sectionEl: HTMLElement

  constructor(
    container: HTMLElement,
    initialAreas: AreaMarker[] = [],
    private readonly callbacks: AreaPanelCallbacks = {},
  ) {
    this.areas = [...initialAreas]
    this.detailsModal = new AreaDetailsModal({
      onAreaUpdate: (updated) => this.updateArea(updated),
      onAreaDelete: (id) => this.deleteArea(id),
    })

    const { section, list } = this.build()
    this.sectionEl = section
    this.listEl = list
    container.appendChild(section)
    this.render()
  }

  private build(): { section: HTMLElement; list: HTMLUListElement } {
    const section = document.createElement('div')
    section.className = 'left-panel-section area-section'

    const header = document.createElement('div')
    header.className = 'left-panel-section-header'
    header.setAttribute('role', 'button')
    header.setAttribute('tabindex', '0')

    const toggleIcon = document.createElement('span')
    toggleIcon.className = 'section-toggle-icon'
    toggleIcon.textContent = '▶'
    toggleIcon.style.cssText =
      'font-size:11px;color:var(--text-muted);flex-shrink:0;margin-right:6px'

    const titleSpan = document.createElement('span')
    titleSpan.style.cssText =
      'font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);flex:1'
    titleSpan.textContent = 'Alueet'

    const countSpan = document.createElement('span')
    countSpan.className = 'area-section-count'
    countSpan.style.cssText = 'font-size:11px;color:var(--text-meta)'
    countSpan.textContent = '(0)'

    header.append(toggleIcon, titleSpan, countSpan)
    header.addEventListener('click', () => this.toggleCollapse())

    const list = document.createElement('ul')
    list.className = 'area-list'
    list.hidden = true
    list.style.cssText = 'list-style:none;margin:0;padding:0'

    const footer = document.createElement('button')
    footer.className = 'area-section-footer btn-area-add'
    footer.textContent = '+ Lisää alue'
    footer.hidden = true
    footer.style.cssText =
      'width:100%;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);color:var(--text-muted);font-size:12px;cursor:pointer'
    footer.addEventListener('click', () => this.startAddFlow())

    section.append(header, list, footer)
    return { section, list }
  }

  private toggleCollapse(): void {
    this.collapsed = !this.collapsed
    const icon = this.sectionEl.querySelector('.section-toggle-icon') as HTMLElement
    const footer = this.sectionEl.querySelector('.btn-area-add') as HTMLElement
    icon.textContent = this.collapsed ? '▶' : '▼'
    this.listEl.hidden = this.collapsed
    footer.hidden = this.collapsed
  }

  private toggleAreaExpand(areaId: string): void {
    if (this.expandedAreas.has(areaId)) {
      this.expandedAreas.delete(areaId)
    } else {
      this.expandedAreas.add(areaId)
    }
    this.render()
  }

  render(): void {
    this.listEl.innerHTML = ''
    const countEl = this.sectionEl.querySelector('.area-section-count') as HTMLElement
    countEl.textContent = `(${this.areas.length})`

    for (const area of this.areas) {
      const isExpanded = this.expandedAreas.has(area.id)

      const li = document.createElement('li')
      li.className = 'area-item'
      li.dataset.areaId = area.id

      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;align-items:center;min-height:44px;border-bottom:1px solid var(--border-card)'

      const expandBtn = document.createElement('button')
      expandBtn.textContent = isExpanded ? '▼' : '▶'
      expandBtn.setAttribute('aria-label', isExpanded ? 'Sulje komponentit' : 'Näytä komponentit')
      expandBtn.style.cssText =
        'min-width:32px;min-height:44px;background:transparent;border:none;color:var(--text-muted);font-size:10px;cursor:pointer;flex-shrink:0'
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleAreaExpand(area.id)
      })

      const label = document.createElement('button')
      label.style.cssText =
        'flex:1;min-height:44px;background:transparent;border:none;text-align:left;padding:0 4px;font-size:12px;color:var(--text-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer'
      label.textContent = area.name || '(nimetön)'
      label.addEventListener('click', () => this.toggleAreaExpand(area.id))

      const statusBadge = document.createElement('span')
      statusBadge.style.cssText =
        'font-size:10px;padding:2px 4px;border-radius:4px;margin-right:4px;flex-shrink:0'
      if (area.status === 'valmis') {
        statusBadge.textContent = '✓'
        statusBadge.style.color = '#4ade80'
      } else {
        statusBadge.textContent = `(${area.features.length})`
        statusBadge.style.color = 'var(--text-meta)'
      }

      const dotsBtn = document.createElement('button')
      dotsBtn.className = 'btn-area-dots'
      dotsBtn.textContent = '···'
      dotsBtn.setAttribute('aria-label', 'Muokkaa aluetta')
      dotsBtn.style.cssText =
        'min-width:44px;min-height:44px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;flex-shrink:0'
      dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.detailsModal.open(area)
      })

      row.append(expandBtn, label, statusBadge, dotsBtn)

      const subList = document.createElement('ul')
      subList.className = 'area-feature-sublist'
      subList.style.cssText =
        'list-style:none;margin:0;padding:0;background:var(--surface-raised, rgba(255,255,255,0.03))'
      subList.hidden = !isExpanded
      this.buildFeatureSubList(subList, area)

      li.append(row, subList)
      this.listEl.appendChild(li)
    }
  }

  private buildFeatureSubList(subList: HTMLUListElement, area: AreaMarker): void {
    subList.innerHTML = ''

    if (area.features.length === 0) {
      const empty = document.createElement('li')
      empty.style.cssText =
        'padding:8px 8px 8px 28px;font-size:11px;color:var(--text-meta);border-bottom:1px solid var(--border-card)'
      empty.textContent = 'Ei komponentteja'
      subList.appendChild(empty)
    } else {
      for (const feat of area.features) {
        subList.appendChild(this.buildFeatureSubRow(feat, area))
      }
    }

    const addLi = document.createElement('li')
    const addBtn = document.createElement('button')
    addBtn.className = 'btn-area-add-feature-sidebar'
    addBtn.textContent = '+ Lisää komponentti'
    addBtn.style.cssText =
      'width:100%;min-height:44px;background:transparent;border:none;border-top:1px dashed var(--border-card);color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 8px 0 28px'
    addBtn.addEventListener('click', () => this.startAddFeatureFlow(area))
    addLi.appendChild(addBtn)
    subList.appendChild(addLi)
  }

  private buildFeatureSubRow(feat: AreaFeature, area: AreaMarker): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'feat-row'
    li.style.cssText =
      'display:flex;align-items:center;gap:8px;min-height:40px;padding:0 8px 0 28px;border-bottom:1px solid var(--border-card)'

    const swatch = document.createElement('span')
    swatch.style.cssText = `width:14px;height:14px;border-radius:3px;background:${feat.color};flex-shrink:0`

    const name = document.createElement('span')
    name.style.cssText =
      'flex:1;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
    name.textContent = feat.name || '(nimetön)'
    name.addEventListener('dblclick', () => this.enterInlineEdit(li, feat, area))

    const editBtn = document.createElement('button')
    editBtn.className = 'btn-feat-inline-edit'
    editBtn.textContent = '✎'
    editBtn.setAttribute('aria-label', 'Muokkaa komponenttia')
    editBtn.style.cssText =
      'min-width:44px;min-height:44px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;flex-shrink:0'
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.enterInlineEdit(li, feat, area)
    })

    li.append(swatch, name, editBtn)
    return li
  }

  private enterInlineEdit(li: HTMLLIElement, feat: AreaFeature, area: AreaMarker): void {
    if (li.classList.contains('editing')) return

    li.classList.add('editing')
    li.innerHTML = ''

    const swatch = document.createElement('span')
    swatch.style.cssText = `width:14px;height:14px;border-radius:3px;background:${feat.color};flex-shrink:0`

    const input = document.createElement('input')
    input.type = 'text'
    input.value = feat.name ?? ''
    input.placeholder = 'Komponentin nimi'
    input.className = 'feat-inline-name-input'
    input.style.cssText =
      'flex:1;min-height:36px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;padding:0 8px;font-size:12px;color:var(--text-body);min-width:0'

    const colorSelect = document.createElement('select')
    colorSelect.className = 'feat-inline-color-select'
    colorSelect.style.cssText =
      'min-height:36px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;padding:0 4px;font-size:12px;color:var(--text-body);flex-shrink:0'
    const FEAT_COLORS = ['#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#a78bfa', '#34d399']
    for (const c of FEAT_COLORS) {
      const opt = document.createElement('option')
      opt.value = c
      opt.textContent = c
      opt.selected = c === feat.color
      colorSelect.appendChild(opt)
    }

    const save = (): void => {
      const newName = input.value.trim() || undefined
      const newColor = colorSelect.value
      const updatedFeatures = area.features.map(f =>
        f.id === feat.id ? { ...f, name: newName, color: newColor } : f,
      )
      const updatedArea: AreaMarker = { ...area, features: updatedFeatures }
      this.updateArea(updatedArea)
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save() }
      if (e.key === 'Escape') { this.render() }
    })
    input.addEventListener('blur', () => {
      if (li.classList.contains('editing')) save()
    })

    li.append(swatch, input, colorSelect)
    input.focus()
  }

  private startAddFeatureFlow(area: AreaMarker): void {
    if (!this.callbacks.onEnterDrawMode) return
    this.callbacks.onEnterDrawMode((rect) => {
      const feat: AreaFeature = {
        id: crypto.randomUUID(),
        name: undefined,
        centerLat: rect.centerLat,
        centerLng: rect.centerLng,
        widthM: rect.widthM,
        heightM: rect.heightM,
        rotation: 0,
        color: FEATURE_COLORS_FIRST,
      }
      const updatedArea = addFeature(area, feat)
      this.updateArea(updatedArea)
      this.expandedAreas.add(area.id)
    })
  }

  private startAddFlow(): void {
    if (this.callbacks.onEnterDrawMode) {
      this.callbacks.onEnterDrawMode((rect) => {
        const name = window.prompt('Alueen nimi:')
        if (!name?.trim()) return
        const area = createAreaMarker({
          id: crypto.randomUUID(),
          name: name.trim(),
          centerLat: rect.centerLat,
          centerLng: rect.centerLng,
          widthM: rect.widthM,
          heightM: rect.heightM,
          rotation: 0,
          markdownDescription: '',
          hashCode: crypto.randomUUID() + crypto.randomUUID(),
        })
        this.areas.push(area)
        this.render()
        this.callbacks.onAreaAdd?.(area)
      })
    } else {
      const name = window.prompt('Alueen nimi:')
      if (!name?.trim()) return
      this.callbacks.onEnterMapMode?.((lat, lng) => {
        this.callbacks.onExitMapMode?.()
        const area = createAreaMarker({
          id: crypto.randomUUID(),
          name: name.trim(),
          centerLat: lat,
          centerLng: lng,
          widthM: 60,
          heightM: 40,
          rotation: 0,
          markdownDescription: '',
          hashCode: crypto.randomUUID() + crypto.randomUUID(),
        })
        this.areas.push(area)
        this.render()
        this.callbacks.onAreaAdd?.(area)
      })
    }
  }

  openDetailsModal(area: AreaMarker): void {
    this.detailsModal.open(area)
  }

  private updateArea(updated: AreaMarker): void {
    const idx = this.areas.findIndex(a => a.id === updated.id)
    if (idx >= 0) {
      this.areas[idx] = updated
      this.render()
      this.callbacks.onAreaUpdate?.(updated)
    }
  }

  private deleteArea(id: string): void {
    this.areas = this.areas.filter(a => a.id !== id)
    this.render()
    this.callbacks.onAreaDelete?.(id)
  }

  updateAreas(areas: AreaMarker[]): void {
    this.areas = [...areas]
    this.render()
  }
}
