export type MapStatus = 'luonnos' | 'hyväksytty'

export class MapStateBadge {
  private badgeEl: HTMLElement | null = null
  private approveBtn: HTMLButtonElement | null = null

  constructor(
    private readonly toolbar: HTMLElement,
    role: string,
  ) {
    if (role === 'järjestäjä' || role === 'admin') {
      this.mount()
    }
  }

  private mount(): void {
    const container = document.createElement('span')
    container.id = 'map-state-badge'

    this.badgeEl = document.createElement('span')
    this.badgeEl.id = 'map-state-text'
    this.badgeEl.className = 'map-state-text'
    container.appendChild(this.badgeEl)

    this.approveBtn = document.createElement('button')
    this.approveBtn.id = 'btn-approve-map'
    this.approveBtn.textContent = 'Hyväksy kartta'
    this.approveBtn.className = 'btn-approve'
    this.approveBtn.hidden = true
    this.approveBtn.addEventListener('click', () => { this.handleApprove().catch(console.error) })
    container.appendChild(this.approveBtn)

    const btnLayer = this.toolbar.querySelector('#btn-layer')
    if (btnLayer) {
      this.toolbar.insertBefore(container, btnLayer)
    } else {
      this.toolbar.appendChild(container)
    }

    this.refresh().catch(console.error)
  }

  async refresh(): Promise<void> {
    if (!this.badgeEl) return
    try {
      const res = await fetch('/api/admin/map-state')
      if (!res.ok) return
      const data = await res.json() as { status: MapStatus }
      this.update(data.status)
    } catch {
      // network error — leave badge empty
    }
  }

  update(status: MapStatus): void {
    if (!this.badgeEl || !this.approveBtn) return
    this.badgeEl.textContent = status === 'hyväksytty' ? '✓ HYVÄKSYTTY' : 'LUONNOS'
    this.badgeEl.dataset.status = status
    this.approveBtn.hidden = status !== 'luonnos'
  }

  private async handleApprove(): Promise<void> {
    if (!confirm('Hyväksy kartta? Tämä lukitsee suunnitelman ja luo automaattisen varmuuskopion.')) return
    try {
      const res = await fetch('/api/admin/map-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hyväksytty' }),
      })
      if (res.ok) await this.refresh()
    } catch {
      console.error('[map-state] approve failed')
    }
  }
}

// V22: show "Kartta valmisteilla" banner for talkoolainen on 403
export function showMapNotReadyBanner(): void {
  const el = document.getElementById('map-state-banner')
  if (el) el.hidden = false
}
