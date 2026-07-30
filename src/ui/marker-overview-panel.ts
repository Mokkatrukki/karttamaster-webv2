import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import { createSectionHeader } from './section-header'
import type { SectionHeader } from './section-header'
import { groupMarkersForOverview, subgroupTitle } from '../logic/marker-overview'
import type { OverviewGroup, OverviewGroupKey } from '../logic/marker-overview'
import { buildMarkerFilterContext } from '../logic/map-filter'
import type { MapFilter } from '../logic/map-filter'
import { displayKm } from '../logic/segment-order'
import type { Segment } from '../logic/segments'
import type { MarkerStatus } from '../logic/marker-status'
import type { SignMarker } from '../logic/types'

// T402/V290: järjestäjän merkkijono — "mitkä merkit jäivät asettamatta ja miltä pätkiltä".
//
// Korvaa `#marker-modal`in (marker-list.ts). Sijainti on TELAKKA ⊥ modaali: rivin klikkaus
// liikuttaa karttaa ∴ modaali peittäisi juuri sen mitä toiminto tekee (V114) — se on
// vanhan näkymän käyttämättömyyden syy. Left-panel torjuttiin mitatulla perusteella:
// sen sisältöleveys on 240px & `.marker-item`in 5 elementtiä ⊥ mahdu siihen.
//
// Suodatus tulee `map-filter`istä & jäsenyys `segment-membership`istä (V290) — tämä komponentti
// ⊥ päätä kumpaakaan, se renderöi `groupMarkersForOverview`in tuloksen.
//
// DOM ilman Leafletia → Vitest-jsdom.

const LS_KEY = 'karttamaster-marker-overview-open'

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

export interface MarkerOverviewContext {
  getMarkers(): SignMarker[]
  /** VAIN aktiivisen vaiheen pätkät (V290/V91) — kutsuja rajaa. */
  getSegments(): Segment[]
  getFilter(): MapFilter
  /** Kartta merkkiin. Panorointi kompensoi paneelin leveyden (V290-kutsupaikka, T402). */
  onPanTo(id: string): void
  onOpenDetail(id: string): void
  /** Kartan koko muuttuu kun telakka avautuu/sulkeutuu → `invalidateSize` (T179-oppi). */
  onVisibilityChange?(open: boolean): void
  /** T403: reitittömän tehtävän luonti valituista. Puuttuu → valintaa ⊥ renderöidä. */
  onCreateTask?(markerIds: string[]): void
  /** T403: mihin pätkiin valitut kuuluvat jo (V291 — additiivinen, ⊥ menetys). */
  getExistingOwners?(markerIds: string[]): Array<{ markerId: string; segmentId: string }>
}

export class MarkerOverviewPanel {
  private open = false
  private header: SectionHeader | null = null
  private readonly body: HTMLElement
  /** Ryhmien kiinni-tila. `suodatettu` alkaa KIINNI (V290: se on jäännös ⊥ työjono). */
  private readonly collapsed = new Set<OverviewGroupKey>(['suodatettu'])
  /** T403: valitut merkit. Säilyy renderin yli — kartan päivitys ⊥ saa nollata valintaa. */
  private readonly selected = new Set<string>()

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: MarkerOverviewContext,
  ) {
    this.el.className = 'marker-overview'
    this.body = document.createElement('div')
    this.body.className = 'marker-overview-body'

    // V5-kuvio: työjono johon palataan ⊥ nollaudu sivulatauksessa. Vioittunut arvo → kiinni.
    let stored: string | null = null
    try {
      stored = localStorage.getItem(LS_KEY)
    } catch {
      stored = null
    }
    this.open = stored === '1'
    this.applyOpen(false)

    // Esc sulkee — telakka on iso pinta & näppäimistöllä ! olla ulospääsy.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.open) this.close()
    })
  }

  isOpen(): boolean {
    return this.open
  }

  toggle(): void {
    if (this.open) this.close()
    else this.openPanel()
  }

  openPanel(): void {
    if (this.open) return
    this.open = true
    this.applyOpen(true)
    this.render()
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.applyOpen(true)
  }

  /** Paneelin näkyvä leveys — panorointi kompensoi sen (0 kun kiinni). */
  visibleWidth(): number {
    return this.open ? this.el.offsetWidth : 0
  }

  private applyOpen(notify: boolean): void {
    this.el.hidden = !this.open
    try {
      localStorage.setItem(LS_KEY, this.open ? '1' : '0')
    } catch {
      // Privaattitila / kvootti täynnä — tila elää session ajan, ⊥ kaadu.
    }
    const btn = document.getElementById('btn-list')
    if (btn) btn.setAttribute('aria-expanded', String(this.open))
    if (notify) this.ctx.onVisibilityChange?.(this.open)
  }

  render(): void {
    if (!this.open) return
    const markers = this.ctx.getMarkers()
    const segments = this.ctx.getSegments()
    const filter = this.ctx.getFilter()
    // V293: ctx SAMASTA rakentajasta kuin kartalla ∴ lista & kartta ⊥ voi olla eri mieltä.
    const groups = groupMarkersForOverview({
      markers,
      segments,
      filter,
      ctx: buildMarkerFilterContext(filter, segments, markers),
    })

    // Valinnasta pois kaikki mikä ⊥ enää ole valittavissa (V294): suodattimen taakse mennyt
    // merkki ⊥ saa jäädä näkymättömäksi osaksi valintaa.
    const selectable = new Set(
      groups.filter(g => g.key !== 'suodatettu').flatMap(g => g.subgroups.flatMap(s => s.markers.map(m => m.id))),
    )
    for (const id of [...this.selected]) if (!selectable.has(id)) this.selected.delete(id)

    this.el.innerHTML = ''
    const total = groups.filter(g => g.key !== 'suodatettu').reduce((n, g) => n + g.count, 0)

    this.header = createSectionHeader({
      name: 'Merkit',
      collapsed: false,
      count: `(${total})`,
      onToggle: () => this.close(),
    })
    // Otsikon toggle sulkee koko telakan — ⊥ kaksi eri "kiinni"-tilaa samalle pinnalle.
    this.header.el.classList.add('marker-overview-header')
    this.header.el.setAttribute('aria-label', 'Sulje merkkilista')
    this.el.appendChild(this.header.el)

    this.body.innerHTML = ''
    this.el.appendChild(this.body)

    if (markers.length === 0) {
      this.body.appendChild(this.emptyState('Ei merkkejä'))
      return
    }
    // Onnistuminen ⊥ ole tyhjä lista: kaikki asetettu → se sanotaan ääneen.
    if (!groups.some(g => g.key === 'asettamatta')) {
      this.body.appendChild(this.emptyState('Kaikki merkit asetettu ✓', 'marker-overview-done'))
    }

    for (const g of groups) this.renderGroup(g)
    if (this.ctx.onCreateTask) this.renderActionBar()
  }

  private emptyState(text: string, extraClass?: string): HTMLElement {
    const p = document.createElement('p')
    p.className = 'marker-overview-empty'
    if (extraClass) p.classList.add(extraClass)
    p.textContent = text
    return p
  }

  private renderGroup(g: OverviewGroup): void {
    const wrap = document.createElement('section')
    wrap.className = 'marker-overview-group'
    wrap.dataset.group = g.key

    const isCollapsed = this.collapsed.has(g.key)
    const head = createSectionHeader({
      name: g.title,
      collapsed: isCollapsed,
      count: `(${g.count})`,
      onToggle: () => {
        if (this.collapsed.has(g.key)) this.collapsed.delete(g.key)
        else this.collapsed.add(g.key)
        this.render()
      },
    })
    head.el.classList.add('marker-overview-group-header')
    wrap.appendChild(head.el)

    if (!isCollapsed) {
      for (const sub of g.subgroups) {
        const subhead = document.createElement('p')
        subhead.className = 'marker-overview-subhead'
        subhead.textContent = `${subgroupTitle(sub)} (${sub.markers.length})`
        wrap.appendChild(subhead)

        const list = document.createElement('ul')
        list.className = 'marker-overview-list'
        for (const m of sub.markers) list.appendChild(this.renderRow(m, sub.segment, g.key))
        wrap.appendChild(list)
      }
    }
    this.body.appendChild(wrap)
  }

  private renderRow(m: SignMarker, segment: Segment | null, groupKey: OverviewGroupKey): HTMLElement {
    const li = document.createElement('li')
    li.className = 'marker-item marker-overview-item'
    li.dataset.id = m.id

    // V294: suodattimen ulkopuolinen rivi ⊥ ole valittavissa — bulk ⊥ saa koskea riviin jota
    // käyttäjä ⊥ näe kartalla. Vanha lista teki saman (marker-list.ts:34,283).
    const selectable = groupKey !== 'suodatettu' && this.ctx.onCreateTask !== undefined
    if (selectable) {
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.className = 'marker-item-checkbox'
      cb.checked = this.selected.has(m.id)
      cb.setAttribute('aria-label', `Valitse ${markerLabel(m)}`)
      cb.addEventListener('change', () => {
        if (cb.checked) this.selected.add(m.id)
        else this.selected.delete(m.id)
        this.refreshActionBar()
      })
      li.appendChild(cb)
    }

    const main = document.createElement('button')
    main.type = 'button'
    main.className = 'marker-overview-row'
    main.addEventListener('click', () => this.ctx.onPanTo(m.id))

    const icon = document.createElement('span')
    icon.className = 'marker-icon'
    icon.appendChild(buildMarkerVisual(
      { type: m.type, iconId: m.iconId, label: m.label, parts: m.parts, color: m.color },
      { size: 28, zoomable: false },
    ))
    main.appendChild(icon)

    const label = document.createElement('span')
    label.className = 'marker-type-label'
    label.textContent = markerLabel(m)
    main.appendChild(label)

    const km = document.createElement('span')
    km.className = 'marker-km'
    // V237: km PÄTKÄN akselilta — sama luku kuin pätkänäkymä näyttää samasta merkistä (B129).
    km.textContent = `${(displayKm(m, segment) / 1000).toFixed(1)} km`
    main.appendChild(km)

    const status = document.createElement('span')
    status.className = `marker-status marker-status--${m.status}`
    status.textContent = STATUS_LABELS[m.status] ?? m.status
    main.appendChild(status)

    li.appendChild(main)

    // V62: ⊥ inline-poistoa rivillä — ··· avaa modaalin jossa tuhoavat teot ovat.
    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'marker-overview-menu'
    menu.textContent = '···'
    menu.setAttribute('aria-label', `${markerLabel(m)} — lisätiedot`)
    menu.addEventListener('click', () => this.ctx.onOpenDetail(m.id))
    li.appendChild(menu)

    return li
  }

  // ── T403: valinta → reititön tehtävä ────────────────────────────────────────────────────

  private renderActionBar(): void {
    const bar = document.createElement('div')
    bar.className = 'marker-overview-actionbar'

    // V291: operaatio on ADDITIIVINEN ∴ tämä on INFORMAATIO ⊥ varoitus.
    const note = document.createElement('p')
    note.className = 'marker-overview-note'
    note.hidden = true
    bar.appendChild(note)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'btn btn--confirm marker-overview-create'
    btn.addEventListener('click', () => {
      if (this.selected.size === 0) return
      this.ctx.onCreateTask?.([...this.selected])
      this.selected.clear()
      this.render()
    })
    bar.appendChild(btn)

    // Sticky-palkki on scroll-sisällön VIIMEINEN lapsi (T311/V223) ∴ se ⊥ peitä viimeistä
    // riviä eikä jätä orpoa gappia (B101). `position:fixed` on kielletty tässä kuviossa.
    this.body.appendChild(bar)
    this.refreshActionBar()
  }

  private refreshActionBar(): void {
    const btn = this.body.querySelector<HTMLButtonElement>('.marker-overview-create')
    const note = this.body.querySelector<HTMLElement>('.marker-overview-note')
    if (!btn) return
    const n = this.selected.size
    btn.textContent = `Luo tehtävä valituista (${n})`
    // V250: disabloitu tila ! näkyä — jaetut `.btn--*` ⊥ määrittele `:disabled`ia ∴ ilman
    // omaa luokkaa nappi näyttäisi painettavalta & klikkaus ⊥ tekisi mitään (kuollut pinta).
    btn.disabled = n === 0
    btn.classList.toggle('is-disabled', n === 0)

    if (!note) return
    const owners = n > 0 ? this.ctx.getExistingOwners?.([...this.selected]) ?? [] : []
    if (owners.length === 0) {
      note.hidden = true
      note.textContent = ''
      return
    }
    const segNames = [...new Set(owners.map(o => o.segmentId))].map(id => {
      const seg = this.ctx.getSegments().find(s => s.id === id)
      return seg?.displayName?.trim() || id
    })
    const markerCount = new Set(owners.map(o => o.markerId)).size
    note.hidden = false
    note.textContent = `${markerCount} merkkiä kuuluu myös pätkiin: ${segNames.join(', ')} — ne säilyvät niissä.`
  }
}
