import {
  createLibrary,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  type SignLibrary,
  type SignTemplate,
} from '../logic/sign-library'

const DEFAULT_IDS = new Set(['right', 'left', 'upcoming-right', 'upcoming-left'])

function seedDefaults(library: SignLibrary): void {
  if (library.size > 0) return
  createTemplate(library, { label: 'Vasemmalle', shortLabel: 'V', color: '#2563eb', description: 'Käänny vasemmalle' }, 'left')
  createTemplate(library, { label: 'Oikealle', shortLabel: 'O', color: '#16a34a', description: 'Käänny oikealle' }, 'right')
  createTemplate(library, { label: 'Tuleva vasemmalle', shortLabel: 'TV', color: '#7c3aed', description: '' }, 'upcoming-left')
  createTemplate(library, { label: 'Tuleva oikealle', shortLabel: 'TO', color: '#b45309', description: '' }, 'upcoming-right')
}

export function createSignLibrary(): SignLibrary {
  const lib = createLibrary()
  seedDefaults(lib)
  return lib
}

export class SignLibraryPanel {
  private editingId: string | null | 'new' = null

  constructor(
    private readonly container: HTMLElement,
    private readonly library: SignLibrary,
    private readonly onChange: () => void,
  ) {
    this.render()
  }

  private render(): void {
    const templates = listTemplates(this.library)

    const rows = templates.map(t => this.buildRow(t)).join('')
    const addArea = this.editingId === 'new'
      ? this.buildForm(null)
      : `<button class="sign-lib-add-btn" style="margin:8px 0 0;padding:6px 12px;min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left">+ Uusi malli</button>`

    this.container.innerHTML = `
      <div class="sign-lib-list">${rows}</div>
      ${addArea}
    `
    this.bindEvents()
  }

  private buildRow(t: SignTemplate): string {
    const isDefault = DEFAULT_IDS.has(t.id)
    const isEditing = this.editingId === t.id

    if (isEditing) return this.buildForm(t)

    const placeBtn = isDefault
      ? `<button class="sign-type-btn sign-lib-place-btn" data-type="${t.id}" style="flex:1;min-height:44px;display:flex;align-items:center;gap:8px;padding:6px 8px;background:none;border:none;color:var(--text-body);font-size:13px;cursor:pointer;text-align:left;border-radius:var(--radius-sm)">
           <span class="sign-swatch" style="background:${t.color};color:#fff;border-radius:var(--radius-sm);min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900">${t.shortLabel}</span>
           ${t.label}
         </button>`
      : `<div class="sign-lib-custom-item" style="flex:1;display:flex;align-items:center;gap:8px;padding:6px 8px;min-height:44px">
           <span class="sign-swatch" style="background:${t.color};color:#fff;border-radius:var(--radius-sm);min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900">${t.shortLabel}</span>
           <span style="font-size:13px;color:var(--text-body)">${t.label}</span>
         </div>`

    const deleteBtn = isDefault ? '' :
      `<button class="sign-lib-delete-btn" data-id="${t.id}" aria-label="Poista malli" style="min-width:44px;min-height:44px;background:var(--danger-soft);border:none;border-radius:var(--radius-sm);color:var(--danger-text);font-size:14px;cursor:pointer">×</button>`

    return `<div class="sign-lib-row" style="display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--border-card);padding:0">
      ${placeBtn}
      <button class="sign-lib-edit-btn" data-id="${t.id}" aria-label="Muokkaa mallia" style="min-width:44px;min-height:44px;background:none;border:none;border-radius:var(--radius-sm);color:var(--text-muted);font-size:13px;cursor:pointer">✎</button>
      ${deleteBtn}
    </div>`
  }

  private buildForm(t: SignTemplate | null): string {
    const id = t?.id ?? ''
    const label = t?.label ?? ''
    const shortLabel = t?.shortLabel ?? ''
    const color = t?.color ?? '#f59e0b'
    const description = t?.description ?? ''
    const isDefault = t ? DEFAULT_IDS.has(t.id) : false
    const title = t ? 'Muokkaa mallia' : 'Uusi malli'

    return `<div class="sign-lib-form" data-id="${id}" style="padding:10px 8px;border-bottom:1px solid var(--border-card);background:var(--surface-raised);border-radius:var(--radius-md)">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${title}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <input class="sign-lib-label-input" placeholder="Nimi (esim. Huoltopiste 25km)" value="${label}"
               style="padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px">
        <div style="display:flex;gap:6px">
          <input class="sign-lib-short-input" placeholder="Lyhenne (1-3 merkkiä)" value="${shortLabel}" maxlength="3"
                 style="flex:1;padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px">
          ${isDefault ? '' : `<div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:var(--text-muted)">Väri</span>
            <input type="color" class="sign-lib-color-input" value="${color}"
                   style="width:44px;height:44px;border:1px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;background:none;padding:2px">
          </div>`}
        </div>
        <input class="sign-lib-desc-input" placeholder="Kuvaus (valinnainen)" value="${description}"
               style="padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px">
        <div style="display:flex;gap:6px;margin-top:2px">
          <button class="sign-lib-save-btn" style="flex:1;padding:8px;min-height:44px;background:var(--confirm);color:var(--confirm-text);border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:600;cursor:pointer">Tallenna</button>
          <button class="sign-lib-cancel-btn" style="padding:8px 16px;min-height:44px;background:var(--field-tint);color:var(--text-muted);border:1px solid var(--border-default);border-radius:var(--radius-sm);font-size:13px;cursor:pointer">Peruuta</button>
        </div>
      </div>
    </div>`
  }

  private bindEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editingId = btn.dataset.id ?? null
        this.render()
      })
    })

    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        deleteTemplate(this.library, id)
        this.editingId = null
        this.render()
        this.onChange()
      })
    })

    const addBtn = this.container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.editingId = 'new'
        this.render()
      })
    }

    const form = this.container.querySelector<HTMLElement>('.sign-lib-form')
    if (form) {
      const saveBtn = form.querySelector<HTMLButtonElement>('.sign-lib-save-btn')
      const cancelBtn = form.querySelector<HTMLButtonElement>('.sign-lib-cancel-btn')

      saveBtn?.addEventListener('click', () => this.saveForm(form))
      cancelBtn?.addEventListener('click', () => {
        this.editingId = null
        this.render()
      })
    }
  }

  private saveForm(form: HTMLElement): void {
    const id = (form as HTMLElement).dataset.id
    const label = (form.querySelector('.sign-lib-label-input') as HTMLInputElement).value.trim()
    const shortLabel = (form.querySelector('.sign-lib-short-input') as HTMLInputElement).value.trim()
    const colorEl = form.querySelector<HTMLInputElement>('.sign-lib-color-input')
    const color = colorEl ? colorEl.value : (id ? (this.library.get(id)?.color ?? '#f59e0b') : '#f59e0b')
    const description = (form.querySelector('.sign-lib-desc-input') as HTMLInputElement).value.trim()

    if (!label || !shortLabel) return

    if (!id) {
      createTemplate(this.library, { label, shortLabel, color, description })
    } else {
      const patch: Partial<Omit<SignTemplate, 'id'>> = { label, shortLabel, description }
      if (form.querySelector('.sign-lib-color-input')) patch.color = color
      updateTemplate(this.library, id, patch)
    }

    this.editingId = null
    this.render()
    this.onChange()
  }
}
