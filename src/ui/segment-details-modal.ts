import { updateSegment, deleteSegment, getMarkersForSegment, cloneSegmentToNextPhase, NEXT_PHASE, generateSegmentSlug, segmentPath } from '../logic/segments'
import { updateSegmentRemote, deleteSegmentRemote, pushSegment } from '../logic/segment-sync'
import type { Segment, SegmentStore, EquipmentItem } from '../logic/segments'
import type { SignMarker } from '../logic/types'
import { registerEscClose, createBackdrop } from './modal-helpers'
import { buildMarkerVisual } from './marker-visual-row'
import { displayKm, orderMarkersInSegment } from '../logic/segment-order'
import { fetchSegmentAudit, undoSegmentActions, type AuditEntry } from '../logic/audit-sync'
// T320: verbitaulu asuu logiikkakerroksessa — sama totuus lokinäkymälle ja tälle modaalille.
import { ACTION_VERB } from '../logic/audit-log'

const STATUS_LABELS: Record<string, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu ✓',
  tarkistettu: 'Tarkistettu ✓',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const PHASE_LABELS: Record<Segment['phase'], string> = {
  asettaminen: 'asetus',
  tarkastus: 'tarkastus',
  purku: 'purku',
}

const TYPE_LABELS: Record<string, string> = {
  right: 'Oikealle',
  left: 'Vasemmalle',
  'upcoming-right': 'Tuleva oikealle',
  'upcoming-left': 'Tuleva vasemmalle',
}

export interface SegmentDetailsCallbacks {
  getMarkers?: () => SignMarker[]
  onEnterEditMode?: (seg: Segment, onSave: (startDist: number, endDist: number) => void) => void
  onExitEditMode?: () => void
  // T335/V243: kartan korostus vain tähän pätkään. Tila EI asu modaalissa (modaali tuhoutuu
  // sulkiessa, tila jää päälle) — omistaja on wiring, modaali kysyy ja kytkee.
  isFocusSegment?: (seg: Segment) => boolean
  onToggleFocusSegment?: (seg: Segment, on: boolean) => void
}

// V243/V197: label kertoo NYKYTILAN sanoin (ei pelkkä ikoni/väri). Pois = ◎, päällä = ◉.
export function focusToggleLabel(on: boolean): string {
  return on ? '◉ Korostus päällä' : '◎ Korosta vain tämä pätkä'
}

export class SegmentDetailsModal {
  private backdrop: HTMLElement | null = null
  private unregEsc: (() => void) | null = null

  constructor(
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
    private readonly onRender: () => void,
    private readonly callbacks: SegmentDetailsCallbacks = {},
  ) {}

  open(seg: Segment): void {
    this.close()

    const backdrop = createBackdrop('segment-details-modal-backdrop', () => this.close())

    const modal = document.createElement('div')
    modal.className = 'segment-details-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Pätkän lisätiedot ja varusteet')

    // Title element — updated in-place by name save
    const titleEl = document.createElement('span')
    titleEl.className = 'segment-details-modal-title'
    titleEl.textContent = seg.displayName ?? 'Pätkän lisätiedot'

    modal.appendChild(this.buildHeader(titleEl, () => this.close()))

    // T346: audit-osio elää nyt Jako-ryhmän sisällä (buildBody), ⊥ bodyn loppuun liimattuna.
    const { body } = this.buildBody(seg, titleEl)
    // T344/V250: vaaravyöhyke rungon sisällä ENNEN footeria — footerin alle jäävä poisto
    // luetaan toiseksi dialogiksi.
    body.appendChild(this.buildDangerZone(seg))
    modal.appendChild(body)
    modal.appendChild(this.buildCloseFooter())

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.backdrop = backdrop
    this.unregEsc = registerEscClose(() => this.close())
  }

  close(): void {
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }

  private buildHeader(titleEl: HTMLElement, onClose: () => void): HTMLElement {
    const header = document.createElement('div')
    header.className = 'segment-details-modal-header'
    header.appendChild(titleEl)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'segment-details-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', onClose)
    header.appendChild(closeBtn)

    return header
  }

  private buildBody(
    seg: Segment,
    titleEl: HTMLElement,
  ): { body: HTMLElement } {
    const body = document.createElement('div')
    body.className = 'segment-details-modal-body'

    // T346/V250: viisi ryhmää, ei kahdeksaa irrallista lohkoa. Ryhmä vastaa yhteen kysymykseen
    // ("mikä pätkä", "mitä siihen kuuluu", "kuka tekee", "miten se näkyy kartalla", "entä seuraava
    // vaihe") ∴ järjestäjä löytää etsimänsä ilman koko modaalin lukemista.
    // Ryhmäjako on myös TULEVA MODUULIRAJA (moduuli on ⚠️ pilkkolistalla) — pilkkominen seuraa
    // näitä rajoja, ⊥ keksi uusia. Osiofunktiot pysyvät koskemattomina: tämä on rakennemuutos,
    // ⊥ toiminnallisuusmuutos ∴ olemassa olevien testien valitsimet ! pysyä voimassa.
    const group = (title: string, sections: HTMLElement[]): void => {
      const heading = document.createElement('p')
      heading.className = 'segment-details-section-title segment-details-group-title'
      heading.textContent = title
      body.appendChild(heading)
      for (const sec of sections) body.appendChild(sec)
    }

    group('Tiedot', [
      this.buildNameSection(seg, titleEl).section,
      this.buildDescSection(seg).section,
    ])

    // T199: merkit + varusteet ovat yksi lista (⊥ kolme osiota kuten ennen T199:ää)
    group('Sisältö', [this.buildMarkersAndEquipmentSection(seg)])

    // Jako = kenelle pätkä kuuluu & mitä tekijä on tehnyt. Aktiviteettiloki (T227) kuuluu tähän
    // ryhmään eikä bodyn loppuun: se on assign-tiedon jatke, ⊥ oma saareke.
    // T352/V255 (B138): valmis-toggle kuuluu Jako-ryhmään — "mitä tekijä on tehnyt". Järjestäjän
    // AINOA sisääntulo pätkän valmis-tilaan (⋯-valikko on `data-role-hide="järjestäjä"` & SegmentView
    // kytketään vain talkoolaispolussa) ∴ ilman tätä järjestäjä ⊥ voi kuitata soittaneen talkoolaisen
    // puolesta eikä perua virhekuittausta.
    const jako: HTMLElement[] = [this.buildAssignSection(seg)]
    const completeSection = this.buildCompleteSection(seg)
    if (completeSection) jako.push(completeSection)
    if (seg.assignedCode) jako.push(this.buildAuditSection(seg.assignedCode))
    group('Jako', jako)

    group('Kartta', [
      this.buildEditPointsSection(seg),
      this.buildFocusSection(seg),
    ])

    group('Vaiheet', [this.buildCloneSection(seg)])

    // T344/V250: EI saveAll-kokoojaa. Nimi tallentuu `blur`illa & kuvaus `change`illä samalla
    // kutsuparilla kuin varusteet/assign/rajat ∴ dialogissa on yksi tallennusmalli, ei kahta.
    // Footer ei enää lupaa tallentavansa mitään — se vain sulkee.
    return { body }
  }

  private buildNameSection(
    seg: Segment,
    titleEl: HTMLElement,
  ): { section: HTMLElement; nameInput: HTMLInputElement; saveDisplayName: () => void } {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const label = document.createElement('label')
    label.className = 'segment-desc-label'
    label.textContent = 'Pätkän nimi'
    section.appendChild(label)

    const nameInput = document.createElement('input')
    nameInput.className = 'segment-details-name-input'
    nameInput.type = 'text'
    nameInput.value = seg.displayName ?? ''
    nameInput.placeholder = 'Esim. Pätkä 1'
    section.appendChild(nameInput)

    // T298/V209: pätkän linkki näkyy heti nimen alla — ei enää "jaa linkki" -porttia (B113).
    // Nimenmuutos regeneroi slugin ∴ linkki päivittyy tässä ja vanha lakkaa toimimasta.
    const linkRow = document.createElement('div')
    linkRow.className = 'segment-details-link-row'
    const linkEl = document.createElement('a')
    linkEl.className = 'segment-details-link'
    const copyBtn = document.createElement('button')
    copyBtn.className = 'btn-copy-url'
    copyBtn.textContent = '📋 Kopioi'
    const renderLink = () => {
      const current = this.store.get(seg.id) ?? seg
      const path = segmentPath(current)
      linkRow.hidden = !path
      if (!path) return
      linkEl.href = path
      linkEl.textContent = path
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(`${window.location.origin}${path}`).catch(() => {})
      }
    }
    linkRow.append(linkEl, copyBtn)
    section.appendChild(linkRow)

    const linkHint = document.createElement('p')
    linkHint.className = 'segment-details-link-hint'
    linkHint.textContent = 'Nimen muutos vaihtaa linkin — vanha linkki lakkaa toimimasta.'
    section.appendChild(linkHint)
    renderLink()

    const saveDisplayName = () => {
      const val = nameInput.value.trim() || undefined
      const updated = updateSegment(this.store, seg.id, { displayName: val })
      seg.displayName = val
      if (updated) seg.slug = updated.slug
      updateSegmentRemote(seg.id, {
        displayName: val ?? null as unknown as string,
        slug: updated?.slug ?? null as unknown as string,
      }).catch(() => {})
      titleEl.textContent = val ?? 'Pätkän lisätiedot'
      renderLink()
      this.onRender()
    }
    nameInput.addEventListener('blur', saveDisplayName)
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveDisplayName(); nameInput.blur() }
    })

    return { section, nameInput, saveDisplayName }
  }

  private buildDescSection(
    seg: Segment,
  ): { section: HTMLElement; descInput: HTMLTextAreaElement } {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const label = document.createElement('label')
    label.className = 'segment-desc-label'
    label.textContent = 'Järjestäjän ohjeet'
    section.appendChild(label)

    const descInput = document.createElement('textarea')
    descInput.className = 'segment-desc-input'
    descInput.placeholder = 'Esim. Muista parkkipaikka Natura-tien varrella'
    descInput.value = seg.description ?? ''
    descInput.rows = 3
    descInput.addEventListener('change', () => {
      const desc = descInput.value.trim() || undefined
      updateSegment(this.store, seg.id, { description: desc })
      updateSegmentRemote(seg.id, { description: desc ?? null as unknown as string }).catch(() => {})
    })
    section.appendChild(descInput)

    return { section, descInput }
  }

  // T199: yhtenäinen "Merkit & varusteet" -lista — korvaa entiset kolme erillistä osiota
  // (tekstilista + "6× left"-automaattilaskuri + manuaalinen lista) yhdellä loogisella
  // sektiolla. Precise-rivit + yhteenveto-chipit käyttävät buildMarkerVisual (T198) —
  // sama visuaali kuin kartalla (V87: täyttö on tyyppiväri, ei tekstiä).
  private buildMarkersAndEquipmentSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const allMarkers = this.callbacks.getMarkers?.() ?? []
    const segMarkers = getMarkersForSegment(seg, allMarkers)

    if (segMarkers.length > 0) {
      const title = document.createElement('p')
      title.className = 'segment-equipment-title'
      title.textContent = `Merkit pätkällä (${segMarkers.length}):`
      section.appendChild(title)

      const list = document.createElement('ul')
      list.className = 'segment-details-marker-list'
      // T328/V237: sama akseli & sama luku kuin talkoolaisen näkymässä (V236-henki) — järjestäjä
      // ja talkoolainen eivät saa nähdä samaa pätkää eri järjestyksessä (B129).
      const ord = orderMarkersInSegment(segMarkers, seg)
      const sorted = [...ord.onRoute, ...ord.offRoute]
      for (const m of sorted) {
        const li = document.createElement('li')
        li.className = 'segment-details-marker-item'
        li.appendChild(buildMarkerVisual(m, { size: 34, zoomable: true }))
        const info = document.createElement('span')
        info.className = 'segment-details-marker-info'
        info.textContent = m.label ?? TYPE_LABELS[m.type] ?? m.type
        li.appendChild(info)
        const km = document.createElement('span')
        km.className = 'segment-details-marker-km'
        km.textContent = `${(displayKm(m, seg) / 1000).toFixed(1)} km`
        li.appendChild(km)
        const badge = document.createElement('span')
        badge.className = `segment-details-marker-status status-${m.status}`
        badge.textContent = STATUS_LABELS[m.status] ?? m.status
        li.appendChild(badge)
        list.appendChild(li)
      }
      section.appendChild(list)

      // Yhteenveto — groupoitu m.type:n mukaan (sama laskenta kuin ennen), chip-rivi ison
      // luvun + oikean merkkivisuaalin kanssa. Korvaa entisen "6× left"-tekstirivin.
      const groups = new Map<string, SignMarker[]>()
      for (const m of segMarkers) {
        const arr = groups.get(m.type) ?? []
        arr.push(m)
        groups.set(m.type, arr)
      }
      const summaryTitle = document.createElement('p')
      summaryTitle.className = 'segment-equipment-title'
      summaryTitle.textContent = 'Yhteenveto:'
      section.appendChild(summaryTitle)
      const chipList = document.createElement('ul')
      chipList.className = 'segment-equipment-chip-list'
      for (const [, ms] of groups) {
        const rep = ms[0]
        const li = document.createElement('li')
        li.className = 'segment-equipment-chip'
        const count = document.createElement('span')
        count.className = 'segment-equipment-chip-count'
        count.textContent = `${ms.length}×`
        li.appendChild(count)
        li.appendChild(buildMarkerVisual(rep, { size: 28, zoomable: false }))
        const nameEl = document.createElement('span')
        nameEl.className = 'segment-equipment-chip-name'
        nameEl.textContent = rep.label ?? TYPE_LABELS[rep.type] ?? rep.type
        li.appendChild(nameEl)
        chipList.appendChild(li)
      }
      section.appendChild(chipList)
    }

    const container = section
    const manualTitle = document.createElement('p')
    manualTitle.className = 'segment-equipment-title'
    manualTitle.textContent = 'Lisävarusteet:'
    container.appendChild(manualTitle)

    const listEl = document.createElement('ul')
    listEl.className = 'segment-equipment-manual-list'
    container.appendChild(listEl)

    const renderList = (items: EquipmentItem[]) => {
      listEl.innerHTML = ''
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const li = document.createElement('li')
        li.className = 'segment-equipment-item'

        const countInput = document.createElement('input')
        countInput.type = 'number'
        countInput.min = '1'
        countInput.value = String(item.count)
        countInput.className = 'equipment-count-input'
        countInput.addEventListener('change', () => {
          const newCount = Math.max(1, parseInt(countInput.value) || 1)
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])]
          updated[i] = { ...updated[i], count: newCount }
          updateSegment(this.store, seg.id, { equipment: updated })
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
        })
        li.appendChild(countInput)

        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.value = item.name
        nameInput.className = 'equipment-name-input'
        nameInput.placeholder = 'esim. nauhaa'
        nameInput.addEventListener('change', () => {
          const newName = nameInput.value.trim()
          if (!newName) return
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])]
          updated[i] = { ...updated[i], name: newName }
          updateSegment(this.store, seg.id, { equipment: updated })
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
        })
        li.appendChild(nameInput)

        const removeBtn = document.createElement('button')
        removeBtn.className = 'btn-equipment-remove'
        removeBtn.textContent = '✕'
        removeBtn.addEventListener('click', () => {
          const updated = [...(this.store.get(seg.id)?.equipment ?? [])].filter((_, idx) => idx !== i)
          updateSegment(this.store, seg.id, { equipment: updated })
          updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
          renderList(updated)
        })
        li.appendChild(removeBtn)
        listEl.appendChild(li)
      }
    }

    renderList(seg.equipment)

    const addRow = document.createElement('div')
    addRow.className = 'segment-equipment-add'
    const countInput = document.createElement('input')
    countInput.type = 'number'
    countInput.min = '1'
    countInput.value = '1'
    countInput.className = 'equipment-count-input'
    countInput.placeholder = 'kpl'
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'equipment-name-input'
    nameInput.placeholder = 'esim. nauhaa'
    const addBtn = document.createElement('button')
    addBtn.className = 'btn-equipment-add'
    addBtn.textContent = '+ Lisää'
    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim()
      if (!name) return
      const count = Math.max(1, parseInt(countInput.value) || 1)
      const current = this.store.get(seg.id)?.equipment ?? []
      const updated = [...current, { name, count }]
      updateSegment(this.store, seg.id, { equipment: updated })
      updateSegmentRemote(seg.id, { equipment: updated }).catch(() => {})
      nameInput.value = ''
      countInput.value = '1'
      renderList(updated)
    })
    addRow.appendChild(countInput)
    addRow.appendChild(nameInput)
    addRow.appendChild(addBtn)
    container.appendChild(addRow)

    return container
  }

  private buildAssignSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const title = document.createElement('p')
    title.className = 'segment-equipment-title'
    // T298: linkki EI enää synny täällä (nimi-osio näyttää sen) — tämä osio nimeää tekijän.
    title.textContent = 'Kuka tekee pätkän:'
    section.appendChild(title)

    const errorEl = document.createElement('p')
    errorEl.className = 'assign-error'
    errorEl.hidden = true

    if (seg.assignedCode) {
      const url = `/s/${seg.assignedCode}`
      const row = document.createElement('div')
      row.className = 'segment-assign-modal-row'

      const urlSpan = document.createElement('span')
      urlSpan.className = 'segment-url'
      urlSpan.textContent = url
      row.appendChild(urlSpan)

      const copyBtn = document.createElement('button')
      copyBtn.className = 'btn-copy-url'
      copyBtn.textContent = '📋 Kopioi'
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${window.location.origin}${url}`).catch(() => {})
      })
      row.appendChild(copyBtn)

      const editBtn = document.createElement('button')
      editBtn.className = 'btn-assign-edit'
      editBtn.textContent = 'Muuta'
      editBtn.addEventListener('click', async () => {
        errorEl.hidden = true
        try {
          const resp = await fetch(`/api/admin/codes/${seg.assignedCode!}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('delete_failed')
          updateSegment(this.store, seg.id, { assignedCode: undefined })
          updateSegmentRemote(seg.id, { assignedCode: null as unknown as string }).catch(() => {})
          seg.assignedCode = undefined // V192: pidä paikallinen seg synkassa uudelleenrenderiä varten
          section.replaceWith(this.buildAssignSection(seg)) // V192: EI sulje modalia — näytä lomake
          this.onRender()
        } catch {
          errorEl.textContent = 'Virhe poistettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })
      row.appendChild(editBtn)
      section.appendChild(row)
    } else {
      // T273/V191: järjestäjä syöttää VAIN näyttönimen → slug auto-generoidaan (ei käsin koodia).
      const form = document.createElement('div')
      form.className = 'segment-assign-modal-form'

      const nameInput = document.createElement('input')
      nameInput.className = 'input-assign-name'
      nameInput.placeholder = 'Tekijän näyttönimi (esim. Matti / Pätkä 1)'
      nameInput.setAttribute('aria-label', 'Talkoolaisen pätkän näyttönimi')
      nameInput.value = seg.displayName ?? ''

      const saveBtn = document.createElement('button')
      saveBtn.className = 'btn-assign-save'
      saveBtn.textContent = 'Tallenna tekijä'
      saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim() || seg.displayName?.trim() || ''
        if (!name) {
          errorEl.textContent = 'Anna näyttönimi ensin'
          errorEl.hidden = false
          return
        }
        errorEl.hidden = true
        const existing = Array.from(this.store.values())
          .map(s => s.assignedCode)
          .filter((c): c is string => !!c)
        const slug = generateSegmentSlug(name, existing)
        try {
          const resp = await fetch('/api/admin/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: slug, display_name: name, segment_id: seg.id }),
          })
          if (!resp.ok) throw new Error('save_failed')
          updateSegment(this.store, seg.id, { assignedCode: slug, displayName: name })
          updateSegmentRemote(seg.id, { assignedCode: slug, displayName: name }).catch(() => {})
          seg.assignedCode = slug // V192: pidä paikallinen seg synkassa
          seg.displayName = name
          section.replaceWith(this.buildAssignSection(seg)) // V192: EI sulje — näytä luotu linkki + Kopioi
          this.onRender()
          this.onUpdate()
        } catch {
          errorEl.textContent = 'Virhe tallennettaessa — yritä uudelleen'
          errorEl.hidden = false
        }
      })

      form.appendChild(nameInput)
      form.appendChild(saveBtn)
      section.appendChild(form)
    }

    section.appendChild(errorEl)
    return section
  }

  // T335/V243: järjestäjän korostuskytkin. Oletus POIS (fokus on hetken työkalu). Modaali ei
  // sulkeudu klikistä — järjestäjä voi kokeilla ja perua saman tien; poistumis-pilleri (wiring)
  // vastaa siitä että tila löytyy vielä modaalin sulkeuduttua.
  // T352/V255 (B138): järjestäjän valmis-toggle. Sama kirjoituspolku kuin talkoolaisella
  // (`markers-wiring.ts` applyComplete): updateSegment + updateSegmentRemote + onRender/onUpdate
  // ∴ pätkäviiva vihertyy heti (T348) & kaksi roolia ⊥ ajaudu eri tilaan. null = ei näytetä:
  // valmis-tila koskee vain asettamista/purkua (tarkastus käyttää inspect-osiota, T230/T147).
  private buildCompleteSection(seg: Segment): HTMLElement | null {
    if (seg.phase !== 'asettaminen' && seg.phase !== 'purku') return null

    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const status = document.createElement('p')
    status.className = 'segment-details-complete-status'
    section.appendChild(status)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'btn-segment-complete-toggle'
    section.appendChild(btn)

    let done = seg.completed ?? false
    const sync = (): void => {
      status.textContent = done ? 'Pätkä merkitty valmiiksi ✓' : ''
      status.hidden = !done
      btn.textContent = done ? '↩ Merkitse keskeneräiseksi' : '✓ Merkitse pätkä valmiiksi'
      btn.className = done
        ? 'btn btn--secondary btn-segment-complete-toggle'
        : 'btn btn--confirm btn-segment-complete-toggle'
      btn.setAttribute('aria-pressed', String(done))
    }
    sync()

    btn.addEventListener('click', () => {
      done = !done
      updateSegment(this.store, seg.id, { completed: done })
      sync()
      this.onRender()
      this.onUpdate()
      // ⊥ hiljaista epäonnistumista: PUT:n kaatuessa kerrotaan tähän osioon (modaalilla ⊥ ole
      // pääsyä main.ts:n showWarningiin — inline-status on lähempänä toimintoa kuin toast).
      updateSegmentRemote(seg.id, { completed: done })
        .then(ok => {
          if (!ok) {
            status.hidden = false
            status.textContent = '⚠ Tallennus epäonnistui — yritä uudelleen'
          }
        })
        .catch(() => {
          status.hidden = false
          status.textContent = '⚠ Tallennus epäonnistui — yritä uudelleen'
        })
    })

    return section
  }

  private buildFocusSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const btn = document.createElement('button')
    btn.className = 'btn btn--ghost btn-segment-focus-toggle'
    btn.type = 'button'
    let on = this.callbacks.isFocusSegment?.(seg) ?? false
    const sync = (): void => {
      btn.textContent = focusToggleLabel(on)
      btn.setAttribute('aria-pressed', String(on))
    }
    sync()
    btn.addEventListener('click', () => {
      on = !on
      sync()
      this.callbacks.onToggleFocusSegment?.(seg, on)
    })
    section.appendChild(btn)
    return section
  }

  private buildEditPointsSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const btn = document.createElement('button')
    btn.className = 'btn-segment-edit-pts-modal'
    btn.textContent = 'Muokkaa pisteitä kartalla'
    btn.addEventListener('click', () => {
      this.close()
      this.callbacks.onEnterEditMode?.(seg, (startDist, endDist) => {
        updateSegment(this.store, seg.id, { startDist, endDist })
        updateSegmentRemote(seg.id, { startDist, endDist }).catch(() => {})
        this.onRender()
        this.onUpdate()
      })
    })
    section.appendChild(btn)
    return section
  }

  private buildCloneSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const nextPhase = NEXT_PHASE[seg.phase]
    const btn = document.createElement('button')
    btn.className = 'btn-segment-clone-phase'
    btn.textContent = `Kloonaa ${PHASE_LABELS[nextPhase]}-vaiheeseen`
    btn.addEventListener('click', () => {
      // T151/V95: overlap kohde-phasessa → null (esim. tuplaklikki) → älä luo, näytä virhe
      const cloned = cloneSegmentToNextPhase(this.store, seg)
      if (!cloned) {
        btn.textContent = `${PHASE_LABELS[nextPhase]}-vaiheessa on jo tämä pätkä`
        btn.disabled = true
        return
      }
      pushSegment(cloned).catch(() => {})
      this.close()
      this.onRender()
      this.onUpdate()
    })
    section.appendChild(btn)
    return section
  }

  // T344/V250: footer VAIN sulkee. Aiempi "Tallenna muutokset" kattoi 2/8 osiosta ∴ se lupasi
  // enemmän kuin teki: ✕:stä sulkenut luuli menettäneensä varusteet (⊥ menettänyt) & säilyttäneensä
  // nimenmuutoksen (⊥ säilyttänyt). Kaikki kentät tallentuvat nyt muutoksesta.
  private buildCloseFooter(): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'segment-details-modal-footer'

    const doneBtn = document.createElement('button')
    doneBtn.className = 'btn-segment-modal-save'
    doneBtn.textContent = 'Valmis'
    doneBtn.addEventListener('click', () => {
      this.close()
      this.onUpdate()
    })
    footer.appendChild(doneBtn)
    return footer
  }

  // T227: per-pätkä aktiviteettiloki + massaperuutus. Vastaa spammaus-huoleen (V149): talkoolaisen
  // lisäykset näkyvät, ja "Peru kaikki lisäykset" poistaa ne atomisesti (POST /api/audit/undo, V153).
  private buildAuditSection(code: string): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-audit-section'

    const title = document.createElement('p')
    title.className = 'segment-details-section-title'
    title.textContent = 'Aktiviteetti'
    section.appendChild(title)

    const listWrap = document.createElement('div')
    listWrap.className = 'segment-audit-list'
    listWrap.textContent = 'Ladataan…'
    section.appendChild(listWrap)

    const renderEntries = (entries: AuditEntry[]): void => {
      listWrap.innerHTML = ''
      if (entries.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'segment-audit-empty'
        empty.textContent = 'Ei aktiviteettia vielä.'
        listWrap.appendChild(empty)
      } else {
        const ul = document.createElement('ul')
        ul.className = 'segment-audit-items'
        // Uusin ensin (backend palauttaa aikajärjestyksessä ASC).
        for (const e of [...entries].reverse()) {
          const li = document.createElement('li')
          li.className = 'segment-audit-item'
          const verb = ACTION_VERB[e.action] ?? e.action
          const time = e.created_at.slice(11, 16) // HH:MM ISO-stringistä
          li.textContent = `${e.actor ?? '?'} — ${verb} · ${time}`
          ul.appendChild(li)
        }
        listWrap.appendChild(ul)
      }

      // Massaperuutus: vain jos lisäyksiä olemassa.
      const addCount = entries.filter((e) => e.action === 'add').length
      if (addCount > 0) {
        const undoBtn = document.createElement('button')
        undoBtn.className = 'btn-segment-audit-undo'
        undoBtn.textContent = `Peru kaikki lisäykset (${addCount})`
        undoBtn.addEventListener('click', async () => {
          if (!confirm(`Poistetaanko pätkän ${addCount} lisättyä merkkiä? Toimintoa ei voi peruuttaa.`)) return
          undoBtn.disabled = true
          const undone = await undoSegmentActions(code, 'add')
          if (undone === null) {
            undoBtn.disabled = false
            alert('⚠ Massaperuutus epäonnistui — yritä uudelleen.')
            return
          }
          this.onRender()
          this.onUpdate()
          await load() // päivitä loki
        })
        listWrap.appendChild(undoBtn)
      }
    }

    const load = async (): Promise<void> => {
      const entries = await fetchSegmentAudit(code)
      if (entries === null) {
        listWrap.innerHTML = ''
        const err = document.createElement('p')
        err.className = 'segment-audit-empty'
        err.textContent = '⚠ Lokin lataus epäonnistui.'
        listWrap.appendChild(err)
        return
      }
      renderEntries(entries)
    }

    void load()
    return section
  }

  private buildDangerZone(seg: Segment): HTMLElement {
    const dangerZone = document.createElement('div')
    dangerZone.className = 'segment-modal-danger-zone'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-segment-delete-modal'
    deleteBtn.textContent = 'Poista pätkä'
    deleteBtn.addEventListener('click', () => {
      const name = seg.displayName ?? seg.id.slice(0, 6)
      if (!confirm(`Poistetaanko pätkä "${name}"? Toimintoa ei voi peruuttaa.`)) return
      this.close()
      this.callbacks.onExitEditMode?.()
      deleteSegment(this.store, seg.id)
      deleteSegmentRemote(seg.id).catch(() => {})
      this.onRender()
      this.onUpdate()
    })
    dangerZone.appendChild(deleteBtn)
    return dangerZone
  }
}
