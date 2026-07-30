import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import { isTerminal, type MarkerStatus } from '../logic/marker-status'
import { displayKm, orderMarkersInSegment } from '../logic/segment-order'
import type { Segment } from '../logic/segments'
import type { SignMarker } from '../logic/types'

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

// T263/V183 (talkoolais-KOTI, R3): KOTI-pätkänäkymän INLINE "Kaikki merkit" -lista.
// Brief Näkymä 1: oman pätkän merkit näkyvät koti-landingissa (koti = ei karttaa → tilaa on;
// T228 poisti inline-listan koska se söi KARTAN tilaa — koti-moodissa peruste ei päde).
// Rivi-klikkaus → onOpenDetail (jaettu yläpalkin modaalin MarkerDetailModalin kanssa, EI uusi
// mutaatiopolku). Erotettu SegmentView:stä (562r pilkkohälytys). Kartta-moodissa CSS piilottaa.
export interface SegmentMarkerListContext {
  getMarkers(): SignMarker[]
  // T328/V237: lista järjestää PÄTKÄN km-akselilla ∴ se tarvitsee pätkän, ei pelkkiä merkkejä.
  getSegment(): Segment | null
  onOpenDetail(id: string): void
  // T409/V292 (VISION §Kenttätyö): valikoiva bulk-kuittaus. Talkoolainen menetti sen T264:ssä
  // kun `#btn-list` piilotettiin & `.bulk-action-bar` jäi kuolleeksi koodiksi poistuneeseen
  // `marker-list.ts`:ään. Mutaatio kulkee OLEMASSA OLEVAA `manager.bulkSetStatus`-reittiä
  // (sama kuin järjestäjän paneelilla) ∴ ⊥ uutta mutaatiopolkua. Valinnainen: ilman kytkentää
  // lista on sama luettava lista kuin ennen (checkboxit ⊥ renderöidy lainkaan).
  onBulkStatus?(ids: string[], status: MarkerStatus): void
}

export class SegmentMarkerList {
  // T409: valinta elää re-renderin yli (`update()` kutsuu `render()`n jokaisesta mutaatiosta) —
  // muuten yksi ulkopuolinen päivitys pyyhkisi talkoolaisen kesken tekemän valinnan.
  private readonly selected = new Set<string>()

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentMarkerListContext,
  ) {}

  render(): void {
    // T328/V237/V238: järjestys pätkän km-akselilta (purku-phasessa käänteinen), EI merkin
    // skalaarista joka voi olla mitattu toiselta reitiltä (B129). "Ei reitillä" -merkit
    // (segmentKm null) omaan ryhmäänsä listan alkuun — ne eivät katoa eivätkä sekoita järjestystä.
    const segment = this.ctx.getSegment()
    const { onRoute, offRoute } = orderMarkersInSegment(this.ctx.getMarkers(), segment)
    const markers = [...onRoute, ...offRoute]
    this.el.innerHTML = ''

    // T409: valinta ⊥ saa jäädä osoittamaan riviin jota ⊥ enää ole (merkki poistui pätkältä)
    // tai joka ehti terminaaliin (kerätty) — muuten "Aseta valituille (3)" mutatoisi merkkejä
    // joita käyttäjä ⊥ näe. Karsinta joka renderissä pitää laskurin & mutaation samassa joukossa.
    const selectableIds = new Set(markers.filter(m => this.isSelectable(m)).map(m => m.id))
    for (const id of this.selected) if (!selectableIds.has(id)) this.selected.delete(id)

    const header = document.createElement('div')
    header.className = 'segment-view-markers-header'
    header.textContent = `Kaikki merkit (${markers.length})`
    this.el.appendChild(header)

    if (markers.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'segment-view-markers-empty'
      empty.textContent = 'Ei merkkejä tällä pätkällä.'
      this.el.appendChild(empty)
      return
    }

    // V238: "ei reitillä" ENSIN — merkki joka ei osu pätkän km-välille ei katoa hiljaa eikä
    // saa väärää paikkaa järjestyksessä (hiljainen katoaminen olisi B127:n uusi versio).
    this.renderGroup('Ei reitillä', offRoute, segment)

    // T264/V184: ryhmittele asettamatta (suunniteltu) / asetetut (asetettu·tarkistettu·kerätty) /
    // ei tarpeen. Tyhjät ryhmät jätetään pois; talkoolainen näkee heti mitä on vielä laittamatta.
    // Ryhmien sisäinen järjestys periytyy `onRoute`sta = kulkusuunta (V237/V238).
    const unplaced = onRoute.filter(m => m.status === 'suunniteltu')
    const placed = onRoute.filter(m => m.status === 'asetettu' || m.status === 'tarkistettu' || m.status === 'kerätty')
    const skipped = onRoute.filter(m => m.status === 'ei_tarpeen')

    this.renderGroup('Asettamatta', unplaced, segment)
    this.renderGroup('Asetetut', placed, segment)
    this.renderGroup('Ei tarpeen', skipped, segment)

    // T409: bar vain jos valittavaa on — muuten se olisi pysyvästi disabloitu pinta joka vie
    // 44px pystytilaa puhelimessa ilman että sillä on koskaan tekemistä.
    if (this.ctx.onBulkStatus && selectableIds.size > 0) this.renderActionBar(selectableIds)
  }

  // T409: terminaali merkki (kerätty, `isTerminal`) ⊥ saa checkboxia — sille ⊥ ole siirtymää
  // & valittavissa oleva rivi jota bulk ⊥ voi muuttaa on lupaus jota UI ⊥ pidä.
  private isSelectable(m: SignMarker): boolean {
    return this.ctx.onBulkStatus !== undefined && !isTerminal(m.status)
  }

  private renderActionBar(selectableIds: Set<string>): void {
    const bar = document.createElement('div')
    bar.className = 'bulk-action-bar'

    // DESIGN §K: `label { width:100% }` pakottaa "Valitse kaikki" omalle riville ∴ napit
    // saavat 340px-leveydellä oman rivinsä (flex-wrap) eivätkä leikkaudu (B108-oppi).
    const allLabel = document.createElement('label')
    const all = document.createElement('input')
    all.type = 'checkbox'
    all.className = 'bulk-select-all'
    all.checked = this.selected.size === selectableIds.size
    all.addEventListener('change', () => {
      if (all.checked) for (const id of selectableIds) this.selected.add(id)
      else this.selected.clear()
      this.render()
    })
    allLabel.append(all, document.createTextNode(' Valitse kaikki'))
    bar.appendChild(allLabel)

    const n = this.selected.size
    bar.appendChild(this.bulkButton('btn-bulk-checkin-aseta', `✓ Aseta valituille (${n})`, 'asetettu', n))
    bar.appendChild(this.bulkButton('btn-bulk-checkin-ohita', `Ei tarpeen (${n})`, 'ei_tarpeen', n))

    this.el.appendChild(bar)
  }

  private bulkButton(cls: string, text: string, status: MarkerStatus, n: number): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = cls
    btn.textContent = text
    // 0 valittua → disabloitu (DESIGN §K `field-tint`). Klikki ilman valintaa olisi hiljainen
    // no-op — hanskat kädessä se lukeutuu rikkinäiseksi napiksi.
    btn.disabled = n === 0
    btn.addEventListener('click', () => {
      if (this.selected.size === 0) return
      this.ctx.onBulkStatus?.([...this.selected], status)
      this.selected.clear()
      this.render()
    })
    return btn
  }

  private renderGroup(title: string, markers: SignMarker[], segment: Segment | null): void {
    if (markers.length === 0) return

    const groupTitle = document.createElement('p')
    groupTitle.className = 'segment-view-markers-group'
    groupTitle.textContent = `${title} (${markers.length})`
    this.el.appendChild(groupTitle)

    const list = document.createElement('ul')
    list.className = 'segment-view-markers-list'
    for (const m of markers) {
      const li = document.createElement('li')
      li.className = 'segment-view-markers-item'
      li.dataset.id = m.id

      // T409: checkbox ENNEN riviä. Oma elementti ⊥ rivin sisällä — rivi on `<button>` &
      // sisäkkäinen interaktiivinen kontrolli ⊥ ole validia HTML:ää (klikki menisi väärään).
      if (this.isSelectable(m)) {
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.className = 'marker-item-checkbox'
        cb.checked = this.selected.has(m.id)
        cb.setAttribute('aria-label', `Valitse ${markerLabel(m)}`)
        cb.addEventListener('change', () => {
          if (cb.checked) this.selected.add(m.id)
          else this.selected.delete(m.id)
          this.render()
        })
        li.appendChild(cb)
      } else if (this.ctx.onBulkStatus) {
        // Valintatilassa checkboxiton rivi tasataan muiden kanssa — muuten terminaali merkki
        // hyppää 44px vasemmalle & lista näyttää rikkinäiseltä, ⊥ "tämä on valmis".
        li.classList.add('segment-view-markers-item--nocheck')
      }

      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'segment-view-markers-row'
      row.addEventListener('click', () => this.ctx.onOpenDetail(m.id))

      row.appendChild(buildMarkerVisual(
        { type: m.type, iconId: m.iconId, label: m.label, parts: m.parts, color: m.color },
        { size: 36, zoomable: false },
      ))

      const info = document.createElement('span')
      info.className = 'segment-view-markers-info'
      const name = document.createElement('span')
      name.className = 'segment-view-markers-name'
      name.textContent = markerLabel(m)
      info.appendChild(name)
      const meta = document.createElement('span')
      meta.className = 'segment-view-markers-meta'
      // T328/V237: km pätkän akselilta — sama luku kuin hero näyttää samasta merkistä (B129).
      meta.textContent = `${STATUS_LABELS[m.status] ?? m.status} · ${(displayKm(m, segment) / 1000).toFixed(1)} km`
      info.appendChild(meta)
      row.appendChild(info)

      li.appendChild(row)
      list.appendChild(li)
    }
    this.el.appendChild(list)
  }
}
