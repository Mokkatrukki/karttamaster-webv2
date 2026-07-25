import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import type { MarkerStatus } from '../logic/marker-status'
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
}

export class SegmentMarkerList {
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
