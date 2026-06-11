export interface SnapshotEntry {
  id: string
  label: string
  created_at: string
  created_by: string
  trigger: string
}

export class SnapshotPanel {
  private readonly panel: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly backupBtn: HTMLButtonElement
  private readonly toggleBtn: HTMLButtonElement
  private listEl: HTMLElement | null = null
  private collapsed = true
  private snapshotCount = 0

  constructor(
    container: HTMLElement,
    private readonly role: string,
  ) {
    const built = this.build()
    this.panel = built.panel
    this.titleEl = built.titleEl
    this.backupBtn = built.backupBtn
    this.toggleBtn = built.toggleBtn
    container.appendChild(this.panel)
    this.applyCollapsed()
    if (this.isAllowed()) {
      this.refresh().catch(console.error)
    }
  }

  private isAllowed(): boolean {
    return this.role === 'järjestäjä' || this.role === 'admin'
  }

  private build(): { panel: HTMLElement; titleEl: HTMLElement; backupBtn: HTMLButtonElement; toggleBtn: HTMLButtonElement } {
    const el = document.createElement('div')
    el.id = 'snapshot-panel'

    const header = document.createElement('div')
    header.className = 'snapshot-header'
    header.style.cursor = 'pointer'
    header.addEventListener('click', (e) => {
      // Don't toggle when clicking backup button
      if ((e.target as HTMLElement).closest('#btn-snapshot-create')) return
      this.collapsed = !this.collapsed
      this.applyCollapsed()
    })

    const titleEl = document.createElement('h3')
    titleEl.textContent = 'Varmuuskopiot'
    header.appendChild(titleEl)

    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'btn-snapshot-toggle'
    toggleBtn.setAttribute('aria-label', 'Näytä tai piilota varmuuskopiot')
    toggleBtn.textContent = '▶'
    toggleBtn.style.background = 'transparent'
    toggleBtn.style.border = 'none'
    toggleBtn.style.color = 'var(--text-muted)'
    toggleBtn.style.fontSize = '10px'
    toggleBtn.style.padding = '0 8px'
    toggleBtn.style.minHeight = '44px'
    toggleBtn.style.minWidth = '44px'
    toggleBtn.style.cursor = 'pointer'
    header.appendChild(toggleBtn)

    const backupBtn = document.createElement('button')
    backupBtn.id = 'btn-snapshot-create'
    backupBtn.textContent = 'Luo varmuuskopio'
    backupBtn.className = 'btn-snapshot-create'
    backupBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.handleCreate().catch(console.error)
    })
    header.appendChild(backupBtn)

    el.appendChild(header)

    this.listEl = document.createElement('ul')
    this.listEl.id = 'snapshot-list'
    this.listEl.className = 'snapshot-list'
    el.appendChild(this.listEl)

    return { panel: el, titleEl, backupBtn, toggleBtn }
  }

  private applyCollapsed(): void {
    const count = this.snapshotCount
    this.titleEl.textContent = this.collapsed
      ? `Varmuuskopiot (${count})`
      : 'Varmuuskopiot'
    this.toggleBtn.textContent = this.collapsed ? '▶' : '▼'
    if (this.listEl) this.listEl.hidden = this.collapsed
    this.backupBtn.hidden = this.collapsed
  }

  async refresh(): Promise<void> {
    if (!this.listEl || !this.isAllowed()) return
    try {
      const res = await fetch('/api/admin/snapshots')
      if (!res.ok) return
      const snapshots = await res.json() as SnapshotEntry[]
      this.snapshotCount = snapshots.length
      this.render(snapshots)
      this.applyCollapsed()
    } catch {
      // network error — leave list as-is
    }
  }

  private render(snapshots: SnapshotEntry[]): void {
    if (!this.listEl) return
    this.listEl.innerHTML = ''
    if (snapshots.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'snapshot-empty'
      empty.textContent = 'Ei varmuuskopioita'
      this.listEl.appendChild(empty)
      return
    }
    for (const snap of snapshots) {
      const li = document.createElement('li')
      li.className = 'snapshot-item'
      li.dataset.id = snap.id

      const info = document.createElement('span')
      info.className = 'snapshot-info'
      const date = snap.created_at.slice(0, 16).replace('T', ' ')
      info.textContent = `${snap.label} — ${date} (${snap.created_by})`
      li.appendChild(info)

      const restoreBtn = document.createElement('button')
      restoreBtn.className = 'btn-snapshot-restore'
      restoreBtn.textContent = 'Palauta tämä versio'
      restoreBtn.dataset.id = snap.id
      restoreBtn.dataset.label = snap.label
      restoreBtn.addEventListener('click', () => { this.handleRestore(snap).catch(console.error) })
      li.appendChild(restoreBtn)

      this.listEl.appendChild(li)
    }
  }

  private async handleCreate(): Promise<void> {
    try {
      const res = await fetch('/api/admin/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) await this.refresh()
    } catch {
      console.error('[snapshot-panel] create failed')
    }
  }

  private async handleRestore(snap: SnapshotEntry): Promise<void> {
    if (!confirm(`Palautetaanko versio "${snap.label}"?\n\nKaikki nykyiset merkit korvataan tällä versiolla.`)) return
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}/restore`, { method: 'POST' })
      if (res.ok) {
        await this.refresh()
      } else {
        console.error('[snapshot-panel] restore failed', res.status)
      }
    } catch {
      console.error('[snapshot-panel] restore network error')
    }
  }
}
