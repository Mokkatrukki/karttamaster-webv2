import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import type { MarkerStatus } from '../logic/marker-status'
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
  onOpenDetail(id: string): void
}

export class SegmentMarkerList {
  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentMarkerListContext,
  ) {}

  render(): void {
    const markers = [...this.ctx.getMarkers()].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
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

    // T264/V184: ryhmittele asettamatta (suunniteltu) / asetetut (asetettu·tarkistettu·kerätty) /
    // ei tarpeen. Tyhjät ryhmät jätetään pois; talkoolainen näkee heti mitä on vielä laittamatta.
    const unplaced = markers.filter(m => m.status === 'suunniteltu')
    const placed = markers.filter(m => m.status === 'asetettu' || m.status === 'tarkistettu' || m.status === 'kerätty')
    const skipped = markers.filter(m => m.status === 'ei_tarpeen')

    this.renderGroup('Asettamatta', unplaced)
    this.renderGroup('Asetetut', placed)
    this.renderGroup('Ei tarpeen', skipped)
  }

  private renderGroup(title: string, markers: SignMarker[]): void {
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
      meta.textContent = `${STATUS_LABELS[m.status] ?? m.status} · ${(m.distanceFromStart / 1000).toFixed(1)} km`
      info.appendChild(meta)
      row.appendChild(info)

      li.appendChild(row)
      list.appendChild(li)
    }
    this.el.appendChild(list)
  }
}
