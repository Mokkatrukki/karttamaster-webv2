import type { RouteStatusSummary } from '../logic/route-status'

export class StatusPanel {
  constructor(private readonly container: HTMLElement) {}

  update(summaries: RouteStatusSummary[]): void {
    this.container.innerHTML = ''
    for (const s of summaries) {
      this.container.appendChild(this.buildRow(s))
    }
  }

  private buildRow(s: RouteStatusSummary): HTMLElement {
    const row = document.createElement('div')
    row.className = 'status-panel-row'
    row.dataset.routeId = s.routeId

    const label = document.createElement('span')
    label.className = 'status-panel-label'
    label.textContent = s.routeId

    const progress = document.createElement('div')
    progress.className = 'status-panel-bar'
    progress.setAttribute('role', 'progressbar')
    progress.setAttribute('aria-label', `${s.routeId} edistyminen`)
    progress.setAttribute('aria-valuenow', String(s.completionPercent))
    progress.setAttribute('aria-valuemin', '0')
    progress.setAttribute('aria-valuemax', '100')

    const fill = document.createElement('div')
    fill.className = 'status-panel-fill'
    fill.style.width = `${s.completionPercent}%`
    progress.appendChild(fill)

    const pct = document.createElement('span')
    pct.className = 'status-panel-pct'
    pct.textContent = `${s.completionPercent}%`

    const detail = document.createElement('span')
    detail.className = 'status-panel-detail'
    const done = s.total - s.byStatus['suunniteltu']
    detail.textContent = s.total === 0 ? '—' : `${done}/${s.total}`

    row.appendChild(label)
    row.appendChild(progress)
    row.appendChild(pct)
    row.appendChild(detail)
    return row
  }
}
