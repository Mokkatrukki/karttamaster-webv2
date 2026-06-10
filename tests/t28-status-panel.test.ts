import { describe, it, expect, beforeEach } from 'vitest'
import { StatusPanel } from '../src/ui/status-panel'
import type { RouteStatusSummary } from '../src/logic/route-status'

function summary(routeId: string, total: number, done: number): RouteStatusSummary {
  const suunniteltu = total - done
  const asetettu = done
  return {
    routeId,
    total,
    byStatus: { suunniteltu, asetettu, tarkistettu: 0, kerätty: 0, ei_tarpeen: 0 },
    completionPercent: total === 0 ? 100 : Math.round((done / total) * 100),
  }
}

describe('StatusPanel', () => {
  let container: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="status-panel"></div>'
    container = document.getElementById('status-panel')!
  })

  it('renders one row per route summary', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7), summary('55km', 5, 3)])
    expect(container.querySelectorAll('.status-panel-row')).toHaveLength(2)
  })

  it('shows routeId as label', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    expect(container.querySelector('.status-panel-label')!.textContent).toBe('35km')
  })

  it('shows completionPercent as text', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])  // 70%
    expect(container.querySelector('.status-panel-pct')!.textContent).toBe('70%')
  })

  it('sets progress bar fill width to completionPercent', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    const fill = container.querySelector('.status-panel-fill') as HTMLElement
    expect(fill.style.width).toBe('70%')
  })

  it('shows done/total detail', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    expect(container.querySelector('.status-panel-detail')!.textContent).toBe('7/10')
  })

  it('shows 100% when total=0', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 0, 0)])
    expect(container.querySelector('.status-panel-pct')!.textContent).toBe('100%')
  })

  it('update clears previous content', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    panel.update([summary('55km', 5, 5)])
    const rows = container.querySelectorAll('.status-panel-row')
    expect(rows).toHaveLength(1)
    expect((rows[0] as HTMLElement).dataset.routeId).toBe('55km')
  })

  it('update with empty array clears panel', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    panel.update([])
    expect(container.querySelectorAll('.status-panel-row')).toHaveLength(0)
  })

  it('progress bar has aria attributes for accessibility', () => {
    const panel = new StatusPanel(container)
    panel.update([summary('35km', 10, 7)])
    const bar = container.querySelector('.status-panel-bar')!
    expect(bar.getAttribute('role')).toBe('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('70')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })
})
