import { registerEscClose, createBackdrop } from './modal-helpers'
import { SIGN_TYPES } from '../logic/sign-picker'
import { loadChecked, setChecked, checkProgress } from '../logic/varustarkastus'
import type { Segment, EquipmentItem } from '../logic/segments'
import type { SignMarker } from '../logic/types'

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? SIGN_TYPES.find(s => s.type === type)?.label ?? type
}

// T224 (C): talkoolaisen varustelista omana modaalinaan (kuten "Kaikki merkit" -massalista) —
// tilava, selkeä Tallenna-nappi. Auto-laskuri (merkkityypeittäin) readonly; manuaalirivit
// muokattavia. VISION r42/239: talkoolainen päivittää varustelistan ennen lähtöä. Tallennus V38/V93.
export class EquipmentModal {
  private root: HTMLElement | null = null
  private backdrop: HTMLElement | null = null
  private escDispose: (() => void) | null = null
  private draft: EquipmentItem[] = []
  private autoCounts: [string, number][] = []
  // T258/R2: varustarkastus-checkoff ("otin nämä") — client-only per pätkä.
  private segId = ''
  private checked = new Set<string>()

  constructor(private readonly onSave: (equipment: EquipmentItem[]) => void) {}

  // T258/R2: label-avaimet checkoffille. Auto = merkkityyppi, manuaali = nimi (ei-tyhjä).
  private autoKey(type: string): string { return 'sign:' + type }
  private manualKey(name: string): string { return 'item:' + name.trim() }

  // Kaikki checkattavat labelit edistymän laskentaan (auto-merkit + ei-tyhjät manuaalirivit).
  private allLabels(): string[] {
    return [
      ...this.autoCounts.map(([type]) => this.autoKey(type)),
      ...this.draft.filter(i => i.name.trim() !== '').map(i => this.manualKey(i.name)),
    ]
  }

  // T258/R2: checkoff-label (checkbox + teksti). Toggle persistoi client-only + päivittää edistymän.
  private buildCheckbox(key: string, text: string, progressEl: HTMLElement): HTMLElement {
    const label = document.createElement('label')
    label.className = 'equipment-check'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'equipment-check-box'
    cb.checked = this.checked.has(key)
    cb.addEventListener('change', () => {
      this.checked = setChecked(this.segId, key, cb.checked)
      label.classList.toggle('equipment-check--done', cb.checked)
      this.updateProgress(progressEl)
    })
    const span = document.createElement('span')
    span.className = 'equipment-check-label'
    span.textContent = text
    label.classList.toggle('equipment-check--done', cb.checked)
    label.appendChild(cb)
    label.appendChild(span)
    return label
  }

  private updateProgress(el: HTMLElement): void {
    const { done, total } = checkProgress(this.checked, this.allLabels())
    el.textContent = total === 0 ? 'Ei varusteita listalla vielä' : `Varustarkastus: ${done}/${total} otettu`
    el.classList.toggle('equipment-modal-progress--done', total > 0 && done === total)
  }

  isOpen(): boolean {
    return this.root !== null
  }

  open(segment: Segment, markers: SignMarker[]): void {
    this.close()
    this.draft = segment.equipment.map(i => ({ ...i }))
    const counts = new Map<string, number>()
    for (const m of markers) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
    this.autoCounts = [...counts.entries()]
    // T258/R2: lataa varustarkastus-checkoffit tälle pätkälle.
    this.segId = segment.id
    this.checked = loadChecked(segment.id)

    this.backdrop = createBackdrop('equipment-modal-backdrop', () => this.close())
    document.body.appendChild(this.backdrop)

    const root = document.createElement('div')
    root.className = 'equipment-modal'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Varustelista')
    this.root = root
    document.body.appendChild(root)

    this.escDispose = registerEscClose(() => this.close())
    this.render()
  }

  close(): void {
    this.root?.remove()
    this.backdrop?.remove()
    this.escDispose?.()
    this.root = null
    this.backdrop = null
    this.escDispose = null
  }

  private commitAndClose(): void {
    // Tyhjänimiset rivit karsitaan tallennuksessa.
    this.onSave(this.draft.filter(i => i.name.trim() !== '').map(i => ({ name: i.name.trim(), count: Math.max(1, Math.round(i.count) || 1) })))
    this.close()
  }

  private render(): void {
    if (!this.root) return
    this.root.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'equipment-modal-header'
    const title = document.createElement('h2')
    title.textContent = 'Varustelista'
    const closeBtn = document.createElement('button')
    closeBtn.className = 'equipment-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.close())
    header.appendChild(title)
    header.appendChild(closeBtn)
    this.root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'equipment-modal-body'

    // T258/R2: varustarkastus-edistymä ("otin nämä"). Päivittyy checkoff-klikkauksesta.
    const progress = document.createElement('p')
    progress.className = 'equipment-modal-progress'
    body.appendChild(progress)
    this.updateProgress(progress)

    // Auto-laskuri (readonly-laskuri) — merkkityypeittäin pätkällä + varustarkastus-checkoff (R2).
    if (this.autoCounts.length > 0) {
      const autoTitle = document.createElement('p')
      autoTitle.className = 'equipment-modal-section-title'
      autoTitle.textContent = 'Merkit pätkällä (ota mukaan)'
      body.appendChild(autoTitle)
      const autoList = document.createElement('ul')
      autoList.className = 'equipment-modal-auto-list'
      for (const [type, count] of this.autoCounts) {
        const li = document.createElement('li')
        li.className = 'equipment-auto-item'
        li.appendChild(this.buildCheckbox(this.autoKey(type), `${count}× ${typeLabel(type)}`, progress))
        autoList.appendChild(li)
      }
      body.appendChild(autoList)
    }

    // Manuaalilista (muokattava).
    const manualTitle = document.createElement('p')
    manualTitle.className = 'equipment-modal-section-title'
    manualTitle.textContent = 'Omat varusteet'
    body.appendChild(manualTitle)

    const manualWrap = document.createElement('div')
    manualWrap.className = 'equipment-modal-manual'

    if (this.draft.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'equipment-modal-empty'
      empty.textContent = 'Ei omia varusteita vielä. Lisää esim. "5 rullaa nauhaa".'
      manualWrap.appendChild(empty)
    }

    this.draft.forEach((item, i) => {
      const row = document.createElement('div')
      row.className = 'equipment-modal-row equipment-manual-item'

      // T258/R2: varustarkastus-checkoff (vain ei-tyhjä nimi — uutta riviä ei voi vielä checkata).
      if (item.name.trim() !== '') {
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.className = 'equipment-manual-check'
        cb.setAttribute('aria-label', 'Otettu mukaan')
        cb.checked = this.checked.has(this.manualKey(item.name))
        cb.addEventListener('change', () => {
          this.checked = setChecked(this.segId, this.manualKey(item.name), cb.checked)
          row.classList.toggle('equipment-manual-item--done', cb.checked)
          this.updateProgress(progress)
        })
        row.classList.toggle('equipment-manual-item--done', cb.checked)
        row.appendChild(cb)
      }

      const countInput = document.createElement('input')
      countInput.type = 'number'
      countInput.className = 'equipment-modal-count'
      countInput.min = '1'
      countInput.step = '1'
      countInput.inputMode = 'numeric'
      countInput.value = String(item.count)
      countInput.setAttribute('aria-label', 'Määrä')
      countInput.addEventListener('input', () => {
        this.draft[i].count = Math.max(1, Math.round(parseFloat(countInput.value) || 1))
      })
      row.appendChild(countInput)

      const nameInput = document.createElement('input')
      nameInput.type = 'text'
      nameInput.className = 'equipment-modal-name'
      nameInput.value = item.name
      nameInput.placeholder = 'esim. rullaa nauhaa'
      nameInput.setAttribute('aria-label', 'Varusteen nimi')
      nameInput.addEventListener('input', () => { this.draft[i].name = nameInput.value })
      row.appendChild(nameInput)

      const removeBtn = document.createElement('button')
      removeBtn.className = 'btn btn--ghost equipment-modal-remove'
      removeBtn.setAttribute('aria-label', 'Poista varuste')
      removeBtn.textContent = '✕'
      removeBtn.addEventListener('click', () => { this.draft.splice(i, 1); this.render() })
      row.appendChild(removeBtn)

      manualWrap.appendChild(row)
    })

    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn--secondary equipment-modal-add'
    addBtn.textContent = '+ Lisää varuste'
    addBtn.addEventListener('click', () => { this.draft.push({ name: '', count: 1 }); this.render() })
    manualWrap.appendChild(addBtn)

    body.appendChild(manualWrap)
    this.root.appendChild(body)

    // Footer: Tallenna (primary) + Peruuta.
    const footer = document.createElement('div')
    footer.className = 'equipment-modal-footer'
    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn btn--confirm equipment-modal-save'
    saveBtn.textContent = 'Tallenna'
    saveBtn.addEventListener('click', () => this.commitAndClose())
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn btn--secondary equipment-modal-cancel'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.addEventListener('click', () => this.close())
    footer.appendChild(cancelBtn)
    footer.appendChild(saveBtn)
    this.root.appendChild(footer)
  }
}
