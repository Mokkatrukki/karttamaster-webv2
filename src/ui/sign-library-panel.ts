import {
  createLibrary,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  loadLibrary,
  validateTemplateId,
  type IdValidationReason,
  type SignLibrary,
  type SignTemplate,
} from '../logic/sign-library'
import { CURATED_ICONS, getIconById, renderIconSvg } from '../logic/icon-set'
import { signImageTag } from '../logic/sign-images'
import { compactLabel } from '../logic/sign-visual'
import { registerEscClose, createBackdrop } from './modal-helpers'

const DEFAULT_IDS = new Set(['right', 'left', 'upcoming-right', 'upcoming-left'])

const ID_ERROR_MSG: Record<IdValidationReason, string> = {
  empty: 'Anna tunnus.',
  format: 'Vain A-Z, a-z, 0-9, _ ja - sallittu.',
  duplicate: 'Tunnus on jo käytössä.',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function seedDefaults(library: SignLibrary): void {
  if (library.size > 0) return
  createTemplate(library, { label: 'Vasemmalle', color: '#2563eb', description: 'Käänny vasemmalle', favorite: true }, 'left')
  createTemplate(library, { label: 'Oikealle', color: '#16a34a', description: 'Käänny oikealle', favorite: true }, 'right')
  createTemplate(library, { label: 'Tuleva vasemmalle', color: '#7c3aed', description: '', favorite: true }, 'upcoming-left')
  createTemplate(library, { label: 'Tuleva oikealle', color: '#b45309', description: '', favorite: true }, 'upcoming-right')
  // T161-jatko: muutama palvelukyltti kuvana — id == webp-nimi (src/assets/signs/<id>.webp),
  // signVisual-precedence näyttää kuvan automaattisesti (imageId ?? id). Kuratoinnin eka erä.
  createTemplate(library, { label: 'WC', color: '#1d4ed8', description: '', favorite: false }, 'wc')
  createTemplate(library, { label: 'Pesutilat', color: '#1d4ed8', description: '', favorite: false }, 'pesutilat')
  createTemplate(library, { label: 'Uimaranta', color: '#1d4ed8', description: '', favorite: false }, 'uimaranta')
  createTemplate(library, { label: 'Pysäköinti', color: '#1d4ed8', description: '', favorite: false }, 'p')
  createTemplate(library, { label: 'Park & Ride', color: '#1d4ed8', description: '', favorite: false }, 'park-and-ride-vas')
}

export function createSignLibrary(): SignLibrary {
  const loaded = loadLibrary()
  if (loaded && loaded.size > 0) return loaded
  const lib = createLibrary()
  seedDefaults(lib)
  return lib
}

export class SignLibraryPanel {
  private activeModal: HTMLElement | null = null
  private unregEsc: (() => void) | null = null
  private collapsed = false

  constructor(
    private readonly container: HTMLElement,
    private readonly library: SignLibrary,
    private readonly onChange: () => void,
    private readonly onPlace: (template: SignTemplate) => void,
  ) {
    this.render()
  }

  private render(): void {
    const templates = listTemplates(this.library)
    this.container.innerHTML = ''

    // Section header
    const sectionHeader = document.createElement('div')
    sectionHeader.className = 'left-panel-section-header'
    sectionHeader.setAttribute('role', 'button')
    sectionHeader.setAttribute('aria-expanded', String(!this.collapsed))
    sectionHeader.innerHTML = `
      <span class="section-header-toggle">${this.collapsed ? '▶' : '▼'}</span>
      <span class="section-header-name">Merkkikirjasto</span>
    `
    sectionHeader.addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.render()
    })
    this.container.appendChild(sectionHeader)

    if (this.collapsed) return

    // Item list
    const list = document.createElement('div')
    list.className = 'sign-lib-list'
    list.innerHTML = templates.map(t => this.buildRow(t)).join('')
    this.container.appendChild(list)

    // Section footer
    const footer = document.createElement('button')
    footer.className = 'sign-lib-add-btn sign-lib-section-footer'
    footer.style.cssText = 'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'
    footer.textContent = '+ Uusi merkki'
    this.container.appendChild(footer)

    this.bindEvents()
  }

  private buildRow(t: SignTemplate): string {
    const iconEntry = t.iconId ? getIconById(t.iconId) : null
    // Safe: iconEntry.svgContent is from CURATED_ICONS (not user input)
    const swatchInner = iconEntry
      ? renderIconSvg(t.iconId!, 14)
      : escapeHtml(compactLabel(t.label))

    // T136/V83: kaikki mallit (myös custom) ovat suoraan sijoitettavissa kartalle — ei suosikkivaatimusta
    const placeBtn = `<button class="sign-type-btn sign-lib-place-btn" data-id="${escapeHtml(t.id)}" aria-label="Aseta ${escapeHtml(t.label)} kartalle" style="flex:1;min-height:44px;display:flex;align-items:center;gap:8px;padding:6px 8px;background:none;border:none;color:var(--text-body);font-size:13px;cursor:pointer;text-align:left;border-radius:var(--radius-sm)">
           <span class="sign-swatch" style="background:${escapeHtml(t.color)};color:#fff;border-radius:var(--radius-sm);min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;position:relative;overflow:hidden">${swatchInner}${signImageTag(t.imageId ?? t.id, 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;border-radius:inherit')}</span>
           ${escapeHtml(t.label)}
         </button>`

    return `<div class="sign-lib-row" style="display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--border-card);padding:0">
      ${placeBtn}
      <button class="sign-lib-dots-btn" data-id="${t.id}" aria-label="Muokkaa mallia" style="min-width:44px;min-height:44px;background:none;border:none;border-radius:var(--radius-sm);color:var(--text-muted);font-size:14px;cursor:pointer;letter-spacing:0.05em">···</button>
    </div>`
  }

  private bindEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-dots-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        const t = this.library.get(id)
        if (t) this.openModal(t)
      })
    })

    // T136/V83: klikkaus sijoittaa mallin kartalle (arm + seuraava karttaklikki) — ei suosikkivaatimusta
    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        const t = this.library.get(id)
        if (t) this.onPlace(t)
      })
    })

    const addBtn = this.container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')
    addBtn?.addEventListener('click', () => this.openModal(null))
  }

  private openModal(template: SignTemplate | null): void {
    this.closeModal()

    let selectedIconId: string | null = template?.iconId ?? null
    const isDefault = template ? DEFAULT_IDS.has(template.id) : false

    const backdrop = createBackdrop('sign-lib-modal-backdrop', () => this.closeModal())
    backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px'

    const modal = document.createElement('div')
    modal.className = 'sign-lib-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', template ? 'Muokkaa mallia' : 'Uusi malli')
    modal.style.cssText = 'background:var(--surface-card);border-radius:var(--radius-lg);box-shadow:0 16px 48px rgba(0,0,0,0.5);width:min(480px,92vw);max-height:80vh;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px'
    modal.addEventListener('click', e => e.stopPropagation())

    // Header
    const header = document.createElement('div')
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
    const titleEl = document.createElement('span')
    titleEl.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    titleEl.textContent = template ? 'Muokkaa mallia' : 'Uusi malli'
    const closeBtn = document.createElement('button')
    closeBtn.className = 'sign-lib-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = 'min-width:44px;min-height:44px;background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;border-radius:var(--radius-sm)'
    closeBtn.addEventListener('click', () => this.closeModal())
    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    modal.appendChild(header)

    // V97: id-kenttä — vain luonnissa (id on muuttumaton avain, editissä lukittu)
    let idInput: HTMLInputElement | null = null
    let idError: HTMLElement | null = null
    if (!template) {
      const idSectionLabel = document.createElement('div')
      idSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
      idSectionLabel.textContent = 'Tunnus (uniikki, esim. N-OIK)'
      modal.appendChild(idSectionLabel)

      idInput = document.createElement('input')
      idInput.className = 'sign-lib-id-input'
      idInput.type = 'text'
      idInput.placeholder = 'A-Z, 0-9, _ ja -'
      idInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
      modal.appendChild(idInput)

      idError = document.createElement('div')
      idError.className = 'sign-lib-id-error'
      idError.style.cssText = 'font-size:12px;color:var(--danger-text);min-height:0;display:none'
      idError.setAttribute('role', 'alert')
      modal.appendChild(idError)
    }

    // Icon section label
    const iconSectionLabel = document.createElement('div')
    iconSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    iconSectionLabel.textContent = 'Ikoni (valinnainen)'
    modal.appendChild(iconSectionLabel)

    // Icon grid
    const iconGrid = document.createElement('div')
    iconGrid.className = 'sign-lib-icon-grid'
    iconGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px'

    const makeIconBtnStyle = (selected: boolean) =>
      `min-height:44px;background:${selected ? 'var(--accent)' : 'var(--field-tint)'};color:${selected ? 'white' : 'var(--text-muted)'};border:1.5px solid ${selected ? 'var(--accent)' : 'var(--border-default)'};border-radius:var(--radius-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0`

    // "No icon" option
    const noIconBtn = document.createElement('button')
    noIconBtn.className = 'sign-lib-icon-btn'
    noIconBtn.dataset.iconId = ''
    noIconBtn.title = 'Ei ikonia'
    noIconBtn.style.cssText = makeIconBtnStyle(selectedIconId === null) + ';font-size:14px'
    noIconBtn.textContent = '—'
    iconGrid.appendChild(noIconBtn)

    for (const icon of CURATED_ICONS) {
      const btn = document.createElement('button')
      btn.className = 'sign-lib-icon-btn'
      btn.dataset.iconId = icon.id
      btn.title = icon.label
      btn.style.cssText = makeIconBtnStyle(selectedIconId === icon.id)
      btn.innerHTML = renderIconSvg(icon.id, 20)  // safe: content from CURATED_ICONS only
      iconGrid.appendChild(btn)
    }

    const updateIconGrid = () => {
      iconGrid.querySelectorAll<HTMLButtonElement>('.sign-lib-icon-btn').forEach(b => {
        const isSel = (b.dataset.iconId === '') ? (selectedIconId === null) : (b.dataset.iconId === selectedIconId)
        b.style.background = isSel ? 'var(--accent)' : 'var(--field-tint)'
        b.style.color = isSel ? 'white' : 'var(--text-muted)'
        b.style.borderColor = isSel ? 'var(--accent)' : 'var(--border-default)'
      })
    }

    iconGrid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.sign-lib-icon-btn')
      if (!btn) return
      selectedIconId = btn.dataset.iconId || null
      updateIconGrid()
    })

    modal.appendChild(iconGrid)

    // Label
    const labelSectionLabel = document.createElement('div')
    labelSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    labelSectionLabel.textContent = 'Nimi'
    modal.appendChild(labelSectionLabel)

    const labelInput = document.createElement('input')
    labelInput.className = 'sign-lib-label-input'
    labelInput.type = 'text'
    labelInput.placeholder = 'Esim. Huoltopiste 25km'
    labelInput.value = template?.label ?? ''
    labelInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
    modal.appendChild(labelInput)

    // V99/T160: ei erillistä lyhenne-kenttää — kartta-teksti johdetaan labelista (compactLabel).
    // Color-rivi (vain custom-malleille; oletusmalleilla väri lukittu).
    let colorInput: HTMLInputElement | null = null
    if (!isDefault) {
      const colorRow = document.createElement('div')
      colorRow.style.cssText = 'display:flex;gap:6px'
      colorInput = document.createElement('input')
      colorInput.type = 'color'
      colorInput.className = 'sign-lib-color-input'
      colorInput.value = template?.color ?? '#f59e0b'
      colorInput.style.cssText = 'width:44px;height:44px;border:1px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;background:none;padding:2px;flex-shrink:0'
      colorRow.appendChild(colorInput)
      modal.appendChild(colorRow)
    }

    // Description
    const descInput = document.createElement('input')
    descInput.className = 'sign-lib-desc-input'
    descInput.type = 'text'
    descInput.placeholder = 'Kuvaus (valinnainen)'
    descInput.value = template?.description ?? ''
    descInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
    modal.appendChild(descInput)

    // Favorite toggle (i)
    const favLabel = document.createElement('label')
    favLabel.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font-size:13px;color:var(--text-body)'
    const favCheckbox = document.createElement('input')
    favCheckbox.type = 'checkbox'
    favCheckbox.className = 'sign-lib-fav-checkbox'
    favCheckbox.checked = template?.favorite ?? true
    favCheckbox.style.cssText = 'width:18px;height:18px;cursor:pointer'
    favLabel.appendChild(favCheckbox)
    favLabel.appendChild(document.createTextNode('Näytä suosikit-pickissä'))
    modal.appendChild(favLabel)

    // Save / Cancel
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'sign-lib-save-btn'
    saveBtn.textContent = 'Tallenna'
    saveBtn.style.cssText = 'flex:1;padding:8px;min-height:44px;background:var(--confirm);color:var(--confirm-text);border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:600;cursor:pointer'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'sign-lib-cancel-btn'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.style.cssText = 'padding:8px 16px;min-height:44px;background:var(--field-tint);color:var(--text-muted);border:1px solid var(--border-default);border-radius:var(--radius-sm);font-size:13px;cursor:pointer'

    cancelBtn.addEventListener('click', () => this.closeModal())

    saveBtn.addEventListener('click', () => {
      const label = labelInput.value.trim()
      if (!label) return

      const description = descInput.value.trim()
      const iconId = selectedIconId ?? undefined
      const favorite = favCheckbox.checked

      if (!template) {
        const id = idInput!.value.trim()
        const v = validateTemplateId(this.library, id)
        if (!v.valid) {
          if (idError) {
            idError.textContent = ID_ERROR_MSG[v.reason]
            idError.style.display = 'block'
          }
          idInput!.focus()
          return
        }
        const color = colorInput?.value ?? '#f59e0b'
        createTemplate(this.library, { label, color, description, favorite, iconId }, id)
      } else {
        const patch: Partial<Omit<SignTemplate, 'id'>> = { label, description, iconId, favorite }
        if (colorInput) patch.color = colorInput.value
        updateTemplate(this.library, template.id, patch)
      }

      this.closeModal()
      this.render()
      this.onChange()
    })

    btnRow.appendChild(saveBtn)
    btnRow.appendChild(cancelBtn)
    modal.appendChild(btnRow)

    // Destructive delete button (ii) — only for non-defaults
    if (template && !isDefault) {
      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'modal-btn-destructive'
      deleteBtn.textContent = 'Poista malli'
      deleteBtn.style.cssText = 'width:100%;padding:8px;min-height:44px;background:var(--danger-soft);color:var(--danger-text);border:none;border-radius:var(--radius-sm);font-size:13px;cursor:pointer;margin-top:4px'
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Poistetaanko malli "${template.label}"? Toimintoa ei voi peruuttaa.`)) return
        deleteTemplate(this.library, template.id)
        this.closeModal()
        this.render()
        this.onChange()
      })
      modal.appendChild(deleteBtn)
    }

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.activeModal = backdrop
    this.unregEsc = registerEscClose(() => this.closeModal())
  }

  private closeModal(): void {
    if (this.activeModal) {
      this.activeModal.remove()
      this.activeModal = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }
}
