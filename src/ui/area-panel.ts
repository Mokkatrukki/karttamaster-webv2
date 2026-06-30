import { createAreaMarker, addFeature, removeFeature, setAreaStatus } from '../logic/area-types'
import type { AreaMarker, AreaFeature, AreaStatus } from '../logic/area-types'

const FEATURE_COLORS = [
  { label: 'Vihreä', value: '#4ade80' },
  { label: 'Sininen', value: '#93c5fd' },
  { label: 'Oranssi', value: '#fbbf24' },
  { label: 'Punainen', value: '#f87171' },
  { label: 'Violetti', value: '#c084fc' },
  { label: 'Keltainen', value: '#6ee7b7' },
]

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

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
  private activeModal: HTMLElement | null = null
  private escHandler: ((e: KeyboardEvent) => void) | null = null

  private readonly listEl: HTMLUListElement
  private readonly sectionEl: HTMLElement

  constructor(
    container: HTMLElement,
    initialAreas: AreaMarker[] = [],
    private readonly callbacks: AreaPanelCallbacks = {},
  ) {
    this.areas = [...initialAreas]
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
    toggleIcon.style.cssText = 'font-size:11px;color:var(--text-muted);flex-shrink:0;margin-right:6px'

    const titleSpan = document.createElement('span')
    titleSpan.style.cssText = 'font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);flex:1'
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
    footer.style.cssText = 'width:100%;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);color:var(--text-muted);font-size:12px;cursor:pointer'
    footer.addEventListener('click', () => this.startAddFlow())

    section.append(header, list, footer)
    return { section, list }
  }

  private toggleCollapse(): void {
    this.collapsed = !this.collapsed
    const icon = this.sectionEl.querySelector('.section-toggle-icon') as HTMLElement
    const list = this.listEl
    const footer = this.sectionEl.querySelector('.btn-area-add') as HTMLElement
    icon.textContent = this.collapsed ? '▶' : '▼'
    list.hidden = this.collapsed
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

      // Main row
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;min-height:44px;border-bottom:1px solid var(--border-card)'

      const expandBtn = document.createElement('button')
      expandBtn.textContent = isExpanded ? '▼' : '▶'
      expandBtn.setAttribute('aria-label', isExpanded ? 'Sulje komponentit' : 'Näytä komponentit')
      expandBtn.style.cssText = 'min-width:32px;min-height:44px;background:transparent;border:none;color:var(--text-muted);font-size:10px;cursor:pointer;flex-shrink:0'
      expandBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleAreaExpand(area.id) })

      const label = document.createElement('button')
      label.style.cssText = 'flex:1;min-height:44px;background:transparent;border:none;text-align:left;padding:0 4px;font-size:12px;color:var(--text-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer'
      label.textContent = area.name || '(nimetön)'
      label.addEventListener('click', () => this.toggleAreaExpand(area.id))

      const statusBadge = document.createElement('span')
      statusBadge.style.cssText = 'font-size:10px;padding:2px 4px;border-radius:4px;margin-right:4px;flex-shrink:0'
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
      dotsBtn.style.cssText = 'min-width:44px;min-height:44px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;flex-shrink:0'
      dotsBtn.addEventListener('click', (e) => { e.stopPropagation(); this.openDetailsModal(area) })

      row.append(expandBtn, label, statusBadge, dotsBtn)

      // Feature sub-list (visible when expanded)
      const subList = document.createElement('ul')
      subList.className = 'area-feature-sublist'
      subList.style.cssText = 'list-style:none;margin:0;padding:0;background:var(--surface-raised, rgba(255,255,255,0.03))'
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
      empty.style.cssText = 'padding:8px 8px 8px 28px;font-size:11px;color:var(--text-meta);border-bottom:1px solid var(--border-card)'
      empty.textContent = 'Ei komponentteja'
      subList.appendChild(empty)
    } else {
      for (const feat of area.features) {
        const li = document.createElement('li')
        li.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:40px;padding:0 8px 0 28px;border-bottom:1px solid var(--border-card)'

        const swatch = document.createElement('span')
        swatch.style.cssText = `width:14px;height:14px;border-radius:3px;background:${feat.color};flex-shrink:0`

        const name = document.createElement('span')
        name.style.cssText = 'flex:1;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
        name.textContent = feat.name || '(nimetön)'

        li.append(swatch, name)
        subList.appendChild(li)
      }
    }

    // Add feature button in sidebar
    const addLi = document.createElement('li')
    const addBtn = document.createElement('button')
    addBtn.className = 'btn-area-add-feature-sidebar'
    addBtn.textContent = '+ Lisää komponentti'
    addBtn.style.cssText = 'width:100%;min-height:44px;background:transparent;border:none;border-top:1px dashed var(--border-card);color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 8px 0 28px'
    addBtn.addEventListener('click', () => this.startAddFeatureFlow(area))
    addLi.appendChild(addBtn)
    subList.appendChild(addLi)
  }

  private startAddFeatureFlow(area: AreaMarker): void {
    if (this.callbacks.onEnterDrawMode) {
      this.callbacks.onEnterDrawMode((rect) => {
        const feat: AreaFeature = {
          id: generateId(),
          name: undefined,
          centerLat: rect.centerLat,
          centerLng: rect.centerLng,
          widthM: rect.widthM,
          heightM: rect.heightM,
          rotation: 0,
          color: FEATURE_COLORS[0].value,
        }
        const updatedArea = addFeature(area, feat)
        this.updateArea(updatedArea)
        this.expandedAreas.add(area.id)
      })
    }
  }

  private startAddFlow(): void {
    if (this.callbacks.onEnterDrawMode) {
      this.callbacks.onEnterDrawMode((rect) => {
        const name = window.prompt('Alueen nimi:')
        if (!name?.trim()) return
        const area = createAreaMarker({
          id: generateId(),
          name: name.trim(),
          centerLat: rect.centerLat,
          centerLng: rect.centerLng,
          widthM: rect.widthM,
          heightM: rect.heightM,
          rotation: 0,
          markdownDescription: '',
          hashCode: generateId() + generateId(),
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
          id: generateId(),
          name: name.trim(),
          centerLat: lat,
          centerLng: lng,
          widthM: 60,
          heightM: 40,
          rotation: 0,
          markdownDescription: '',
          hashCode: generateId() + generateId(),
        })
        this.areas.push(area)
        this.render()
        this.callbacks.onAreaAdd?.(area)
      })
    }
  }

  openDetailsModal(area: AreaMarker): void {
    this.closeModal()

    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop area-modal-backdrop'
    backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:2000'

    const modal = document.createElement('div')
    modal.className = 'area-details-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2001;background:var(--surface-card);border:1px solid var(--border-default);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.5);width:min(480px,92vw);max-height:80vh;overflow-y:auto;display:flex;flex-direction:column'

    modal.innerHTML = this.buildModalHTML(area)

    const close = () => {
      backdrop.remove()
      modal.remove()
      this.activeModal = null
      if (this.escHandler) {
        document.removeEventListener('keydown', this.escHandler)
        this.escHandler = null
      }
    }

    backdrop.addEventListener('click', close)
    modal.querySelector('.btn-area-modal-close')?.addEventListener('click', close)

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', this.escHandler)

    // Name save
    const nameInput = modal.querySelector('.area-name-input') as HTMLInputElement
    const saveNameBtn = modal.querySelector('.btn-area-name-save') as HTMLButtonElement
    if (nameInput && saveNameBtn) {
      saveNameBtn.addEventListener('click', () => {
        const updatedArea = { ...area, name: nameInput.value.trim() || area.name }
        this.updateArea(updatedArea)
        area = updatedArea
      })
    }

    // Size + rotation save
    const widthInput = modal.querySelector('.area-width-input') as HTMLInputElement
    const heightInput = modal.querySelector('.area-height-input') as HTMLInputElement
    const rotationInput = modal.querySelector('.area-rotation-input') as HTMLInputElement
    const saveSizeBtn = modal.querySelector('.btn-area-size-save') as HTMLButtonElement
    if (widthInput && heightInput && rotationInput && saveSizeBtn) {
      saveSizeBtn.addEventListener('click', () => {
        const updatedArea = {
          ...area,
          widthM: Math.max(10, Number(widthInput.value) || area.widthM),
          heightM: Math.max(10, Number(heightInput.value) || area.heightM),
          rotation: ((Number(rotationInput.value) || 0) % 360 + 360) % 360,
        }
        this.updateArea(updatedArea)
        area = updatedArea
      })
    }

    // Description save
    const descTextarea = modal.querySelector('.area-desc-textarea') as HTMLTextAreaElement
    const saveDescBtn = modal.querySelector('.btn-area-desc-save') as HTMLButtonElement
    if (descTextarea && saveDescBtn) {
      saveDescBtn.addEventListener('click', () => {
        const updatedArea = { ...area, markdownDescription: descTextarea.value }
        this.updateArea(updatedArea)
        area = updatedArea
      })
    }

    // Set valmis
    const setValmisBtn = modal.querySelector('.btn-area-set-valmis') as HTMLButtonElement
    if (setValmisBtn) {
      setValmisBtn.addEventListener('click', () => {
        const newStatus: AreaStatus = area.status === 'valmis' ? 'suunniteltu' : 'valmis'
        if (newStatus === 'valmis' && !window.confirm(`Merkitäänkö "${area.name}" valmiiksi?`)) return
        const updatedArea = setAreaStatus(area, newStatus)
        this.updateArea(updatedArea)
        area = updatedArea
        setValmisBtn.textContent = area.status === 'valmis' ? '↩ Peru valmis' : '✓ Merkitse valmiiksi'
        this.render()
      })
    }

    this.bindFeatureListEvents(modal, area, (a) => { area = a })

    document.body.append(backdrop, modal)
    this.activeModal = modal
  }

  private buildModalHTML(area: AreaMarker): string {
    const isValmis = area.status === 'valmis'
    return `
      <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--border-default)">
        <h3 style="flex:1;margin:0;font-size:14px;color:var(--text-body)">Alue</h3>
        <button class="btn-area-modal-close" aria-label="Sulje" style="min-height:44px;min-width:44px;background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Nimi</label>
          <div style="display:flex;gap:8px">
            <input class="area-name-input" type="text" value="${area.name.replace(/"/g, '&quot;')}" style="flex:1;padding:8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px" />
            <button class="btn-area-name-save" style="padding:8px 12px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;white-space:nowrap">Tallenna</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:6px">Koko ja kierto</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <label style="font-size:11px;color:var(--text-muted)">Lev (m)</label>
            <input class="area-width-input" type="number" value="${area.widthM}" min="10" max="5000" step="10" style="width:72px;padding:6px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px" />
            <label style="font-size:11px;color:var(--text-muted)">Kork (m)</label>
            <input class="area-height-input" type="number" value="${area.heightM}" min="10" max="5000" step="10" style="width:72px;padding:6px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px" />
            <label style="font-size:11px;color:var(--text-muted)">Kierto (°)</label>
            <input class="area-rotation-input" type="number" value="${area.rotation}" min="0" max="359" step="5" style="width:64px;padding:6px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px" />
            <button class="btn-area-size-save" style="padding:6px 12px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;white-space:nowrap">Tallenna</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Ohjeteksti (Markdown)</label>
          <textarea class="area-desc-textarea" rows="4" style="width:100%;box-sizing:border-box;padding:8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px;resize:vertical">${area.markdownDescription}</textarea>
          <button class="btn-area-desc-save" style="margin-top:4px;padding:6px 12px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer">Tallenna kuvaus</button>
        </div>
        ${area.features.length > 0 ? `
        <div>
          <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:8px">Komponentit (muokkaa / poista)</label>
          <ul class="area-feature-list" style="list-style:none;margin:0;padding:0">
            ${this.buildFeatureListHTML(area)}
          </ul>
        </div>
        ` : ''}
        <button class="btn-area-set-valmis" style="width:100%;min-height:44px;background:var(--confirm);border:none;border-radius:8px;color:var(--confirm-text);font-size:13px;font-weight:600;cursor:pointer">
          ${isValmis ? '↩ Peru valmis' : '✓ Merkitse valmiiksi'}
        </button>
      </div>
    `
  }

  private buildFeatureListHTML(area: AreaMarker): string {
    if (area.features.length === 0) return ''
    return area.features.map((f) => `
      <li class="area-feature-item" data-feature-id="${f.id}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-card)">
        <span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${f.color};flex-shrink:0"></span>
        <input class="feat-name-input" type="text" value="${f.name ?? ''}" placeholder="Nimi (valinnainen)" style="flex:1;padding:4px 8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;color:var(--text-body);font-size:12px" />
        <select class="feat-color-select" style="padding:4px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;color:var(--text-body);font-size:11px">
          ${FEATURE_COLORS.map(c => `<option value="${c.value}" ${c.value === f.color ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
        <button class="btn-feat-delete" aria-label="Poista" style="min-width:32px;min-height:32px;background:var(--danger-soft);border:none;border-radius:4px;color:var(--danger-text);cursor:pointer;font-size:14px">✕</button>
      </li>
    `).join('')
  }

  private bindFeatureListEvents(
    modal: HTMLElement,
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
  ): void {
    const featureList = modal.querySelector('.area-feature-list') as HTMLElement
    if (!featureList) return

    featureList.querySelectorAll('.area-feature-item').forEach(li => {
      const featureId = (li as HTMLElement).dataset.featureId!
      const nameInput = li.querySelector('.feat-name-input') as HTMLInputElement
      const colorSelect = li.querySelector('.feat-color-select') as HTMLSelectElement
      const deleteBtn = li.querySelector('.btn-feat-delete') as HTMLButtonElement

      const saveFeature = () => {
        const feat = area.features.find(f => f.id === featureId)
        if (!feat) return
        const updated = { ...feat, name: nameInput.value.trim() || undefined, color: colorSelect.value }
        const updatedArea = {
          ...area,
          features: area.features.map(f => f.id === featureId ? updated : f),
        }
        this.updateArea(updatedArea)
        onUpdate(updatedArea)
        area = updatedArea
      }

      nameInput?.addEventListener('blur', saveFeature)
      colorSelect?.addEventListener('change', saveFeature)

      deleteBtn?.addEventListener('click', () => {
        const updatedArea = removeFeature(area, featureId)
        this.updateArea(updatedArea)
        onUpdate(updatedArea)
        area = updatedArea
        featureList.innerHTML = this.buildFeatureListHTML(area)
        this.bindFeatureListEvents(modal, area, onUpdate)
      })
    })
  }

  private updateArea(updated: AreaMarker): void {
    const idx = this.areas.findIndex(a => a.id === updated.id)
    if (idx >= 0) {
      this.areas[idx] = updated
      this.render()
      this.callbacks.onAreaUpdate?.(updated)
    }
  }

  private closeModal(): void {
    this.activeModal?.remove()
    this.activeModal = null
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler)
      this.escHandler = null
    }
    const backdrop = document.querySelector('.area-modal-backdrop')
    backdrop?.remove()
  }

  updateAreas(areas: AreaMarker[]): void {
    this.areas = [...areas]
    this.render()
  }
}
