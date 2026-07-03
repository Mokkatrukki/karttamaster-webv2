import { getSegmentStatusCounts } from '../logic/segments'
import type { Segment, SegmentStore } from '../logic/segments'
import type { MarkerStatus, SignMarker } from '../logic/types'

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'suunniteltu',
  asetettu: 'asetettu',
  tarkistettu: 'tarkistettu',
  kerätty: 'kerätty',
  ei_tarpeen: 'ei tarpeen',
}

function segmentLabel(segment: Segment): string {
  if (segment.displayName) return segment.displayName
  return `${(segment.startDist / 1000).toFixed(1)}–${(segment.endDist / 1000).toFixed(1)}km`
}

function countsLabel(counts: Record<MarkerStatus, number>): string {
  const parts = (Object.keys(STATUS_LABELS) as MarkerStatus[])
    .filter(status => counts[status] > 0)
    .map(status => `${counts[status]} ${STATUS_LABELS[status]}`)
  return parts.length > 0 ? parts.join(' · ') : 'ei merkkejä'
}

// T141/V88: kartan-alle-palkki, korvaa T95:n kuolleen sivupalkki-%:n (B60).
export class SegmentStatusBar {
  private readonly el: HTMLElement

  constructor(container: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'segment-status-bar'
    this.el.hidden = true
    container.appendChild(this.el)
  }

  update(store: SegmentStore, markers: SignMarker[]): void {
    const segments = Array.from(store.values())
    if (segments.length === 0) {
      this.el.hidden = true
      this.el.replaceChildren()
      return
    }
    this.el.hidden = false
    this.el.replaceChildren(
      ...segments.map(segment => {
        const row = document.createElement('span')
        row.className = 'segment-status-row'
        const name = document.createElement('strong')
        name.textContent = segmentLabel(segment)
        row.appendChild(name)
        row.appendChild(document.createTextNode(`: ${countsLabel(getSegmentStatusCounts(segment, markers))}`))
        return row
      }),
    )
  }
}
