import { updateSegment, deleteSegment, getMarkersForSegment, cloneSegmentToNextPhase, NEXT_PHASE, generateSegmentSlug, segmentPath, segmentPeers } from '../logic/segments'
import { boundsPatch } from '../logic/segment-backfill'
import { getEquipmentCounts, getEquipmentSummary, formatEquipmentSummary } from '../logic/equipment-counts'
import { updateSegmentRemote, deleteSegmentRemote, pushSegment } from '../logic/segment-sync'
import type { Segment, SegmentStore, EquipmentItem } from '../logic/segments'
import type { SignMarker } from '../logic/types'
import { registerEscClose, createBackdrop } from './modal-helpers'
// T354/V257: JAETTU tabikomponentti (talkoolaisen kotinäkymä + tämä modaali) — ⊥ toista toteutusta.
import { SegmentKotiTabs } from './segment-koti-tabs'
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
  // T363: reittigeometria jäljen johtamiseen (V258). Puuttuu → jälki jää ennalleen (V260).
  getRoutes?: () => { id: string; routePoints: { lat: number; lon: number; distanceFromStart: number }[] }[]
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

// T356/V197: headerissa on tilaa vain lyhyelle muodolle — mutta EI pelkälle ikonille: näkyvä
// teksti on saavutettava nimi. Pitkä muoto jää `title`-lisäselitteeksi.
export function focusToggleShortLabel(on: boolean): string {
  return on ? '◉ Korostettu' : '◎ Korosta'
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

    modal.appendChild(this.buildHeader(titleEl, seg, () => this.close()))

    // T346: audit-osio elää nyt Jako-ryhmän sisällä (buildBody), ⊥ bodyn loppuun liimattuna.
    const { body } = this.buildBody(seg, titleEl)
    modal.appendChild(body)
    // T355/V250: poisto on footerin destructive-rivi, ⊥ rungon vaaravyöhyke.
    modal.appendChild(this.buildCloseFooter(seg))

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

  private buildHeader(titleEl: HTMLElement, seg: Segment, onClose: () => void): HTMLElement {
    const header = document.createElement('div')
    header.className = 'segment-details-modal-header'
    header.appendChild(titleEl)

    // T356/V243: korostus on modaalin TILAKYTKIN — se vaikuttaa karttaan taustalla heti, ⊥ ole
    // Asetukset-tabin kolmas alaotsikko. Tila asuu edelleen wiringissä (modaali tuhoutuu
    // sulkiessa), poistumis-pilleri vastaa näkyvyydestä modaalin jälkeen.
    header.appendChild(this.buildFocusToggle(seg))

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

    // T354/V257: kolme välilehteä, SAMA komponentti kuin talkoolaisen kotinäkymässä. T346:n
    // ryhmäjako (Tiedot/Sisältö/Jako/Kartta/Vaiheet) EI katoa — se on edelleen tuleva moduuliraja
    // — mutta Sisältö avautuu kahdeksi tabiksi (merkit ⊥ varusteet ovat eri kysymys kun ne ovat
    // eri välilehdillä ∴ T199:n "yksi lista" -perustelu raukeaa) ja loput neljä ryhmää kääriytyvät
    // Asetukset-tabin sisäotsikoiksi.
    const groupHeading = (title: string): HTMLElement => {
      const heading = document.createElement('p')
      heading.className = 'segment-details-section-title segment-details-group-title'
      heading.textContent = title
      return heading
    }

    const asetukset: HTMLElement[] = [
      groupHeading('Tiedot'),
      this.buildNameSection(seg, titleEl).section,
      this.buildDescSection(seg).section,
      // Jako = kenelle pätkä kuuluu & mitä tekijä on tehnyt. Aktiviteettiloki (T227) on
      // assign-tiedon jatke, ⊥ oma saareke.
      groupHeading('Jako'),
      this.buildAssignSection(seg),
    ]
    if (seg.assignedCode) asetukset.push(this.buildAuditSection(seg.assignedCode))
    asetukset.push(
      groupHeading('Kartta'),
      this.buildEditPointsSection(seg),
      groupHeading('Vaiheet'),
      this.buildCloneSection(seg),
    )

    // T352/V255 (B141) + T354 + T357: valmis-toggle on `Kaikki merkit` -tabissa — SAMA paikka kuin
    // talkoolaisen kotinäkymässä (`segment-view.ts` merkit-tab: markerList + completeSection).
    // Järjestäjän AINOA sisääntulo valmis-tilaan (⋯-valikko on `data-role-hide="järjestäjä"` &
    // SegmentView kytketään vain talkoolaispolussa). T357:n järjestyksessä merkit on KOLMAS tabi
    // & se on hyväksytty (PM-päätös 2026-07-27): kaksi roolia ⊥ saa löytää samaa toimintoa eri
    // paikasta (V236-henki) > tabi-indeksi. Talkoolaisen sisääntulo ⊥ ole tabin varassa (V254:
    // heron done-rivi) ∴ syvyys on järjestäjän desktop-ongelma ⊥ metsässä-ongelma.
    const merkit: HTMLElement[] = [this.buildMarkersSection(seg)]
    const completeSection = this.buildCompleteSection(seg)
    if (completeSection) merkit.push(completeSection)

    const tabs = new SegmentKotiTabs(
      // T357: Asetukset ENSIN ∴ myös oletustabi (SegmentKotiTabs avaa tabs[0]:n kun `initial`
      // puuttuu). Tarkoitettu: järjestäjä avaa modaalin hallitakseen pätkää, ⊥ selatakseen
      // varusteita. `initial`ia ⊥ anneta — kaksi totuutta järjestyksestä ajautuisi erilleen.
      [
        { id: 'asetukset', label: 'Asetukset', els: asetukset },
        { id: 'varuste', label: '🎒 Varustelista', els: [this.buildEquipmentSection(seg)] },
        { id: 'merkit', label: 'Kaikki merkit', els: merkit },
      ],
      // Modaalin body on oma scrollerinsa — ilman tätä tab-vaihto ⊥ nollaisi scrollTopia ja
      // uusi tabi avautuisi keskeltä (T315/V226 katoaisi hiljaa).
      { scrollerSelector: '.segment-details-modal-body' },
    )
    tabs.root.classList.add('segment-details-modal-tabs')
    body.appendChild(tabs.root)

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

  // T199 → T354: merkkilista + yhteenveto omalla välilehdellään. Precise-rivit ja
  // yhteenveto-chipit käyttävät buildMarkerVisual (T198) — sama visuaali kuin kartalla
  // (V87: täyttö on tyyppiväri, ei tekstiä). Rivien DOM & valitsimet ovat T199:stä
  // muuttumattomat — tämä on sijaintimuutos, ⊥ sisältömuutos.
  private buildMarkersSection(seg: Segment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'segment-details-modal-section'

    const allMarkers = this.callbacks.getMarkers?.() ?? []
    const segMarkers = getMarkersForSegment(seg, allMarkers, segmentPeers(this.store, seg))

    if (segMarkers.length === 0) {
      // T354: tyhjätila, ⊥ katoava tabi. Tabi joka häviää datan mukana siirtää naapureita ∴
      // järjestäjä opettelee paikan joka ei pysy paikallaan.
      const empty = document.createElement('p')
      empty.className = 'segment-details-markers-empty'
      empty.textContent = 'Pätkällä ei ole vielä merkkejä.'
      section.appendChild(empty)
      return section
    }

    {
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

      // T393/V285: yhteenveto jaetusta pure-funktiosta — SAMAT luvut kuin talkoolainen näkee
      // omassa varustelistassaan (kolme laskentaa samalle luvulle on kolme mahdollisuutta erota).
      // Iso luku = `take` (vielä asettamatta), kokonaismäärä metassa.
      const summary = getEquipmentSummary(seg, segMarkers)
      const summaryTitle = document.createElement('p')
      summaryTitle.className = 'segment-equipment-title'
      summaryTitle.textContent = 'Yhteenveto:'
      section.appendChild(summaryTitle)
      const summaryEl = document.createElement('p')
      summaryEl.className = 'equipment-summary'
      summaryEl.textContent = formatEquipmentSummary(summary)
      section.appendChild(summaryEl)
      const chipList = document.createElement('ul')
      chipList.className = 'segment-equipment-chip-list'
      for (const c of getEquipmentCounts(seg, segMarkers)) {
        const li = document.createElement('li')
        li.className = 'segment-equipment-chip'
        if (c.take === 0) li.classList.add('segment-equipment-chip--done')
        const count = document.createElement('span')
        count.className = 'segment-equipment-chip-count'
        count.textContent = `${c.take}×`
        li.appendChild(count)
        li.appendChild(buildMarkerVisual(c.sample, { size: 28, zoomable: false }))
        const nameEl = document.createElement('span')
        nameEl.className = 'segment-equipment-chip-name'
        nameEl.textContent = c.sample.label ?? TYPE_LABELS[c.type] ?? c.type
        li.appendChild(nameEl)
        if (c.done > 0) {
          const metaEl = document.createElement('span')
          metaEl.className = 'equipment-count-meta'
          metaEl.textContent = `${c.done}/${c.total} ${c.label}`
          li.appendChild(metaEl)
        }
        chipList.appendChild(li)
      }
      section.appendChild(chipList)
    }

    return section
  }

  // T354: manuaaliset lisävarusteet omana välilehtenään — sama rooli kuin talkoolaisen
  // varustelistalla (`/s/<koodi>` 🎒-tab), ∴ sama paikka ja sama nimi molemmille rooleille.
  private buildEquipmentSection(seg: Segment): HTMLElement {
    const container = document.createElement('div')
    container.className = 'segment-details-modal-section'

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

  // T352/V255 (B141): järjestäjän valmis-toggle. Sama kirjoituspolku kuin talkoolaisella
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

  // T335/V243 → T356: järjestäjän korostuskytkin, nyt headerissa otsikon ja ✕:n välissä.
  // Oletus POIS (fokus on hetken työkalu). Modaali ei sulkeudu klikistä — järjestäjä voi kokeilla
  // ja perua saman tien; poistumis-pilleri (wiring) vastaa siitä että tila löytyy vielä modaalin
  // sulkeuduttua.
  private buildFocusToggle(seg: Segment): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'btn btn--ghost btn-segment-focus-toggle'
    btn.type = 'button'
    let on = this.callbacks.isFocusSegment?.(seg) ?? false
    const sync = (): void => {
      btn.textContent = focusToggleShortLabel(on)
      btn.title = focusToggleLabel(on)
      btn.setAttribute('aria-pressed', String(on))
    }
    sync()
    btn.addEventListener('click', () => {
      on = !on
      sync()
      this.callbacks.onToggleFocusSegment?.(seg, on)
    })
    return btn
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
        // T363/V258: sama johtofunktio kuin talkoolaisen kenttämuokkauksessa — rajat & jälki
        // liikkuvat yhdessä riippumatta siitä kumpi rooli niitä siirtää.
        const patch = boundsPatch(seg, this.callbacks.getRoutes?.() ?? [], startDist, endDist)
        updateSegment(this.store, seg.id, patch)
        updateSegmentRemote(seg.id, patch).catch(() => {})
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

  // T344/V250 → T355: footer VAIN sulkee, ja käyttää jaettua modal-footer-patternia
  // (DESIGN.md §Modal footer). Aiempi "Tallenna muutokset" kattoi 2/8 osiosta ∴ se lupasi enemmän
  // kuin teki. Kaikki kentät tallentuvat muutoksesta ⇒ `Tallenna` on kielletty tässä modaalissa,
  // ja niin on myös confirm-täytteinen primary joka vain sulkee — se on sama valhe toisella
  // sanalla. ∴ secondary `Sulje` + destructive `Poista pätkä` omalla rivillään.
  private buildCloseFooter(seg: Segment): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'modal-footer segment-details-modal-footer'

    const actions = document.createElement('div')
    actions.className = 'modal-footer-actions'
    const doneBtn = document.createElement('button')
    doneBtn.className = 'modal-btn-secondary btn-segment-modal-close'
    doneBtn.type = 'button'
    doneBtn.textContent = 'Sulje'
    doneBtn.addEventListener('click', () => {
      this.close()
      this.onUpdate()
    })
    actions.appendChild(doneBtn)
    footer.appendChild(actions)

    footer.appendChild(this.buildDangerZone(seg))
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

  // T355: destruktiivinen toiminto elää footerin omalla rivillään pienenä tekstinappina
  // (DESIGN.md §Modal footer) — ⊥ isona danger-blokkina rungossa. V250:n alkuperäinen huoli
  // (footerin ALLE jäävä vaaravyöhyke luetaan toiseksi dialogiksi) ratkeaa tyylillä, ⊥ sijainnilla.
  private buildDangerZone(seg: Segment): HTMLElement {
    const dangerZone = document.createElement('div')
    dangerZone.className = 'modal-footer-destructive segment-modal-danger-zone'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'modal-btn-destructive btn-segment-delete-modal'
    deleteBtn.type = 'button'
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
