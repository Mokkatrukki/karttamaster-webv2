import type { MarkerManager } from '../map/markers'
import type { SignLibrary } from '../logic/sign-library'
import type { SignMarker, MarkerStatus } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import { listTemplates } from '../logic/sign-library'
import { validActions, canTransition } from '../logic/marker-status'

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const ACTION_LABELS: Record<string, string> = {
  aseta: 'Aseta',
  ohita: 'Ei tarpeen',
  tarkista: 'Tarkista',
  kerää: 'Kerätty',
  peru: 'Peru',
}

export class MarkerDetailModal {
  private backdrop: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private currentId: string | null = null
  private escHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(
    private manager: MarkerManager,
    private getLibrary: () => SignLibrary | null,
    private getRole: () => string,
    private getTalkoolainenCode: () => string | null,
    private onArmRequest: (id: string) => void,
    private onUpdate: () => void,
  ) {}

  open(markerId: string): void {
    this.close()
    const marker = this.manager.getAll().find(m => m.id === markerId)
    if (!marker) return

    this.currentId = markerId
    this.backdrop = document.createElement('div')
    this.backdrop.className = 'marker-detail-backdrop'
    this.backdrop.addEventListener('click', () => this.close())

    this.modal = document.createElement('div')
    this.modal.className = 'marker-detail-modal'
    this.modal.setAttribute('role', 'dialog')
    this.modal.setAttribute('aria-modal', 'true')
    this.modal.addEventListener('click', e => e.stopPropagation())

    this.modal.appendChild(this.buildContent(marker))
    document.body.appendChild(this.backdrop)
    document.body.appendChild(this.modal)

    this.escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close() }
    document.addEventListener('keydown', this.escHandler)

    this.modal.querySelector<HTMLElement>('.marker-detail-note')?.focus()
  }

  close(): void {
    this.backdrop?.remove()
    this.modal?.remove()
    this.backdrop = null
    this.modal = null
    this.currentId = null
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler)
      this.escHandler = null
    }
  }

  // Re-render if currently showing the given marker (called after external update)
  refresh(markerId: string): void {
    if (this.currentId === markerId) this.open(markerId)
  }

  private buildContent(marker: SignMarker): DocumentFragment {
    const role = this.getRole()
    const isJarjestaja = role === 'järjestäjä'
    const talkoolainenCode = this.getTalkoolainenCode()
    const library = this.getLibrary()

    const km = (marker.distanceFromStart / 1000).toFixed(2)
    const typeInfo = SIGN_TYPES.find(s => s.type === marker.type)
    const templateLabel = library?.get(marker.type)?.label
    const typeLabel = templateLabel ?? typeInfo?.label ?? marker.type

    const frag = document.createDocumentFragment()

    // Header
    const header = document.createElement('div')
    header.className = 'marker-detail-header'

    const title = document.createElement('span')
    title.className = 'marker-detail-title'
    title.textContent = `${typeLabel} · ${km} km`

    const statusBadge = document.createElement('span')
    statusBadge.className = `marker-status marker-status--${marker.status}`
    statusBadge.textContent = STATUS_LABELS[marker.status]

    const closeBtn = document.createElement('button')
    closeBtn.className = 'marker-detail-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.close())

    header.appendChild(title)
    header.appendChild(statusBadge)
    header.appendChild(closeBtn)
    frag.appendChild(header)

    // Body
    const body = document.createElement('div')
    body.className = 'marker-detail-body'

    // locationNote textarea
    const noteLabel = document.createElement('label')
    noteLabel.className = 'marker-detail-label'
    noteLabel.textContent = 'Kommentti'

    const noteInput = document.createElement('textarea')
    noteInput.className = 'marker-detail-note'
    noteInput.placeholder = 'Lisää kommentti... (esim: kiinnitä puuhun)'
    noteInput.rows = 3
    // V44: use .value, not innerHTML
    noteInput.value = marker.locationNote ?? ''
    noteInput.addEventListener('blur', () => {
      this.manager.updateNote(marker.id, noteInput.value)
      this.onUpdate()
    })

    body.appendChild(noteLabel)
    body.appendChild(noteInput)

    // T103 placeholder
    const descPlaceholder = document.createElement('p')
    descPlaceholder.className = 'marker-detail-placeholder'
    descPlaceholder.textContent = 'Kuvaus tulossa (T103)'
    body.appendChild(descPlaceholder)

    if (isJarjestaja) {
      body.appendChild(this.buildJarjestajaSection(marker, library))
    } else if (talkoolainenCode) {
      body.appendChild(this.buildTalkoolainenSection(marker))
    }

    frag.appendChild(body)
    return frag
  }

  private buildJarjestajaSection(marker: SignMarker, library: SignLibrary | null): HTMLElement {
    const section = document.createElement('div')
    section.className = 'marker-detail-actions'

    // Type select
    const typeLabel = document.createElement('label')
    typeLabel.className = 'marker-detail-label'
    typeLabel.textContent = 'Tyyppi'

    const typeSelect = document.createElement('select')
    typeSelect.className = 'marker-detail-type-select'
    typeSelect.setAttribute('aria-label', 'Merkin tyyppi')

    SIGN_TYPES.forEach(t => {
      const opt = document.createElement('option')
      opt.value = t.type
      // V44: textContent not innerHTML
      opt.textContent = t.label
      if (t.type === marker.type) opt.selected = true
      typeSelect.appendChild(opt)
    })

    if (library) {
      listTemplates(library).forEach(t => {
        const opt = document.createElement('option')
        opt.value = t.id
        opt.textContent = t.label
        if (t.id === marker.type) opt.selected = true
        typeSelect.appendChild(opt)
      })
    }

    typeSelect.addEventListener('change', () => {
      const newType = typeSelect.value
      const template = library?.get(newType)
      this.manager.updateType(marker.id, newType, template?.color, template?.shortLabel)
      this.onUpdate()
    })

    section.appendChild(typeLabel)
    section.appendChild(typeSelect)

    const btnRow = document.createElement('div')
    btnRow.className = 'marker-detail-btn-row'

    // Rotate button — arms marker, closes modal
    const rotateBtn = document.createElement('button')
    rotateBtn.className = 'marker-detail-rotate-btn'
    rotateBtn.textContent = '↻ Käännä'
    rotateBtn.addEventListener('click', () => {
      this.onArmRequest(marker.id)
      this.close()
    })
    btnRow.appendChild(rotateBtn)

    // Delete button — V58: requires confirm
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'marker-detail-delete-btn'
    deleteBtn.textContent = 'Poista'
    deleteBtn.addEventListener('click', () => {
      if (window.confirm('Poistetaanko merkki?')) {
        this.close()
        this.manager.remove(marker.id)
        this.onUpdate()
      }
    })
    btnRow.appendChild(deleteBtn)

    section.appendChild(btnRow)
    return section
  }

  private buildTalkoolainenSection(marker: SignMarker): HTMLElement {
    const section = document.createElement('div')
    section.className = 'marker-detail-actions'

    const actions = validActions(marker.status)
    actions.forEach(action => {
      if (!canTransition(marker.status, action)) return
      const btn = document.createElement('button')
      btn.className = action === 'peru' ? 'marker-detail-status-btn marker-detail-status-btn--secondary' : 'marker-detail-status-btn'
      btn.textContent = ACTION_LABELS[action] ?? action
      btn.addEventListener('click', () => {
        this.manager.updateStatus(marker.id, action)
        this.onUpdate()
        this.close()
      })
      section.appendChild(btn)
    })

    return section
  }
}
