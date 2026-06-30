import { setAreaStatus, removeFeature } from '../logic/area-types'
import type { AreaMarker, AreaFeature, AreaStatus } from '../logic/area-types'
import { registerEscClose, createBackdrop } from './modal-helpers'

const FEATURE_COLORS = [
  { label: 'Vihreä', value: '#4ade80' },
  { label: 'Sininen', value: '#93c5fd' },
  { label: 'Oranssi', value: '#fbbf24' },
  { label: 'Punainen', value: '#f87171' },
  { label: 'Violetti', value: '#c084fc' },
  { label: 'Keltainen', value: '#6ee7b7' },
]

export interface AreaDetailsCallbacks {
  onAreaUpdate: (area: AreaMarker) => void
  onAreaDelete: (id: string) => void
}

export class AreaDetailsModal {
  private backdrop: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private unregEsc: (() => void) | null = null

  constructor(private readonly callbacks: AreaDetailsCallbacks) {}

  open(area: AreaMarker): void {
    this.close()

    const backdrop = createBackdrop('modal-backdrop area-modal-backdrop', () => this.close())
    backdrop.style.cssText =
      'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:2000'

    const modal = document.createElement('div')
    modal.className = 'area-details-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2001;background:var(--surface-card);border:1px solid var(--border-default);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.5);width:min(480px,92vw);max-height:80vh;overflow-y:auto;display:flex;flex-direction:column'

    let current = area
    const onUpdate = (updated: AreaMarker) => {
      current = updated
      this.callbacks.onAreaUpdate(updated)
    }

    modal.appendChild(this.buildHeader(() => this.close()))
    modal.appendChild(this.buildBody(area, onUpdate, () => current))
    modal.appendChild(this.buildFooter(area, () => current))

    document.body.append(backdrop, modal)
    this.backdrop = backdrop
    this.modal = modal
    this.unregEsc = registerEscClose(() => this.close())
  }

  close(): void {
    this.backdrop?.remove()
    this.modal?.remove()
    this.backdrop = null
    this.modal = null
    this.unregEsc?.()
    this.unregEsc = null
  }

  private buildHeader(onClose: () => void): HTMLElement {
    const header = document.createElement('div')
    header.style.cssText =
      'display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--border-default)'

    const title = document.createElement('h3')
    title.style.cssText = 'flex:1;margin:0;font-size:14px;color:var(--text-body)'
    title.textContent = 'Alue'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn-area-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.style.cssText =
      'min-height:44px;min-width:44px;background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', onClose)
    header.appendChild(closeBtn)

    return header
  }

  private buildBody(
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const body = document.createElement('div')
    body.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px;flex:1'

    body.appendChild(this.buildNameSection(area, onUpdate, getCurrent))
    body.appendChild(this.buildSizeSection(area, onUpdate, getCurrent))
    body.appendChild(this.buildDescSection(area, onUpdate, getCurrent))
    body.appendChild(this.buildFeatureSection(area, onUpdate, getCurrent))
    body.appendChild(this.buildValmisButton(area, onUpdate, getCurrent))

    return body
  }

  private buildNameSection(
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const section = document.createElement('div')

    const label = this.buildLabel('Nimi')
    section.appendChild(label)

    const nameInput = document.createElement('input')
    nameInput.className = 'area-name-input'
    nameInput.type = 'text'
    nameInput.value = area.name
    nameInput.style.cssText =
      'width:100%;box-sizing:border-box;padding:8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px'

    const save = () => {
      const val = nameInput.value.trim()
      if (val) onUpdate({ ...getCurrent(), name: val })
    }
    nameInput.addEventListener('blur', save)
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save() } })

    section.appendChild(nameInput)
    return section
  }

  private buildSizeSection(
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const section = document.createElement('div')
    section.appendChild(this.buildLabel('Koko ja kierto'))

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap'

    const inputStyle =
      'padding:6px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px'

    const addLabeledInput = (
      labelText: string,
      cls: string,
      value: number,
      min: number,
      max: number,
      step: number,
      width: string,
    ): HTMLInputElement => {
      const lbl = document.createElement('label')
      lbl.style.cssText = 'font-size:11px;color:var(--text-muted)'
      lbl.textContent = labelText
      row.appendChild(lbl)
      const inp = document.createElement('input')
      inp.className = cls
      inp.type = 'number'
      inp.value = String(value)
      inp.min = String(min)
      inp.max = String(max)
      inp.step = String(step)
      inp.style.cssText = `width:${width};${inputStyle}`
      row.appendChild(inp)
      return inp
    }

    const widthInput = addLabeledInput('Lev (m)', 'area-width-input', area.widthM, 10, 5000, 10, '72px')
    const heightInput = addLabeledInput('Kork (m)', 'area-height-input', area.heightM, 10, 5000, 10, '72px')
    const rotationInput = addLabeledInput('Kierto (°)', 'area-rotation-input', area.rotation, 0, 359, 5, '64px')

    const saveSize = () => {
      const cur = getCurrent()
      onUpdate({
        ...cur,
        widthM: Math.max(10, Number(widthInput.value) || cur.widthM),
        heightM: Math.max(10, Number(heightInput.value) || cur.heightM),
        rotation: ((Number(rotationInput.value) || 0) % 360 + 360) % 360,
      })
    }
    widthInput.addEventListener('blur', saveSize)
    heightInput.addEventListener('blur', saveSize)
    rotationInput.addEventListener('blur', saveSize)

    section.appendChild(row)
    return section
  }

  private buildDescSection(
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const section = document.createElement('div')
    section.appendChild(this.buildLabel('Ohjeteksti'))

    const textarea = document.createElement('textarea')
    textarea.className = 'area-desc-textarea'
    textarea.rows = 4
    textarea.placeholder = 'Ohjeteksti talkoolaisille — enterillä uusi rivi'
    textarea.style.cssText =
      'width:100%;box-sizing:border-box;padding:8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:6px;color:var(--text-body);font-size:13px;resize:vertical'
    textarea.value = area.markdownDescription

    textarea.addEventListener('blur', () => {
      onUpdate({ ...getCurrent(), markdownDescription: textarea.value })
    })

    section.appendChild(textarea)
    return section
  }

  private buildFeatureSection(
    area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const section = document.createElement('div')
    if (area.features.length === 0) return section

    section.appendChild(this.buildLabel('Komponentit (muokkaa / poista)'))

    const featureList = document.createElement('ul')
    featureList.className = 'area-feature-list'
    featureList.style.cssText = 'list-style:none;margin:0;padding:0'
    section.appendChild(featureList)

    const renderFeatures = (features: AreaFeature[]) => {
      featureList.innerHTML = ''
      for (const feat of features) {
        featureList.appendChild(this.buildFeatureItem(feat, getCurrent, onUpdate, renderFeatures))
      }
    }
    renderFeatures(area.features)

    return section
  }

  private buildFeatureItem(
    feat: AreaFeature,
    getCurrent: () => AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    renderFeatures: (features: AreaFeature[]) => void,
  ): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'area-feature-item'
    li.dataset.featureId = feat.id
    li.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-card)'

    const swatch = document.createElement('span')
    swatch.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:3px;background:${feat.color};flex-shrink:0`
    li.appendChild(swatch)

    const nameInput = document.createElement('input')
    nameInput.className = 'feat-name-input'
    nameInput.type = 'text'
    nameInput.value = feat.name ?? ''
    nameInput.placeholder = 'Nimi (valinnainen)'
    nameInput.style.cssText =
      'flex:1;padding:4px 8px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;color:var(--text-body);font-size:12px'
    li.appendChild(nameInput)

    const colorSelect = document.createElement('select')
    colorSelect.className = 'feat-color-select'
    colorSelect.style.cssText =
      'padding:4px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:4px;color:var(--text-body);font-size:11px'
    for (const c of FEATURE_COLORS) {
      const opt = document.createElement('option')
      opt.value = c.value
      opt.textContent = c.label
      if (c.value === feat.color) opt.selected = true
      colorSelect.appendChild(opt)
    }
    li.appendChild(colorSelect)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-feat-delete'
    deleteBtn.setAttribute('aria-label', 'Poista')
    deleteBtn.style.cssText =
      'min-width:32px;min-height:32px;background:var(--danger-soft);border:none;border-radius:4px;color:var(--danger-text);cursor:pointer;font-size:14px'
    deleteBtn.textContent = '✕'
    li.appendChild(deleteBtn)

    const saveFeature = () => {
      const cur = getCurrent()
      const updated = {
        ...cur,
        features: cur.features.map(f =>
          f.id === feat.id
            ? { ...f, name: nameInput.value.trim() || undefined, color: colorSelect.value }
            : f,
        ),
      }
      onUpdate(updated)
    }

    nameInput.addEventListener('blur', saveFeature)
    colorSelect.addEventListener('change', saveFeature)
    deleteBtn.addEventListener('click', () => {
      const updated = removeFeature(getCurrent(), feat.id)
      onUpdate(updated)
      renderFeatures(updated.features)
    })

    return li
  }

  private buildValmisButton(
    _area: AreaMarker,
    onUpdate: (a: AreaMarker) => void,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'btn-area-set-valmis'
    btn.style.cssText =
      'width:100%;min-height:44px;background:var(--confirm);border:none;border-radius:8px;color:var(--confirm-text);font-size:13px;font-weight:600;cursor:pointer'

    const refresh = () => {
      btn.textContent = getCurrent().status === 'valmis' ? '↩ Peru valmis' : '✓ Merkitse valmiiksi'
    }
    refresh()

    btn.addEventListener('click', () => {
      const cur = getCurrent()
      const newStatus: AreaStatus = cur.status === 'valmis' ? 'suunniteltu' : 'valmis'
      if (newStatus === 'valmis' && !window.confirm(`Merkitäänkö "${cur.name}" valmiiksi?`)) return
      const updated = setAreaStatus(cur, newStatus)
      onUpdate(updated)
      refresh()
    })

    return btn
  }

  private buildFooter(
    area: AreaMarker,
    getCurrent: () => AreaMarker,
  ): HTMLElement {
    const footer = document.createElement('div')
    footer.style.cssText =
      'padding:12px 16px;border-top:1px solid var(--border-default);display:flex;justify-content:flex-end'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-area-delete modal-btn-destructive'
    deleteBtn.textContent = 'Poista alue'
    deleteBtn.style.cssText =
      'padding:8px 16px;min-height:44px;background:var(--danger-soft);border:none;border-radius:8px;color:var(--danger-text);font-size:13px;cursor:pointer'
    deleteBtn.addEventListener('click', () => {
      const cur = getCurrent()
      if (!window.confirm(`Poistetaanko alue "${cur.name}"?`)) return
      this.callbacks.onAreaDelete(area.id)
      this.close()
    })

    footer.appendChild(deleteBtn)
    return footer
  }

  private buildLabel(text: string): HTMLElement {
    const label = document.createElement('label')
    label.style.cssText =
      'font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px'
    label.textContent = text
    return label
  }
}
