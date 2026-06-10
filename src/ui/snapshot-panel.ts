export interface SnapshotEntry {
  id: string
  label: string
  created_at: string
  created_by: string
  trigger: string
}

export class SnapshotPanel {
  private readonly panel: HTMLElement
  private listEl: HTMLElement | null = null

  constructor(
    container: HTMLElement,
    private readonly role: string,
  ) {
    this.panel = this.build()
    container.appendChild(this.panel)
    if (this.isAllowed()) {
      this.refresh().catch(console.error)
    }
  }

  private isAllowed(): boolean {
    return this.role === 'järjestäjä' || this.role === 'admin'
  }

  private build(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'snapshot-panel'
    el.hidden = !this.isAllowed()

    const header = document.createElement('div')
    header.className = 'snapshot-header'

    const title = document.createElement('h3')
    title.textContent = 'Varmuuskopiot'
    header.appendChild(title)

    const backupBtn = document.createElement('button')
    backupBtn.id = 'btn-snapshot-create'
    backupBtn.textContent = 'Luo varmuuskopio'
    backupBtn.className = 'btn-snapshot-create'
    backupBtn.addEventListener('click', () => { this.handleCreate().catch(console.error) })
    header.appendChild(backupBtn)

    el.appendChild(header)

    this.listEl = document.createElement('ul')
    this.listEl.id = 'snapshot-list'
    this.listEl.className = 'snapshot-list'
    el.appendChild(this.listEl)

    return el
  }

  async refresh(): Promise<void> {
    if (!this.listEl || !this.isAllowed()) return
    try {
      const res = await fetch('/api/admin/snapshots')
      if (!res.ok) return
      const snapshots = await res.json() as SnapshotEntry[]
      this.render(snapshots)
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
