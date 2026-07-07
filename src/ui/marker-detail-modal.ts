import type { MarkerManager } from '../map/markers'
import type { SignLibrary } from '../logic/sign-library'
import type { SignMarker, MarkerStatus } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import { listTemplates } from '../logic/sign-library'
import { validActions, canTransition } from '../logic/marker-status'
import { registerEscClose, signPreviewHtml } from './modal-helpers'

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
  private unregEsc: (() => void) | null = null

  constructor(
    private manager: MarkerManager,
    private getLibrary: () => SignLibrary | null,
    private getRole: () => string,
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

    this.unregEsc = registerEscClose(() => this.close())

    this.modal.querySelector<HTMLElement>('.marker-detail-note')?.focus()
  }

  close(): void {
    this.backdrop?.remove()
    this.modal?.remove()
    this.backdrop = null
    this.modal = null
    this.currentId = null
    this.unregEsc?.()
    this.unregEsc = null
  }

  // Re-render if currently showing the given marker (called after external update)
  refresh(markerId: string): void {
    if (this.currentId === markerId) this.open(markerId)
  }

  private buildContent(marker: SignMarker): DocumentFragment {
    const role = this.getRole()
    const isJarjestaja = role === 'järjestäjä'
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

    // SignPreview (DESIGN.md §K): iso, hyvin sommiteltu esikatselu mistä merkistä on kyse.
    // V99-precedence kuva>ikoni>compactLabel, contain (ei crop). Näkyy molemmille rooleille.
    const template = library?.get(marker.type)
    const preview = document.createElement('div')
    preview.innerHTML = signPreviewHtml({
      id: marker.type,
      imageId: template?.imageId,
      label: typeLabel,
      color: marker.color ?? template?.color ?? '#94a3b8',
      iconId: template?.iconId,
      parts: marker.parts ?? template?.parts,
    })
    body.appendChild(preview)

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
    // auto-save on blur as belt-and-suspenders
    noteInput.addEventListener('blur', () => {
      this.manager.updateNote(marker.id, noteInput.value)
      this.onUpdate()
    })

    body.appendChild(noteLabel)
    body.appendChild(noteInput)

    // T103: description — järjestäjä muokkaa, talkoolainen readonly
    const descLabel = document.createElement('label')
    descLabel.className = 'marker-detail-label'
    descLabel.textContent = 'Kuvaus'
    body.appendChild(descLabel)

    if (isJarjestaja) {
      const descInput = document.createElement('textarea')
      descInput.className = 'marker-detail-description'
      descInput.placeholder = 'Lisäkuvaus merkille...'
      descInput.rows = 2
      descInput.value = marker.description ?? ''
      descInput.addEventListener('blur', () => {
        this.manager.updateDescription(marker.id, descInput.value)
        this.onUpdate()
      })
      body.appendChild(descInput)
    } else {
      const descText = document.createElement('p')
      descText.className = 'marker-detail-description-readonly'
      descText.textContent = marker.description || 'Ei kuvausta'
      body.appendChild(descText)
    }

    // T103: kuvat — thumbnail-galleria + järjestäjälle kameran/tiedoston lataus
    const imagesSection = document.createElement('div')
    imagesSection.className = 'marker-detail-images'

    const images = marker.images ?? []
    if (images.length > 0) {
      const gallery = document.createElement('div')
      gallery.className = 'marker-detail-image-gallery'
      images.forEach((url) => {
        const img = document.createElement('img')
        img.className = 'marker-detail-image-thumb'
        img.src = url
        img.loading = 'lazy'
        img.alt = 'Merkin kuva'
        img.addEventListener('error', () => {
          const placeholder = document.createElement('div')
          placeholder.className = 'marker-detail-image-placeholder'
          placeholder.textContent = '[kuva ei saatavilla]'
          img.replaceWith(placeholder)
        })
        gallery.appendChild(img)
      })
      imagesSection.appendChild(gallery)
    } else if (!isJarjestaja) {
      const noImg = document.createElement('p')
      noImg.className = 'marker-detail-placeholder'
      noImg.textContent = 'Ei kuvia'
      imagesSection.appendChild(noImg)
    }

    if (isJarjestaja) {
      const addImageBtn = document.createElement('button')
      addImageBtn.type = 'button'
      addImageBtn.className = 'marker-detail-add-image-btn'
      addImageBtn.textContent = '📷 Lisää kuva'

      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.setAttribute('capture', 'environment')
      fileInput.className = 'marker-detail-image-input'
      fileInput.hidden = true
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0]
        if (!file) return
        addImageBtn.disabled = true
        this.manager.addImage(marker.id, file)
          .then(() => { this.onUpdate(); this.refresh(marker.id) })
          .catch(() => { addImageBtn.disabled = false })
        fileInput.value = ''
      })
      addImageBtn.addEventListener('click', () => fileInput.click())

      imagesSection.appendChild(addImageBtn)
      imagesSection.appendChild(fileInput)
    }

    body.appendChild(imagesSection)

    frag.appendChild(body)

    // Footer — modal-footer-pattern
    if (isJarjestaja) {
      frag.appendChild(this.buildJarjestajaFooter(marker, library, noteInput))
    } else if (role === 'talkoolainen') {
      frag.appendChild(this.buildTalkoolainenFooter(marker))
    }

    return frag
  }

  private buildJarjestajaFooter(marker: SignMarker, library: SignLibrary | null, noteInput: HTMLTextAreaElement): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'modal-footer marker-detail-actions'

    // T137/V84: järjestäjä voi asettaa minkä tahansa statuksen suoraan, ei validActions()-rajausta
    const statusLabel = document.createElement('label')
    statusLabel.className = 'marker-detail-label'
    statusLabel.textContent = 'Status'
    footer.appendChild(statusLabel)

    const statusRow = document.createElement('div')
    statusRow.className = 'marker-detail-status-row'
    const renderStatusRow = () => {
      statusRow.innerHTML = ''
      ;(Object.keys(STATUS_LABELS) as MarkerStatus[]).forEach(status => {
        const btn = document.createElement('button')
        const isCurrent = status === marker.status
        btn.className = isCurrent ? 'modal-btn-primary' : 'modal-btn-secondary'
        btn.textContent = STATUS_LABELS[status]
        btn.disabled = isCurrent
        btn.setAttribute('aria-pressed', String(isCurrent))
        btn.addEventListener('click', () => {
          // marker on sama viittaus manager.getAll()-listan alkioon (V84) — bulkSetStatus
          // mutatoi marker.status:n suoraan, joten rivi voidaan piirtää uudelleen ilman
          // koko modaalin sulkemista/uudelleenavausta (ei hukkaa tallentamatonta huomiota, B14-tyylinen riski).
          this.manager.bulkSetStatus([marker.id], status)
          this.onUpdate()
          renderStatusRow()
        })
        statusRow.appendChild(btn)
      })
    }
    renderStatusRow()
    footer.appendChild(statusRow)

    // Type select above footer actions
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
      this.manager.updateType(marker.id, newType, template?.color, template?.label, template?.iconId, template?.parts)
      this.onUpdate()
    })

    footer.appendChild(typeLabel)
    footer.appendChild(typeSelect)

    // Primary + secondary actions
    const actions = document.createElement('div')
    actions.className = 'modal-footer-actions'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'modal-btn-primary'
    saveBtn.textContent = 'Tallenna'
    saveBtn.addEventListener('click', () => {
      this.manager.updateNote(marker.id, noteInput.value)
      this.onUpdate()
      this.close()
    })
    actions.appendChild(saveBtn)

    footer.appendChild(actions)

    // Destructive — V58: small text button, requires confirm
    const destructiveRow = document.createElement('div')
    destructiveRow.className = 'modal-footer-destructive'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'modal-btn-destructive'
    deleteBtn.textContent = 'Poista merkki'
    deleteBtn.addEventListener('click', () => {
      if (window.confirm('Poistetaanko merkki?')) {
        this.close()
        this.manager.remove(marker.id)
        this.onUpdate()
      }
    })
    destructiveRow.appendChild(deleteBtn)
    footer.appendChild(destructiveRow)

    return footer
  }

  private buildTalkoolainenFooter(marker: SignMarker): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'modal-footer'

    const actions = document.createElement('div')
    actions.className = 'modal-footer-actions'

    validActions(marker.status).forEach(action => {
      if (!canTransition(marker.status, action)) return
      const btn = document.createElement('button')
      btn.className = action === 'peru' ? 'modal-btn-secondary' : 'modal-btn-primary'
      btn.textContent = ACTION_LABELS[action] ?? action
      btn.addEventListener('click', () => {
        this.manager.updateStatus(marker.id, action)
        this.onUpdate()
        this.close()
      })
      actions.appendChild(btn)
    })

    footer.appendChild(actions)
    return footer
  }
}
