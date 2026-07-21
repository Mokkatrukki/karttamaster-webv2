import { SIGN_TYPES } from '../logic/sign-picker'
import { loadChecked, setChecked, checkProgress, checkKeyForType, checkKeyForItem } from '../logic/varustarkastus'
import type { Segment } from '../logic/segments'
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

// T262/V182 (talkoolais-KOTI, R3b): KOTI-pätkänäkymän INLINE-varustelista. Näyttää
// varustarkastuksen ("otin nämä" checkoff) suoraan koti-etusivulla — brief "varustarkastus
// ensin, lähtövalmis". Erotettu SegmentView:stä (562r pilkkohälytys ei saa paisua) ja
// EquipmentModalista (modaali = manuaalilistan EDITOINTI; inline = readonly + checkoff).
// Jakaa client-only-tilan (varustarkastus.ts V180) + label-avaimet (checkKeyForType/Item)
// EquipmentModalin kanssa → checkoff täsmää inline↔modaali. "✎ Muokkaa" → EquipmentModal.
export interface SegmentEquipmentContext {
  getSegment(): Segment
  getMarkers(): SignMarker[]
  onEdit(): void
}

export class SegmentEquipment {
  private checked = new Set<string>()

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentEquipmentContext,
  ) {}

  render(): void {
    const segment = this.ctx.getSegment()
    const markers = this.ctx.getMarkers()
    this.el.innerHTML = ''
    this.checked = loadChecked(segment.id)

    // Auto-laskuri merkkityypeittäin (readonly) — sama lähde kuin EquipmentModal (V182).
    const counts = new Map<string, number>()
    for (const m of markers) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
    const autoCounts = [...counts.entries()]
    const manualItems = segment.equipment.filter(i => i.name.trim() !== '')

    const allLabels = [
      ...autoCounts.map(([type]) => checkKeyForType(type)),
      ...manualItems.map(i => checkKeyForItem(i.name)),
    ]

    // Otsikkorivi: 🎒 Varustelista + "✎ Muokkaa varusteita" (→ EquipmentModal).
    const header = document.createElement('div')
    header.className = 'segment-view-equipment-header'
    const title = document.createElement('span')
    title.className = 'segment-view-equipment-title'
    title.textContent = '🎒 Varustelista'
    header.appendChild(title)
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn btn--ghost btn--sm segment-view-equipment-edit'
    editBtn.textContent = '✎ Muokkaa varusteita'
    editBtn.addEventListener('click', () => this.ctx.onEdit())
    header.appendChild(editBtn)
    this.el.appendChild(header)

    // Varustarkastus-edistymä ("Varustarkastus: N/M otettu"), täysi → confirm-vihreä.
    const progress = document.createElement('p')
    progress.className = 'equipment-modal-progress segment-view-equipment-progress'
    this.el.appendChild(progress)
    this.updateProgress(progress, allLabels)

    // Auto-merkit pätkällä (ota mukaan) — checkoff per tyyppi.
    if (autoCounts.length > 0) {
      const autoTitle = document.createElement('p')
      autoTitle.className = 'equipment-modal-section-title'
      autoTitle.textContent = 'Merkit pätkällä (ota mukaan)'
      this.el.appendChild(autoTitle)
      const list = document.createElement('ul')
      list.className = 'equipment-auto-list'
      for (const [type, count] of autoCounts) {
        const li = document.createElement('li')
        li.className = 'equipment-auto-item'
        li.appendChild(this.buildCheckbox(checkKeyForType(type), `${count}× ${typeLabel(type)}`, progress, allLabels))
        list.appendChild(li)
      }
      this.el.appendChild(list)
    }

    // Omat varusteet (manuaalirivit) — readonly + checkoff. Editointi "Muokkaa"-napista.
    const manualTitle = document.createElement('p')
    manualTitle.className = 'equipment-modal-section-title'
    manualTitle.textContent = 'Omat varusteet'
    this.el.appendChild(manualTitle)

    if (manualItems.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'segment-view-equipment-empty'
      empty.textContent = 'Ei omia varusteita. Lisää "✎ Muokkaa varusteita".'
      this.el.appendChild(empty)
    } else {
      const list = document.createElement('ul')
      list.className = 'equipment-auto-list'
      for (const item of manualItems) {
        const li = document.createElement('li')
        li.className = 'equipment-auto-item'
        li.appendChild(this.buildCheckbox(checkKeyForItem(item.name), `${item.count}× ${item.name.trim()}`, progress, allLabels))
        list.appendChild(li)
      }
      this.el.appendChild(list)
    }
  }

  // Checkoff-rivi (checkbox + teksti). Toggle persistoi client-only (V180) + päivittää edistymän.
  // Sama rakenne/luokat kuin EquipmentModal → jaettu CSS + identtinen tila.
  private buildCheckbox(key: string, text: string, progressEl: HTMLElement, allLabels: string[]): HTMLElement {
    const segId = this.ctx.getSegment().id
    const label = document.createElement('label')
    label.className = 'equipment-check'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'equipment-check-box'
    cb.checked = this.checked.has(key)
    cb.addEventListener('change', () => {
      this.checked = setChecked(segId, key, cb.checked)
      label.classList.toggle('equipment-check--done', cb.checked)
      this.updateProgress(progressEl, allLabels)
    })
    const span = document.createElement('span')
    span.className = 'equipment-check-label'
    span.textContent = text
    label.classList.toggle('equipment-check--done', cb.checked)
    label.appendChild(cb)
    label.appendChild(span)
    return label
  }

  private updateProgress(el: HTMLElement, allLabels: string[]): void {
    const { done, total } = checkProgress(this.checked, allLabels)
    el.textContent = total === 0 ? 'Ei varusteita listalla vielä' : `Varustarkastus: ${done}/${total} otettu`
    el.classList.toggle('equipment-modal-progress--done', total > 0 && done === total)
  }
}
