import { createSegment } from '../logic/segments'
import { pushSegment } from '../logic/segment-sync'
import type { Segment, SegmentStore } from '../logic/segments'
import { registerEscClose, createBackdrop } from './modal-helpers'

export type CreationState =
  | { mode: 'idle' }
  | { mode: 'vaihe1' }
  | { mode: 'vaihe2'; routeId: string; startDist: number }
  | { mode: 'tiedot'; routeIds: string[]; startDist: number; endDist: number }

export class SegmentCreationModal {
  private backdrop: HTMLElement | null = null
  private unregEsc: (() => void) | null = null
  private segmentCounter: number

  constructor(
    private readonly store: SegmentStore,
    private readonly onCancel: () => void,
    private readonly onSaved: (seg: Segment) => void,
    // T150/V94: uusi pätkä syntyy järjestäjän aktiiviseen phase-näkymään, ei hardcoded 'asettaminen'
    private readonly getPhase: () => Segment['phase'] = () => 'asettaminen',
  ) {
    this.segmentCounter = store.size
  }

  open(state: CreationState): void {
    this.close()

    const backdrop = createBackdrop('segment-creation-modal-backdrop', () => this.onCancel())

    const modal = document.createElement('div')
    modal.className = 'segment-creation-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Luo uusi pätkä')
    modal.dataset.testid = 'creation-modal'

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.backdrop = backdrop
    this.unregEsc = registerEscClose(() => this.onCancel())

    this.updatePhase(state)
  }

  updatePhase(state: CreationState): void {
    if (!this.backdrop) return
    const modal = this.backdrop.querySelector('.segment-creation-modal') as HTMLElement
    if (!modal) return
    modal.innerHTML = ''

    const inMapPhase = state.mode === 'vaihe1' || state.mode === 'vaihe2'
    this.backdrop.dataset.phase = state.mode
    this.backdrop.style.pointerEvents = inMapPhase ? 'none' : 'all'
    modal.style.pointerEvents = 'all'

    modal.appendChild(this.buildHeader())

    if (state.mode === 'vaihe1' || state.mode === 'vaihe2') {
      const step = state.mode === 'vaihe1' ? 1 : 2
      modal.appendChild(this.buildProgress(step))

      const instruction = document.createElement('p')
      instruction.className = 'segment-creation-instruction'
      instruction.textContent = step === 1 ? 'Klikkaa kartalta aloituspiste' : 'Klikkaa kartalta lopetuspiste'
      modal.appendChild(instruction)

      if (state.mode === 'vaihe2') {
        const info = document.createElement('p')
        info.className = 'segment-creation-info'
        info.textContent = `Aloituspiste: ${(state.startDist / 1000).toFixed(1)} km`
        modal.appendChild(info)
      }

      const errorEl = document.createElement('p')
      errorEl.className = 'segment-creation-error'
      errorEl.hidden = true
      errorEl.dataset.errorEl = 'true'
      modal.appendChild(errorEl)
    } else if (state.mode === 'tiedot') {
      modal.appendChild(this.buildProgress(3))
      this.appendTiedotForm(modal, state.routeIds, state.startDist, state.endDist)
    }
  }

  setError(msg: string): void {
    const errorEl = this.backdrop?.querySelector('[data-error-el]') as HTMLElement | null
    if (errorEl) {
      errorEl.textContent = msg
      errorEl.hidden = false
    }
  }

  close(): void {
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'segment-creation-modal-header'

    const title = document.createElement('span')
    title.className = 'segment-creation-modal-title'
    title.textContent = 'Luo uusi pätkä'
    header.appendChild(title)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'segment-creation-modal-cancel'
    cancelBtn.setAttribute('aria-label', 'Peruuta')
    cancelBtn.textContent = '✕'
    cancelBtn.addEventListener('click', () => this.onCancel())
    header.appendChild(cancelBtn)

    return header
  }

  private buildProgress(activeSteps: number): HTMLElement {
    const progress = document.createElement('div')
    progress.className = 'segment-creation-progress'
    const steps: string[] = []
    for (let i = 1; i <= 3; i++) {
      if (i > 1) steps.push('<span class="step-sep">—</span>')
      steps.push(`<span class="step ${i <= activeSteps ? 'active' : ''}">${i}</span>`)
    }
    progress.innerHTML = steps.join('')
    return progress
  }

  private appendTiedotForm(
    modal: HTMLElement,
    routeIds: string[],
    startDist: number,
    endDist: number,
  ): void {
    const nameSection = document.createElement('div')
    nameSection.className = 'segment-creation-modal-section'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = 'Pätkän nimi'
    nameSection.appendChild(nameLabel)
    const nameInput = document.createElement('input')
    nameInput.className = 'segment-creation-name-input'
    nameInput.type = 'text'
    this.segmentCounter++
    nameInput.value = `Pätkä ${this.segmentCounter}`
    nameInput.placeholder = 'Esim. Pätkä 1'
    nameSection.appendChild(nameInput)
    modal.appendChild(nameSection)

    const descSection = document.createElement('div')
    descSection.className = 'segment-creation-modal-section'
    const descLabel = document.createElement('label')
    descLabel.textContent = 'Järjestäjän ohjeet'
    descSection.appendChild(descLabel)
    const descInput = document.createElement('textarea')
    descInput.className = 'segment-creation-desc-input'
    descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
    descInput.rows = 3
    descSection.appendChild(descInput)
    modal.appendChild(descSection)

    const footer = document.createElement('div')
    footer.className = 'segment-creation-modal-footer'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn-segment-creation-save'
    saveBtn.textContent = 'Tallenna'
    saveBtn.addEventListener('click', () => {
      const displayName = nameInput.value.trim() || `Pätkä ${this.segmentCounter}`
      const description = descInput.value.trim() || undefined
      const seg = createSegment(this.store, {
        routeIds, startDist, endDist,
        equipment: [],
        phase: this.getPhase(),
        displayName,
        description,
      })
      pushSegment(seg).catch(() => {})
      this.close()
      this.onSaved(seg)
    })
    footer.appendChild(saveBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-segment-creation-cancel'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.addEventListener('click', () => this.onCancel())
    footer.appendChild(cancelBtn)

    modal.appendChild(footer)
  }
}
