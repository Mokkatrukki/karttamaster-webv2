import type { MapFilter, DimLevel } from '../logic/map-filter'
import {
  ALL_MARKER_STATUSES, ALL_SEGMENT_STATES, activeFilterCount, defaultMapFilter,
  loadMapFilter, saveMapFilter, toggleFilterValue,
} from '../logic/map-filter'
import type { MarkerStatus } from '../logic/types'
import type { SegmentLineState } from '../logic/segments'
import { routeSwatchBackground } from '../logic/route-swatch'

// T377/V272: suodatinbar — kartan "mitä näkyy" -kontrollit YHDESSÄ paikassa, headerin & kartan
// välissä. PM-päätös 2026-07-28: bar ⊥ nappi-paneeli — suodatin on aina näkyvissä, koska
// suodatettu kartta jonka syytä ⊥ näy luetaan kadonneena datana (B131-luokka). Tila persistoituu
// ∴ aktiivilaskuri + banneri ovat pakollisia, ⊥ koristeita.
//
// Puhdas DOM, ⊥ Leafletia ∴ Vitest-jsdom. Kartan soveltaminen tapahtuu wiringissä: tämä
// komponentti PÄÄTTÄÄ tilan & huutaa `onChange`, ⊥ kosketa karttaan (V271).

export interface FilterRouteRef {
  id: string
  label: string
  color: string
  dashArray?: string
  event?: string
}

export interface FilterSegmentRef {
  id: string
  displayName?: string
}

export interface MapFilterBarDeps {
  routes: FilterRouteRef[]
  /** Isoloitava pätkä valitaan kartalta/modaalista — bar näyttää TILAN & nollauksen (V272). */
  getSegmentName: (id: string) => string | undefined
  onChange: (filter: MapFilter) => void
  /** Isoloinnin nollaus barista ! sammuttaa myös sen laukaisseen korostuksen — muuten tila
   *  jäisi kahteen paikkaan eri mieltä (B131-luokka: käyttäjä ⊥ pääse ulos). */
  onIsolationClear?: () => void
  /** T379: talkoolaisen kapea versio — yksi valinta, ⊥ neljää dropdownia. */
  narrow?: boolean
}

const STATUS_LABEL: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

const SEGMENT_STATE_LABEL: Record<SegmentLineState, string> = {
  ei_alkanut: 'Ei aloitettu',
  kesken: 'Kesken',
  valmis: 'Valmis',
}

const DIM_LABEL: Record<DimLevel, string> = {
  kevyt: 'Kevyt himmennys',
  vahva: 'Vahva himmennys',
  piilota: 'Piilota kokonaan',
}

export class MapFilterBar {
  private filter: MapFilter
  private openId: string | null = null
  private readonly dropdowns = new Map<string, { trigger: HTMLButtonElement; panel: HTMLElement }>()
  private banner!: HTMLElement
  private resetBtn!: HTMLButtonElement
  // B160: mobiilin oma valikko — yksi trigger avaa kaikki osiot sheettinä.
  private sheetTrigger?: HTMLButtonElement
  private groups?: HTMLElement
  private sheetOpen = false
  private readonly onDocClick = (e: MouseEvent) => {
    if (this.container.contains(e.target as Node)) return
    if (this.openId) this.setOpen(null)
    if (this.sheetOpen) this.setSheetOpen(false)
  }

  constructor(
    private readonly container: HTMLElement,
    private readonly deps: MapFilterBarDeps,
  ) {
    this.filter = loadMapFilter()
    this.build()
    this.sync()
    document.addEventListener('click', this.onDocClick)
    // Persistoitu tila ! päätyä kartalle heti — muuten bar väittää suodattavansa & kartta ⊥ suodata.
    this.deps.onChange(this.filter)
  }

  getFilter(): MapFilter {
    return this.filter
  }

  /** Isolointi tulee ULKOA (kartan pätkäklikki / modaalin kytkin) — bar ⊥ ole toinen laukaisin. */
  setIsolatedSegment(segmentId: string | undefined): void {
    this.filter = { ...this.filter, isolatedSegmentId: segmentId }
    this.commit()
  }

  /** Reittinäkyvyys voi muuttua myös muualta (talkoolaisen RouteBar) → pidä bar totuudessa. */
  setVisibleRoutes(ids: string[] | undefined): void {
    this.filter = { ...this.filter, visibleRouteIds: ids }
    this.commit()
  }

  reset(): void {
    const hadIsolation = this.filter.isolatedSegmentId !== undefined
    this.filter = defaultMapFilter()
    this.commit()
    if (hadIsolation) this.deps.onIsolationClear?.()
  }

  destroy(): void {
    document.removeEventListener('click', this.onDocClick)
    this.container.replaceChildren()
  }

  private commit(): void {
    saveMapFilter(this.filter)
    this.sync()
    this.deps.onChange(this.filter)
  }

  // B160: sheetin tila elää LUOKASSA ⊥ CSS-mediakyselyssä yksin — sama komponentti toimii
  // kummassakin leveydessä & desktopilla luokka on merkityksetön (CSS ⊥ lue sitä).
  private setSheetOpen(open: boolean): void {
    this.sheetOpen = open
    this.container.classList.toggle('map-filter-bar--sheet-open', open)
    this.sheetTrigger?.setAttribute('aria-expanded', String(open))
    if (!open) this.setOpen(null)
  }

  private setOpen(id: string | null): void {
    this.openId = id
    for (const [key, dd] of this.dropdowns) {
      const open = key === id
      dd.panel.hidden = !open
      dd.trigger.setAttribute('aria-expanded', String(open))
      dd.trigger.classList.toggle('open', open)
    }
  }

  // V137/B92: idempotentti render — re-init (logout→login) ⊥ jätä tuplakontrolleja.
  private build(): void {
    this.container.replaceChildren()
    this.container.classList.add('map-filter-bar')
    // T379: kapea versio ⊥ ota mobiilin bottom sheetiä — talkoolaisen hero omistaa ruudun
    // alalaidan (`#segment-view-container` kartta-moodissa) ∴ sheet jäisi sen alle.
    this.container.classList.toggle('map-filter-bar--narrow', !!this.deps.narrow)
    this.dropdowns.clear()

    if (this.deps.narrow) {
      // T379: talkoolaiselle YKSI valinta. Yläpalkkiin ⊥ kosketa (V155 lukitsee 3 nappia).
      this.container.appendChild(this.buildNarrowToggle())
    } else {
      // B160: mobiilissa neljä dropdownia ⊥ mahdu riviin (mitattu 375px: "Himmennys" alkoi
      // x=379 = ruudun ULKOPUOLELLA & vaakaskrollille ⊥ ollut vihjettä ∴ nappia ⊥ ollut
      // olemassa käyttäjälle). Mobiilissa bar kutistuu YHDEKSI "Suodata (N)" -napiksi joka
      // avaa kaikki neljä osiota bottom sheetinä (käyttäjäpäätös 2026-07-28: "jos on mobiili
      // siitä tehdään joku oma valikko"). Sama DOM molemmissa — ⊥ kloonata tilaa kahteen paikkaan.
      this.sheetTrigger = document.createElement('button')
      this.sheetTrigger.type = 'button'
      this.sheetTrigger.className = 'map-filter-sheet-trigger'
      this.sheetTrigger.setAttribute('aria-expanded', 'false')
      this.sheetTrigger.innerHTML = '<span class="map-filter-sheet-label">Suodata</span><span class="map-filter-sheet-count"></span>'
      this.sheetTrigger.addEventListener('click', e => { e.stopPropagation(); this.setSheetOpen(!this.sheetOpen) })
      this.container.appendChild(this.sheetTrigger)

      this.groups = document.createElement('div')
      this.groups.className = 'map-filter-groups'
      this.groups.append(
        this.buildRouteDropdown(),
        this.buildSegmentDropdown(),
        this.buildMarkerDropdown(),
        this.buildDimDropdown(),
      )
      // Sheetin sulkeva "Valmis" — mobiilissa taustaklikki on kartalla & se ⊥ saa olla ainoa
      // ulospääsy (osuisi karttaan ∴ tekisi jotain muuta).
      const done = document.createElement('button')
      done.type = 'button'
      done.className = 'map-filter-sheet-done'
      done.textContent = 'Valmis'
      done.addEventListener('click', e => { e.stopPropagation(); this.setSheetOpen(false) })
      this.groups.appendChild(done)
      this.container.appendChild(this.groups)
    }

    this.resetBtn = document.createElement('button')
    this.resetBtn.type = 'button'
    this.resetBtn.className = 'map-filter-reset'
    this.resetBtn.textContent = '✕ Nollaa'
    this.resetBtn.title = 'Nollaa suodattimet'
    this.resetBtn.addEventListener('click', () => this.reset())
    this.container.appendChild(this.resetBtn)

    this.banner = document.createElement('div')
    this.banner.className = 'map-filter-banner'
    this.banner.setAttribute('role', 'status')
    this.container.appendChild(this.banner)
  }

  private buildDropdown(id: string, label: string): { wrap: HTMLElement; panel: HTMLElement; trigger: HTMLButtonElement } {
    const wrap = document.createElement('div')
    wrap.className = 'map-filter-dropdown'
    wrap.dataset.filter = id

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'map-filter-trigger'
    trigger.setAttribute('aria-expanded', 'false')
    trigger.innerHTML = `<span class="map-filter-trigger-label">${label}</span><span class="map-filter-trigger-value"></span><span class="map-filter-caret">▾</span>`
    trigger.addEventListener('click', e => {
      e.stopPropagation()
      this.setOpen(this.openId === id ? null : id)
    })

    const panel = document.createElement('div')
    panel.className = 'map-filter-panel'
    panel.hidden = true

    wrap.append(trigger, panel)
    this.dropdowns.set(id, { trigger, panel })
    return { wrap, panel, trigger }
  }

  private row(label: string, checked: boolean, onClick: () => void, swatch?: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'map-filter-row'
    btn.setAttribute('aria-pressed', String(checked))
    btn.innerHTML =
      `<span class="map-filter-check">${checked ? '✓' : ''}</span>` +
      (swatch ? `<span class="map-filter-swatch" style="background:${swatch}"></span>` : '') +
      `<span class="map-filter-row-label"></span>`
    btn.querySelector('.map-filter-row-label')!.textContent = label
    btn.addEventListener('click', e => { e.stopPropagation(); onClick() })
    return btn
  }

  private buildRouteDropdown(): HTMLElement {
    const { wrap, panel } = this.buildDropdown('routes', 'Reitit')
    const visible = (): string[] => this.filter.visibleRouteIds ?? this.deps.routes.map(r => r.id)

    let lastEvent: string | undefined
    for (const r of this.deps.routes) {
      if (r.event && r.event !== lastEvent) {
        const head = document.createElement('div')
        head.className = 'map-filter-group-label'
        head.textContent = r.event
        panel.appendChild(head)
        lastEvent = r.event
      }
      const rowWrap = document.createElement('div')
      rowWrap.className = 'map-filter-route-row'
      rowWrap.dataset.routeId = r.id

      const toggle = this.row(r.label, true, () => {
        const cur = visible()
        // V6: viimeistä näkyvää reittiä ⊥ voi piilottaa.
        const next = cur.includes(r.id)
          ? (cur.length <= 1 ? cur : cur.filter(id => id !== r.id))
          : [...cur, r.id]
        this.filter = { ...this.filter, visibleRouteIds: next }
        this.commit()
      }, routeSwatchBackground(r.color, r.dashArray))
      toggle.classList.add('map-filter-route-toggle')

      // "Vain tämä" -oikotie: yhden reitin katsominen on yleisin tarve & muuten se vaatii
      // N−1 klikkiä (järjestäjän 6 reittiä ⇒ 5 klikkiä).
      const only = document.createElement('button')
      only.type = 'button'
      only.className = 'map-filter-only'
      only.textContent = 'vain tämä'
      only.addEventListener('click', e => {
        e.stopPropagation()
        this.filter = { ...this.filter, visibleRouteIds: [r.id] }
        this.commit()
      })

      rowWrap.append(toggle, only)
      panel.appendChild(rowWrap)
    }
    return wrap
  }

  private buildSegmentDropdown(): HTMLElement {
    const { wrap, panel } = this.buildDropdown('segments', 'Pätkät')

    // Isolointi = TILA + nollaus, ⊥ toinen laukaisin (PM-päätös: valinta tehdään kartalta).
    const isoRow = document.createElement('div')
    isoRow.className = 'map-filter-isolation'
    panel.appendChild(isoRow)

    const head = document.createElement('div')
    head.className = 'map-filter-group-label'
    head.textContent = 'Näytä tilat'
    panel.appendChild(head)

    for (const st of ALL_SEGMENT_STATES) {
      panel.appendChild(this.row(SEGMENT_STATE_LABEL[st], true, () => {
        this.filter = { ...this.filter, segmentStates: toggleFilterValue(this.filter.segmentStates, st) }
        this.commit()
      }))
    }
    return wrap
  }

  private buildMarkerDropdown(): HTMLElement {
    const { wrap, panel } = this.buildDropdown('markers', 'Merkit')
    for (const st of ALL_MARKER_STATUSES) {
      const row = this.row(STATUS_LABEL[st], true, () => {
        this.filter = { ...this.filter, markerStatuses: toggleFilterValue(this.filter.markerStatuses, st) }
        this.commit()
      })
      // §C `--status-*`-tokenit ∴ legenda vastaa karttaa (V216).
      row.dataset.status = st
      row.querySelector('.map-filter-check')!.classList.add('map-filter-check--status')
      panel.appendChild(row)
    }
    // T391/V283/B165: orpotyöjono samaan akseliin kuin muu merkkirajaus — jäsenyyskynnys
    // tuottaa orpoja & tämä on se ulospääsy jonka kynnys vaatii ("tänne ⊥ ole vielä pätkää").
    const orphanRow = this.row('Vain ilman pätkää', true, () => {
      this.filter = { ...this.filter, onlyOrphans: !this.filter.onlyOrphans }
      this.commit()
    })
    orphanRow.dataset.filterRow = 'orphans'
    panel.appendChild(orphanRow)
    return wrap
  }

  private buildDimDropdown(): HTMLElement {
    const { wrap, panel } = this.buildDropdown('dim', 'Himmennys')
    for (const level of ['kevyt', 'vahva', 'piilota'] as DimLevel[]) {
      panel.appendChild(this.row(DIM_LABEL[level], false, () => {
        this.filter = { ...this.filter, dimLevel: level }
        this.commit()
      }))
    }
    return wrap
  }

  private buildNarrowToggle(): HTMLElement {
    const { wrap, panel } = this.buildDropdown('narrow', 'Näytä')
    const OPTIONS: Array<{ key: 'kaikki' | 'asettamattomat'; label: string }> = [
      { key: 'kaikki', label: 'Kaikki merkit' },
      { key: 'asettamattomat', label: 'Vain asettamattomat' },
    ]
    for (const opt of OPTIONS) {
      panel.appendChild(this.row(opt.label, false, () => {
        // T379: sama predikaatti kuin järjestäjällä, esiasetuksena — ⊥ omaa suodatinlogiikkaa.
        this.filter = {
          ...this.filter,
          markerStatuses: opt.key === 'kaikki'
            ? new Set(ALL_MARKER_STATUSES)
            : new Set<MarkerStatus>(['suunniteltu']),
        }
        this.commit()
      }))
    }
    return wrap
  }

  private sync(): void {
    const f = this.filter
    const count = activeFilterCount(f)

    // Reittirivit
    const visible = f.visibleRouteIds ?? this.deps.routes.map(r => r.id)
    const onlyOne = visible.length <= 1
    for (const r of this.deps.routes) {
      const rowWrap = this.container.querySelector(`.map-filter-route-row[data-route-id="${r.id}"]`)
      const btn = rowWrap?.querySelector('.map-filter-route-toggle') as HTMLButtonElement | null
      if (!btn) continue
      const on = visible.includes(r.id)
      btn.setAttribute('aria-pressed', String(on))
      btn.querySelector('.map-filter-check')!.textContent = on ? '✓' : ''
      btn.disabled = on && onlyOne
      btn.title = on ? (btn.disabled ? 'Viimeistä reittiä ei voi piilottaa' : 'Piilota reitti') : 'Näytä reitti'
    }
    this.setTriggerValue('routes', visible.length === this.deps.routes.length ? 'kaikki' : `${visible.length}/${this.deps.routes.length}`)

    // Pätkätilat + isolointi
    this.syncPressed('segments', ALL_SEGMENT_STATES, st => f.segmentStates.has(st), SEGMENT_STATE_LABEL)
    const iso = this.container.querySelector('.map-filter-isolation') as HTMLElement | null
    if (iso) {
      iso.replaceChildren()
      if (f.isolatedSegmentId) {
        const name = this.deps.getSegmentName(f.isolatedSegmentId) ?? 'pätkä'
        const label = document.createElement('span')
        label.className = 'map-filter-isolation-label'
        label.textContent = `Vain: ${name}`
        const clear = document.createElement('button')
        clear.type = 'button'
        clear.className = 'map-filter-isolation-clear'
        clear.textContent = '✕'
        clear.setAttribute('aria-label', 'Näytä kaikki pätkät')
        clear.addEventListener('click', e => {
          e.stopPropagation()
          this.setIsolatedSegment(undefined)
          this.deps.onIsolationClear?.()
        })
        iso.append(label, clear)
      } else {
        const hint = document.createElement('span')
        hint.className = 'map-filter-isolation-hint'
        hint.textContent = 'Eristä pätkä kartalta tai pätkän modaalista'
        iso.appendChild(hint)
      }
    }
    const segValue = f.isolatedSegmentId
      ? 'vain 1'
      : (f.segmentStates.size === ALL_SEGMENT_STATES.length ? 'kaikki' : `${f.segmentStates.size}/${ALL_SEGMENT_STATES.length}`)
    this.setTriggerValue('segments', segValue)

    // Merkkistatukset
    this.syncPressed('markers', ALL_MARKER_STATUSES, st => f.markerStatuses.has(st), STATUS_LABEL)
    // T391/V283: orpovalinta on OMA akselinsa statusten rinnalla ∴ se ⊥ mahdu `syncPressed`in
    // status-silmukkaan (eri arvoavaruus). Trigger-arvo kertoo sen erikseen — muuten päällä
    // oleva rajaus jäisi näkymättömäksi suljetun valikon taakse (V272).
    const orphanRow = this.dropdowns.get('markers')?.panel
      .querySelector<HTMLButtonElement>('[data-filter-row="orphans"]')
    if (orphanRow) {
      orphanRow.setAttribute('aria-pressed', String(f.onlyOrphans))
      orphanRow.querySelector('.map-filter-check')!.textContent = f.onlyOrphans ? '✓' : ''
    }
    const statusValue = f.markerStatuses.size === ALL_MARKER_STATUSES.length
      ? 'kaikki'
      : `${f.markerStatuses.size}/${ALL_MARKER_STATUSES.length}`
    this.setTriggerValue('markers', f.onlyOrphans ? 'ilman pätkää' : statusValue)

    // Himmennysporras (yksinvalinta)
    this.syncPressed('dim', ['kevyt', 'vahva', 'piilota'] as DimLevel[], lvl => f.dimLevel === lvl, DIM_LABEL)
    this.setTriggerValue('dim', DIM_LABEL[f.dimLevel].toLowerCase())

    // Talkoolaisen kapea valinta (T379)
    const narrowPanel = this.dropdowns.get('narrow')?.panel
    if (narrowPanel) {
      const onlyPlanned = f.markerStatuses.size === 1 && f.markerStatuses.has('suunniteltu')
      const rows = narrowPanel.querySelectorAll('.map-filter-row')
      rows[0]?.setAttribute('aria-pressed', String(!onlyPlanned))
      rows[1]?.setAttribute('aria-pressed', String(onlyPlanned))
      rows.forEach((r, i) => { r.querySelector('.map-filter-check')!.textContent = (i === 0 ? !onlyPlanned : onlyPlanned) ? '✓' : '' })
      this.setTriggerValue('narrow', onlyPlanned ? 'vain asettamattomat' : 'kaikki merkit')
    }

    // V272: aktiivilaskuri + banneri + nollaus. Suodatettu kartta ! kertoa olevansa suodatettu.
    this.container.dataset.activeFilters = String(count)
    // B160: mobiilin yksi nappi kantaa saman laskurin — muuten sheetin takana suodattava tila
    // olisi näkymätön juuri siinä leveydessä jossa bannerillekaan ⊥ ole tilaa.
    if (this.sheetTrigger) {
      this.sheetTrigger.querySelector('.map-filter-sheet-count')!.textContent = count === 0 ? '' : `(${count})`
      this.sheetTrigger.classList.toggle('has-filters', count > 0)
    }
    this.resetBtn.hidden = count === 0
    this.banner.hidden = count === 0
    this.banner.textContent = count === 0
      ? ''
      : `Suodatin päällä (${count}) — kartalla ei näy kaikkea`
  }

  private setTriggerValue(id: string, value: string): void {
    const el = this.dropdowns.get(id)?.trigger.querySelector('.map-filter-trigger-value')
    if (el) el.textContent = value
  }

  private syncPressed<T extends string>(
    dropdownId: string,
    values: readonly T[],
    isOn: (v: T) => boolean,
    labels: Record<T, string>,
  ): void {
    const panel = this.dropdowns.get(dropdownId)?.panel
    if (!panel) return
    const rows = Array.from(panel.querySelectorAll<HTMLButtonElement>('.map-filter-row'))
      .filter(r => !r.classList.contains('map-filter-route-toggle'))
    for (const v of values) {
      const row = rows.find(r => r.querySelector('.map-filter-row-label')?.textContent === labels[v])
      if (!row) continue
      const on = isOn(v)
      row.setAttribute('aria-pressed', String(on))
      row.querySelector('.map-filter-check')!.textContent = on ? '✓' : ''
    }
  }
}
